"""Read a resume file into plain text.

Accepted: PDF, DOCX, TXT, PNG, JPG/JPEG, WEBP (8 MB max, first 4 PDF pages). The file type is decided by its
magic bytes, not its name. The raw upload is only ever written to a temp file that is deleted in a finally block;
nothing is stored.

Text PDFs, DOCX and TXT need no OCR. Scanned PDF pages (under 50 characters of text) and images go through an OCR
engine chosen by OCR_ENGINE (rapidocr default, or tesseract if installed). Engines load lazily, once. If the chosen
one cannot load the other is tried; if neither loads, only files that need OCR fail (503 "OCR engine unavailable").
"""
import asyncio
import io
import logging
import os
import re
import tempfile
import threading
import zipfile
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from app.config import settings

logger = logging.getLogger("skillsense_resume")

MAX_BYTES = 8 * 1024 * 1024
MAX_PDF_PAGES = 4
MIN_PAGE_CHARS = 50          # fewer characters than this on a PDF page means "scanned": OCR it
OCR_DPI = 200
OCR_TIMEOUT_S = 40
LOW_CONFIDENCE = 60
MAX_PIXELS = 50_000_000
MAX_TEXT_CHARS = 60_000

EXTENSION_KIND = {".pdf": "pdf", ".docx": "docx", ".txt": "txt", ".png": "png", ".jpg": "jpg", ".jpeg": "jpg", ".webp": "webp"}
IMAGE_KINDS = {"png", "jpg", "webp"}
SUPPORTED_MESSAGE = "Unsupported file type. Upload a PDF, DOCX, TXT, PNG, JPG or WEBP resume."


