import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.models.user import UserOut
from app.repositories._base import NO_ID, col, find_many
from app.utils.security import require_admin
from app.utils.timeutil import utcnow

router = APIRouter(tags=["Topic Notes"])

VALID_TOPICS = [
    "Core Computer Science",
    "SQL & Databases",
    "General Aptitude",
    "Arrays",
    "Strings",
    "Stacks",
    "Linked Lists",
    "System Design & Architecture",
]

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".ppt", ".pptx"}
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "notes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def normalize_topic_key(val: str) -> str:
    """Normalize topic to lowercase alphanumeric string for matching."""
    return re.sub(r"[^a-z0-9]", "", val.lower())


TOPIC_CANONICAL = {normalize_topic_key(t): t for t in VALID_TOPICS}


def canonicalize_topic(val: str) -> str:
    """Map any slug, capitalized or spaced topic variant to the official canonical topic name."""
    norm = normalize_topic_key(val)
    if norm in TOPIC_CANONICAL:
        return TOPIC_CANONICAL[norm]
    for k, v in TOPIC_CANONICAL.items():
        if k in norm or norm in k:
            return v
    return val.strip()


def _safe_filename(name: str) -> str:
    base = os.path.basename(name)
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", base)


# ---- Public / Student endpoints -----------------------------------------------------------------

@router.get("/topics/{topic_key}/notes")
async def get_topic_notes(topic_key: str):
    """Retrieve published admin notes for a specific topic (handles any URL format or capitalization)."""
    canonical = canonicalize_topic(topic_key)
    norm = normalize_topic_key(canonical)

    query = {
        "$or": [
            {"topic_slug": norm},
            {"topic": {"$regex": f"^{re.escape(canonical)}$", "$options": "i"}},
            {"topic": canonical},
        ]
    }
    notes = await find_many("topic_notes", query, sort=[("created_at", -1)])
    return [
        {
            "id": n["id"],
            "topic": n.get("topic", canonical),
            "title": n.get("title", ""),
            "description": n.get("description", ""),
            "filename": n.get("filename", ""),
            "file_size": n.get("file_size", 0),
            "file_type": n.get("file_type", ""),
            "created_at": n.get("created_at", ""),
            "updated_at": n.get("updated_at", ""),
        }
        for n in notes
    ]


@router.get("/topics/notes/{note_id}/download")
async def download_topic_note(note_id: str):
    """Download the attached study note document."""
    doc = await col("topic_notes").find_one({"id": note_id}, NO_ID)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    file_path = Path(doc.get("file_path", ""))
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note file not found on disk")

    filename = doc.get("filename") or file_path.name
    media_type = doc.get("file_type") or "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=media_type,
    )


# ---- Admin Management endpoints -----------------------------------------------------------------

@router.get("/admin/notes")
async def list_admin_notes(
    topic: Optional[str] = Query(None),
    current_user: UserOut = Depends(require_admin),
):
    """List all notes with optional topic filter for admin manager."""
    query = {}
    if topic and topic != "All":
        canonical = canonicalize_topic(topic)
        query["topic"] = canonical

    notes = await find_many("topic_notes", query, sort=[("created_at", -1)])
    return [
        {
            "id": n["id"],
            "topic": n.get("topic", ""),
            "title": n.get("title", ""),
            "description": n.get("description", ""),
            "filename": n.get("filename", ""),
            "file_size": n.get("file_size", 0),
            "file_type": n.get("file_type", ""),
            "created_at": n.get("created_at", ""),
            "updated_at": n.get("updated_at", ""),
        }
        for n in notes
    ]