class ResumeFileError(Exception):
    """A problem with the uploaded file that the student can fix. `status_code` is the HTTP status to answer with."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class OcrUnavailable(ResumeFileError):
    def __init__(self):
        super().__init__("OCR engine unavailable", 503)


@dataclass
class Extracted:
    text: str
    kind: str
    ocr_used: bool = False
    ocr_confidence: Optional[int] = None  # 0-100, only when OCR ran
    pages_processed: int = 1
    has_tables: bool = False
    engine: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Validation by magic bytes
# ---------------------------------------------------------------------------
def detect_kind(data: bytes) -> Optional[str]:
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                return "docx" if "word/document.xml" in z.namelist() else None
        except zipfile.BadZipFile:
            return None
    head = data[:8192]
    if b"\x00" in head:
        return None
    controls = sum(1 for b in head if b < 9 or 13 < b < 32)
    return "txt" if controls <= max(2, len(head) // 50) else None


def validate_upload(filename: str, data: bytes) -> str:
    """Return the file kind, or raise ResumeFileError. The extension must agree with the content."""
    ext = os.path.splitext((filename or "").lower())[1]
    if ext not in EXTENSION_KIND:
        raise ResumeFileError(SUPPORTED_MESSAGE)
    if not data:
        raise ResumeFileError("The uploaded file is empty (0 bytes).")
    if len(data) > MAX_BYTES:
        raise ResumeFileError("The file is larger than the 8 MB limit.", 413)
    kind = detect_kind(data)
    if kind is None:
        raise ResumeFileError("This does not look like a valid resume file. Upload a PDF, DOCX, TXT, PNG, JPG or WEBP.")
    if kind != EXTENSION_KIND[ext]:
        raise ResumeFileError(f"The file content is {kind.upper()} but its name ends in {ext}. Rename or re-export it and try again.")
    return kind


@contextmanager
def _temp_file(data: bytes, suffix: str):
    """The only place the raw upload touches disk. Always deleted."""
    fd, path = tempfile.mkstemp(suffix=suffix, prefix="resume_")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        yield path
    finally:
        try:
            os.remove(path)
        except OSError:
            logger.warning("Could not delete a temporary resume file")


# ---------------------------------------------------------------------------
# OCR engines
# ---------------------------------------------------------------------------
def prepare_image(img):
    """Grayscale, autocontrast, upscale small images (short side < 1000 px), cap the long side at 3000 px."""
    from PIL import Image, ImageOps

    img = ImageOps.exif_transpose(img)
    img = ImageOps.autocontrast(img.convert("L"))
    w, h = img.size
    short, long_ = min(w, h), max(w, h)
    scale = 1.0
    if short < 1000:
        scale = 1000 / short
    if long_ * scale > 3000:
        scale = 3000 / long_
    if abs(scale - 1.0) > 0.01:
        img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    return img


def _group_lines(items: List[Tuple[float, float, float, str, float]]) -> Tuple[str, int]:
    """items: (x, y_center, height, text, confidence 0-1). Returns reading-order text and confidence 0-100."""
    if not items:
        return "", 0
    items = sorted(items, key=lambda i: i[1])
    lines: List[List[Tuple[float, float, float, str, float]]] = []
    for item in items:
        if lines:
            last = lines[-1]
            mean_y = sum(i[1] for i in last) / len(last)
            mean_h = sum(i[2] for i in last) / len(last)
            if abs(item[1] - mean_y) <= 0.6 * max(mean_h, 1):
                last.append(item)
                continue
        lines.append([item])
    text = "\n".join(" ".join(i[3] for i in sorted(line, key=lambda i: i[0])) for line in lines)
    weight = sum(len(i[3]) for i in items) or 1
    confidence = sum(i[4] * len(i[3]) for i in items) / weight
    return text, int(round(confidence * 100))


class RapidOcrEngine:
    name = "rapidocr"

    def __init__(self):
        from rapidocr_onnxruntime import RapidOCR

        self._ocr = RapidOCR()

    def read(self, img) -> Tuple[str, int]:
        import numpy as np

        result, _ = self._ocr(np.array(img))
        items = []
        for box, text, conf in result or []:
            ys = [p[1] for p in box]
            xs = [p[0] for p in box]
            items.append((min(xs), (min(ys) + max(ys)) / 2, max(ys) - min(ys), str(text), float(conf)))
        return _group_lines(items)


class TesseractEngine:
    name = "tesseract"

    def __init__(self):
        import pytesseract

        pytesseract.get_tesseract_version()  # raises when the tesseract program is not installed
        self._tess = pytesseract

    def read(self, img) -> Tuple[str, int]:
        data = self._tess.image_to_data(img, output_type=self._tess.Output.DICT)
        items = []
        for i, word in enumerate(data["text"]):
            conf = float(data["conf"][i])
            if word.strip() and conf >= 0:
                items.append((data["left"][i], data["top"][i] + data["height"][i] / 2, data["height"][i], word, conf / 100))
        return _group_lines(items)


_ENGINE_CLASSES = {"rapidocr": RapidOcrEngine, "tesseract": TesseractEngine}
_engines: dict = {}      # name -> engine, or None when it failed to load (not retried until reset_ocr_engines())
_engine_lock = threading.Lock()
_ocr_lock = threading.Lock()  # one OCR at a time: the engines are not promised to be thread safe


def reset_ocr_engines() -> None:
    with _engine_lock:
        _engines.clear()


def get_ocr_engine():
    """The preferred engine, else the other one. Raises OcrUnavailable when neither loads."""
    preferred = settings.OCR_ENGINE
    order = [preferred] + [n for n in _ENGINE_CLASSES if n != preferred]
    with _engine_lock:
        for name in order:
            if name not in _engines:
                try:
                    _engines[name] = _ENGINE_CLASSES[name]()
                    logger.info("OCR engine loaded: %s", name)
                except Exception as exc:  # ImportError, missing binary, blocked DLL: all mean "not usable here"
                    _engines[name] = None
                    logger.warning("OCR engine %s unavailable (%s)", name, type(exc).__name__)
            if _engines[name] is not None:
                return _engines[name]
    raise OcrUnavailable()


_space_model = None


def _load_space_model():
    """wordninja's English model plus every single-word skill term, so FastAPI and MongoDB are not split."""
    global _space_model
    if _space_model is None:
        try:
            import copy

            import wordninja
            from app.data.skills import SKILLS

            model = copy.copy(wordninja.DEFAULT_LANGUAGE_MODEL)
            terms = {a for s in SKILLS for a in (s.name, *s.aliases) if re.fullmatch(r"[A-Za-z]{3,}", a)}
            terms |= {"jwt", "api", "apis", "cgpa", "btech", "linkedin", "github"}
            model._wordcost = {**model._wordcost, **{t.lower(): 2.0 for t in terms}}
            model._maxword = max(model._maxword, max(len(t) for t in terms))
            _space_model = model
        except Exception as exc:  # no wordninja: OCR text is used as it comes
            logger.warning("Space restoration unavailable (%s)", type(exc).__name__)
            _space_model = False
    return _space_model or None


def restore_spaces(text: str) -> str:
    """RapidOCR often drops the spaces between words ("BuiltaRESTAPIwith..."). Split long glued runs back into words."""
    model = _load_space_model()
    if model is None:
        return text

    def fix(line: str) -> str:
        line = re.sub(r"(?<=[A-Z]{2})l(?![a-z])", "I", line)  # OCR reads the I of "API" as a lowercase L
        return re.sub(r"[A-Za-z']{9,}", lambda m: " ".join(model.split(m.group(0))), line)

    return "\n".join(fix(line) for line in text.split("\n"))


def _ocr(img) -> Tuple[str, int, str]:
    engine = get_ocr_engine()
    with _ocr_lock:
        text, confidence = engine.read(prepare_image(img))
    return restore_spaces(text), confidence, engine.name


# ---------------------------------------------------------------------------
# Readers (blocking; run in a worker thread)
# ---------------------------------------------------------------------------
def _read_pdf(path: str) -> Extracted:
    import fitz
    from PIL import Image

    try:
        doc = fitz.open(path)
    except Exception:
        raise ResumeFileError("Could not open this PDF. It may be damaged; try exporting it again.") from None
    try:
        if doc.needs_pass:
            raise ResumeFileError("This PDF is password-protected. Remove the password, save it again and upload it.")
        total = doc.page_count
        if total == 0:
            raise ResumeFileError("This PDF has no pages.")
        pages = min(total, MAX_PDF_PAGES)
        out = Extracted(text="", kind="pdf", pages_processed=pages)
        parts, confidences = [], []
        for index in range(pages):
            page = doc[index]
            text = page.get_text("text")
            if len(text.strip()) < MIN_PAGE_CHARS:  # scanned page: render it and read it with OCR
                pix = page.get_pixmap(dpi=OCR_DPI, alpha=False)
                image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                text, confidence, engine = _ocr(image)
                out.ocr_used, out.engine = True, engine
                confidences.append(confidence)
            parts.append(text)
        if total > pages:
            out.warnings.append(f"Only the first {MAX_PDF_PAGES} of {total} pages were read.")
        if confidences:
            out.ocr_confidence = int(round(sum(confidences) / len(confidences)))
        out.text = "\n".join(parts)
        return out
    finally:
        doc.close()


def _read_docx(path: str) -> Extracted:
    from docx import Document
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    try:
        doc = Document(path)
    except Exception:
        raise ResumeFileError("Could not open this DOCX file. It may be damaged; try saving it again.") from None

    lines: List[str] = []
    for section in doc.sections:
        lines += [p.text for p in section.header.paragraphs]
    has_tables = False
    for child in doc.element.body.iterchildren():  # document order, so a table stays where the author put it
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "p":
            lines.append(Paragraph(child, doc).text)
        elif tag == "tbl":
            has_tables = True
            for row in Table(child, doc).rows:
                cells: List[str] = []
                for cell in row.cells:
                    text = cell.text.strip()
                    if text and (not cells or cells[-1] != text):  # merged cells repeat their text
                        cells.append(text)
                lines.append("   ".join(cells))
    for section in doc.sections:
        lines += [p.text for p in section.footer.paragraphs]
    return Extracted(text="\n".join(lines), kind="docx", has_tables=has_tables)


def _read_image(path: str, kind: str) -> Extracted:
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(path) as img:
            if img.width * img.height > MAX_PIXELS:
                raise ResumeFileError("This image is too large to read. Use one under 50 megapixels.")
            img.load()
            text, confidence, engine = _ocr(img.copy())
    except ResumeFileError:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ResumeFileError("Could not read this image. It may be damaged; try saving it again.") from None
    return Extracted(text=text, kind=kind, ocr_used=True, ocr_confidence=confidence, engine=engine)


def _read_txt(data: bytes) -> Extracted:
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = data.decode("latin-1")
    return Extracted(text=text, kind="txt")


def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:MAX_TEXT_CHARS]


def _extract_sync(kind: str, data: bytes) -> Extracted:
    if kind == "txt":
        out = _read_txt(data)
    else:
        with _temp_file(data, "." + kind) as path:
            out = _read_pdf(path) if kind == "pdf" else _read_docx(path) if kind == "docx" else _read_image(path, kind)
    out.text = clean_text(out.text)
    if out.ocr_used and out.ocr_confidence is not None and out.ocr_confidence < LOW_CONFIDENCE:
        out.warnings.append(f"OCR confidence is low ({out.ocr_confidence}%). Review the extracted text and fix mistakes before trusting the score.")
    return out


_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="resume-extract")


async def extract_resume(filename: str, data: bytes) -> Extracted:
    """Validate and read an upload in a worker thread (40 s limit)."""
    kind = validate_upload(filename, data)
    loop = asyncio.get_running_loop()
    try:
        # ponytail: a timed-out OCR thread keeps running until it finishes; the cap of 2 workers bounds the damage
        return await asyncio.wait_for(loop.run_in_executor(_pool, _extract_sync, kind, data), timeout=OCR_TIMEOUT_S)
    except asyncio.TimeoutError:
        raise ResumeFileError("Reading this file took too long. Try a smaller or clearer file, or paste the text instead.", 504) from None


def extract_plain(kind: str, data: bytes) -> str:
    """Text only, no OCR needed or attempted: used by the admin question-paper upload."""
    try:
        return _extract_sync(kind, data).text
    except ResumeFileError:
        return ""