@router.post("/admin/notes", status_code=status.HTTP_201_CREATED)
async def create_topic_note(
    topic: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(""),
    file: UploadFile = File(...),
    current_user: UserOut = Depends(require_admin),
):
    """Upload and publish study notes/materials for one of the 8 topic areas."""
    canonical_topic = canonicalize_topic(topic)
    if canonical_topic not in VALID_TOPICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid topic. Choose one of: {', '.join(VALID_TOPICS)}",
        )

    clean_title = (title or "").strip()
    if not clean_title or len(clean_title) > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title must be between 1 and 200 characters.")

    clean_desc = (description or "").strip()[:2000]

    filename = file.filename or "notes.pdf"
    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read(MAX_FILE_BYTES + 1)
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty (0 bytes).")
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the maximum allowed size of 10 MB.",
        )

    note_id = f"note-{uuid.uuid4().hex[:8]}"
    safe_name = _safe_filename(filename)
    stored_name = f"{note_id}_{safe_name}"
    target_path = UPLOAD_DIR / stored_name

    with open(target_path, "wb") as f:
        f.write(content)

    doc = {
        "id": note_id,
        "topic": canonical_topic,
        "topic_slug": normalize_topic_key(canonical_topic),
        "title": clean_title,
        "description": clean_desc,
        "filename": filename,
        "stored_name": stored_name,
        "file_path": str(target_path),
        "file_size": len(content),
        "file_type": file.content_type or "application/octet-stream",
        "uploaded_by": current_user.id,
        "created_at": utcnow().isoformat(),
        "updated_at": utcnow().isoformat(),
    }
    await col("topic_notes").insert_one(doc)

    return {
        "success": True,
        "message": f"Note '{clean_title}' published for topic '{canonical_topic}'.",
        "note": {
            "id": doc["id"],
            "topic": doc["topic"],
            "title": doc["title"],
            "description": doc["description"],
            "filename": doc["filename"],
            "file_size": doc["file_size"],
            "created_at": doc["created_at"],
        },
    }


@router.put("/admin/notes/{note_id}")
async def update_topic_note(
    note_id: str,
    topic: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: UserOut = Depends(require_admin),
):
    """Edit an existing note's metadata and optionally replace its file attachment."""
    existing = await col("topic_notes").find_one({"id": note_id}, NO_ID)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    updates = {"updated_at": utcnow().isoformat()}

    if topic is not None:
        canonical = canonicalize_topic(topic)
        if canonical not in VALID_TOPICS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid topic '{topic}'.")
        updates["topic"] = canonical
        updates["topic_slug"] = normalize_topic_key(canonical)

    if title is not None:
        clean_title = title.strip()
        if not clean_title or len(clean_title) > 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Title must be between 1 and 200 characters.")
        updates["title"] = clean_title

    if description is not None:
        updates["description"] = description.strip()[:2000]

    if file is not None and file.filename:
        filename = file.filename
        ext = os.path.splitext(filename.lower())[1]
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported file format '{ext}'.")
        content = await file.read(MAX_FILE_BYTES + 1)
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File exceeds 10 MB limit.")

        # Remove old file if it exists
        old_path = Path(existing.get("file_path", ""))
        if old_path.exists():
            try:
                old_path.unlink()
            except Exception:
                pass

        safe_name = _safe_filename(filename)
        stored_name = f"{note_id}_{safe_name}"
        target_path = UPLOAD_DIR / stored_name
        with open(target_path, "wb") as f:
            f.write(content)

        updates["filename"] = filename
        updates["stored_name"] = stored_name
        updates["file_path"] = str(target_path)
        updates["file_size"] = len(content)
        updates["file_type"] = file.content_type or "application/octet-stream"

    await col("topic_notes").update_one({"id": note_id}, {"$set": updates})
    updated_doc = await col("topic_notes").find_one({"id": note_id}, NO_ID)
    return {"success": True, "note": updated_doc}


@router.delete("/admin/notes/{note_id}")
async def delete_topic_note(note_id: str, current_user: UserOut = Depends(require_admin)):
    """Delete a note and its file attachment."""
    existing = await col("topic_notes").find_one({"id": note_id}, NO_ID)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

    file_path = Path(existing.get("file_path", ""))
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass

    await col("topic_notes").delete_one({"id": note_id})
    return {"success": True, "message": f"Note {note_id} deleted successfully."}

