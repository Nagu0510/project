"""Resume analysis: section parsing, skill evidence, and an ATS-style score with a transparent breakdown.

"ATS-style" because no real ATS vendor is queried: the score is a rule-based estimate built from nine categories
(30 keyword match, 15 evidence, 10 contact, 10 sections, 10 impact, 10 bullets, 5 length, 5 formatting, 5 education).
Everything here is deterministic. Nothing is invented: suggestions are fill-in-the-blank templates and the
learning steps only link to courses that exist in the courses collection.
"""
import difflib
import hashlib
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from app.data import skills as catalog
from app.models.resume import (
    BulletTip, CategoryScore, CompanyMatch, Comparison, JdMatch, LearningStep, ResumeAnalysisResult,
    ResumeFix, ResumeGap, ResumeStrength, SkillEvidence,
)
from app.services import resume_extract


# ---------------------------------------------------------------------------
# Legacy helpers (the admin question-paper upload still reads PDFs and DOCX through these)
# ---------------------------------------------------------------------------
def extract_text_from_pdf(file_bytes: bytes) -> str:
    return resume_extract.extract_plain("pdf", file_bytes)


def extract_text_from_docx(file_bytes: bytes) -> str:
    return resume_extract.extract_plain("docx", file_bytes)


COMPANY_BENCHMARKS = [
    {"company": "TCS (Tata Consultancy Services)", "role": "Systems Engineer", "required_skills": ["Python", "SQL", "Git", "DSA", "DBMS"], "location": "Pan-India"},
    {"company": "Infosys", "role": "Specialist Programmer", "required_skills": ["Python", "Java", "DSA", "REST API", "SQL"], "location": "Bangalore / Hyderabad"},
    {"company": "Accenture", "role": "Associate Software Engineer", "required_skills": ["JavaScript", "HTML", "CSS", "SQL", "Git"], "location": "Pune / Noida / Bangalore"},
    {"company": "Wipro", "role": "Project Engineer", "required_skills": ["Java", "C++", "DSA", "SQL", "Git"], "location": "Chennai / Hyderabad"},
    {"company": "Amazon", "role": "Software Development Engineer (SDE-1)", "required_skills": ["Java", "C++", "DSA", "Docker", "REST API", "Linux"], "location": "Bangalore / Hyderabad"},
]


# ---------------------------------------------------------------------------
# Sections
# ---------------------------------------------------------------------------
SECTION_PHRASES = {
    "skills": ["skills", "technical skills", "core competencies", "technologies", "tech stack", "skill set", "key skills",
               "technical proficiency", "areas of expertise", "technical expertise"],
    "projects": ["projects", "academic projects", "personal projects", "project work", "key projects", "selected projects"],
    "experience": ["experience", "work experience", "professional experience", "internship", "internships",
                   "internship experience", "employment", "work history", "industrial training", "training"],
    "education": ["education", "academic background", "academic qualifications", "qualifications", "educational qualifications",
                  "academic profile"],
    "certifications": ["certifications", "certificates", "licenses", "courses", "certifications and courses",
                       "training and certifications", "online courses"],
    "achievements": ["achievements", "awards", "honors", "accomplishments", "extracurricular", "extracurricular activities",
                     "positions of responsibility", "activities", "awards and achievements"],
    "summary": ["summary", "objective", "profile", "career objective", "professional summary", "about me"],
}
PHRASE_TO_SECTION = {p: name for name, phrases in SECTION_PHRASES.items() for p in phrases}
# "Languages: C, C++" style lines: they list skills but never switch the section
SKILL_LABELS = ["languages", "programming languages", "frameworks", "tools", "tools and technologies", "libraries",
                "databases", "platforms", "web technologies", "cloud", "technologies used", "tech"]
_OCR_DIGITS = str.maketrans({"0": "o", "1": "i", "5": "s", "3": "e", "$": "s", "|": "l"})
_ENUMERATOR = re.compile(r"^\s*(?:[A-Za-z]|\d{1,2}|[IVXivx]{1,4})[.)]\s+")


def _normalize_heading(text: str) -> str:
    text = _ENUMERATOR.sub("", text)                    # "C. Education" -> "Education"
    text = text.translate(_OCR_DIGITS)                  # "PR0JECTS" -> "PROJECTS", "Sk1lls" -> "Skills"
    text = re.sub(r"[^A-Za-z& ]", " ", text).lower().replace("&", " and ")
    return re.sub(r"\s+", " ", text).strip()


def _heading_section(text: str) -> Optional[str]:
    norm = _normalize_heading(text)
    if not norm or len(norm.split()) > 4:
        return None
    if norm in PHRASE_TO_SECTION:
        return PHRASE_TO_SECTION[norm]
    close = difflib.get_close_matches(norm, PHRASE_TO_SECTION, n=1, cutoff=0.84)  # tolerant of OCR noise ("Educatlon")
    return PHRASE_TO_SECTION[close[0]] if close else None


def _line_heading(line: str) -> Optional[Tuple[str, str]]:
    """(section, text after a 'Skills:' style heading) when the line starts a section."""
    if len(line) > 80:
        return None
    if ":" in line:
        head, rest = line.split(":", 1)
        if len(head) <= 40:
            section = _heading_section(head)
            if section:
                return section, rest.strip()
    section = _heading_section(line)
    return (section, "") if section else None


def _skill_label_rest(line: str) -> Optional[str]:
    if ":" not in line:
        return None
    head, rest = line.split(":", 1)
    return rest if _normalize_heading(head) in SKILL_LABELS and rest.strip() else None


def parse_sections(text: str) -> Dict[str, Any]:
    """{'sections': {name: [lines]}, 'order': [names], 'label_lines': [(section, text)]}. Text before any heading is 'header'."""
    sections: Dict[str, List[str]] = {"header": []}
    order: List[str] = []
    label_lines: List[Tuple[str, str]] = []
    current = "header"
    for raw in text.split("\n"):
        line = raw.strip()
        if not line:
            continue
        heading = _line_heading(line)
        if heading:
            current = heading[0]
            sections.setdefault(current, [])
            if current not in order:
                order.append(current)
            if heading[1]:
                sections[current].append(heading[1])
            continue
        rest = _skill_label_rest(line)
        if rest:
            label_lines.append((current, rest))
        sections[current].append(line)
    return {"sections": sections, "order": order, "label_lines": label_lines}


# ---------------------------------------------------------------------------
# Skills and evidence
# ---------------------------------------------------------------------------
def detect_skills(parsed: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """name -> {'regions': set of section names, 'count': n}. Ambiguous aliases count only in Skills / label lines."""
    found: Dict[str, Dict[str, Any]] = {}

    def add(region: str, text: str, skills_context: bool) -> None:
        for name, count in catalog.scan(text, skills_context).items():
            entry = found.setdefault(name, {"regions": set(), "count": 0})
            entry["regions"].add(region)
            entry["count"] += count

    for name, lines in parsed["sections"].items():
        add(name, "\n".join(lines), skills_context=(name == "skills"))
    for section, rest in parsed["label_lines"]:
        # "Languages: C, Python" counts as a skills list, but stays evidence for the section it sits in
        add(section if section in ("projects", "experience") else "skills", rest, skills_context=True)
    return found


def _evidence_level(entry: Dict[str, Any], verified: bool) -> str:
    if verified:
        return "verified"
    return "demonstrated" if entry["regions"] & {"projects", "experience"} else "claimed"


EVIDENCE_WEIGHT = {"verified": 1.0, "demonstrated": 1.0, "claimed": 0.3}


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RES = [
    re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)"),
    re.compile(r"\+\d{1,3}[\s-]?\d[\d\s-]{7,12}\d"),
    re.compile(r"\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}"),
]
LINKEDIN_RE = re.compile(r"linkedin", re.I)
GITHUB_RE = re.compile(r"github\.com/[\w.-]+|github\s*[:|]\s*\S+", re.I)

BULLET_MARK = re.compile(r"^\s*(?:[•●▪■◦○·>*–—-]|o\s|\d+[.)]\s)\s*")
ACTION_VERBS = set("""
accelerated achieved analyzed analysed applied architected authored automated boosted built collaborated configured conducted
constructed containerized coordinated created customized debugged delivered deployed designed developed drove engineered enhanced
established evaluated executed extracted fine-tuned generated implemented improved increased initiated integrated launched led
maintained managed mentored migrated modeled modelled monitored optimized optimised orchestrated organized parsed performed
presented processed programmed published ranked reduced redesigned refactored researched resolved saved scaled secured simplified
solved spearheaded streamlined supported tested trained visualized won wrote cut
""".split())
MAX_BULLET_WORDS = 32
YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")
DEGREE_RE = re.compile(r"\b(?:b\.?\s?tech|b\.?\s?e\b|bachelor|m\.?\s?tech|master|bca|mca|b\.?\s?sc|m\.?\s?sc|diploma|mba|b\.?\s?com|ph\.?d|engineering|computer science)", re.I)
INSTITUTION_RE = re.compile(r"\b(?:university|college|institute|school|academy|iit|nit|iiit)\b", re.I)
GRADE_RE = re.compile(r"cgpa|gpa|percentage|\d+(?:\.\d+)?\s*%|\d(?:\.\d{1,2})?\s*/\s*10", re.I)


def _looks_like_title(line: str) -> bool:
    """'Library Management API | FastAPI, MongoDB' or 'Backend Intern, Acme Software, Jun 2025': a heading, not a bullet."""
    if "|" in line:
        return True
    words = line.split()
    return sum(1 for w in words if w[:1].isupper() or w[:1].isdigit()) >= 0.6 * len(words)


def extract_bullets(lines: List[str]) -> List[str]:
    bullets: List[str] = []
    for line in lines:
        stripped = BULLET_MARK.sub("", line).strip()
        if BULLET_MARK.match(line):
            bullets.append(stripped)
        elif bullets and stripped[:1].islower() and not bullets[-1].endswith("."):
            bullets[-1] += " " + stripped                     # a wrapped line continues the previous bullet
        elif len(stripped.split()) >= 6 and not _looks_like_title(stripped):
            bullets.append(stripped)
    return [b for b in bullets if len(b.split()) >= 4]


def _has_number(text: str) -> bool:
    text = YEAR_RE.sub("", text)
    return bool(re.search(r"\d", text))


def _starts_with_action_verb(bullet: str) -> bool:
    first = re.sub(r"[^A-Za-z-]", "", bullet.split()[0]).lower() if bullet.split() else ""
    return first in ACTION_VERBS


def text_hash(text: str) -> str:
    return hashlib.sha256(re.sub(r"\s+", " ", text.lower()).strip().encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Role requirements
# ---------------------------------------------------------------------------
def evaluate_requirements(labels: List[str], detected: Dict[str, Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
    """For each required-skill label: which catalog skill (if any) satisfies it."""
    lowered = text.lower()
    out = []
    for label in labels:
        alternatives = catalog.requirement_alternatives(label)
        hit = next((a for a in alternatives if a in detected), None)
        if not alternatives and label.lower() in lowered:   # label without a catalog skill: plain keyword match
            hit = label
        out.append({"label": label, "alternatives": alternatives, "matched_by": hit})
    return out


def _skill_gain_phrase(label: str, alternatives: Tuple[str, ...]) -> str:
    return alternatives[0] if alternatives else label


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------
def _round(value: float, cap: int) -> int:
    return max(0, min(cap, int(round(value))))


def analyze_resume_text(
    text: str,
    role: Dict[str, Any],
    *,
    jd_text: Optional[str] = None,
    verified: Optional[Dict[str, str]] = None,
    previous: Optional[Dict[str, Any]] = None,
    courses: Optional[List[Dict[str, Any]]] = None,
    meta: Optional[resume_extract.Extracted] = None,
) -> ResumeAnalysisResult:
    """Score resume text for one role. `role` is a career path document ({title, required_skills}).

    verified: skill name -> why (this student's own passed assessments / accepted submissions).
    previous: the student's last stored analysis, for the comparison.
    """
    clean = text.strip()
    if not clean:
        raise ValueError("Could not read any text from this resume.")
    verified = verified or {}
    parsed = parse_sections(clean)
    sections = parsed["sections"]
    detected = detect_skills(parsed)
    words = clean.split()
    title = role["title"]

    # ---- role requirements and the optional job description
    requirements = evaluate_requirements(list(role["required_skills"]), detected, clean)
    matched_reqs = [r for r in requirements if r["matched_by"]]
    missing_reqs = [r for r in requirements if not r["matched_by"]]
    role_match = int(round(100 * len(matched_reqs) / max(1, len(requirements))))

    jd: Optional[JdMatch] = None
    use_jd = False
    if jd_text and jd_text.strip():
        jd_found = detect_skills(parse_sections(jd_text.strip()))
        keywords = sorted(jd_found)
        matched_kw = [k for k in keywords if k in detected]
        missing_kw = [k for k in keywords if k not in detected]
        if len(keywords) >= 3:
            use_jd = True
            jd = JdMatch(keywords=keywords, matched=matched_kw, missing=missing_kw,
                         match_percent=int(round(100 * len(matched_kw) / len(keywords))))
        else:
            jd = JdMatch(keywords=keywords, matched=matched_kw, missing=missing_kw, match_percent=None,
                         note="Fewer than 3 recognizable skills were found in the job description, so the role requirements were used for scoring instead.")

    # ---- skills with evidence
    required_names = {a for r in requirements for a in r["alternatives"]}
    skill_rows = []
    for name, entry in sorted(detected.items()):
        level = _evidence_level(entry, name in verified)
        note = verified.get(name) or {"demonstrated": "Appears in your Projects or Experience.", "claimed": "Only listed, not shown in a project or job."}[level]
        skill_rows.append(SkillEvidence(name=name, category=catalog.SKILLS_BY_NAME[name].category, evidence=level,
                                        required=name in required_names, note=note))
    levels = {s.name: s.evidence for s in skill_rows}

    # ---- 1. keyword / skill match (30)
    if use_jd:
        ratio = jd.match_percent / 100
        kw_note = f"Matched {len(jd.matched)} of {len(jd.keywords)} keywords from the job description" + (f" (missing: {', '.join(jd.missing[:6])})." if jd.missing else ".")
    else:
        ratio = len(matched_reqs) / max(1, len(requirements))
        kw_note = f"Matched {len(matched_reqs)} of {len(requirements)} requirements for {title}" + (f" (missing: {', '.join(r['label'] for r in missing_reqs[:6])})." if missing_reqs else ".")
    kw_score = _round(30 * ratio, 30)

    # ---- 2. evidence quality (15): how well the matched skills are backed up
    matched_names = [r["matched_by"] for r in matched_reqs if r["matched_by"] in detected]
    if matched_names:
        avg = sum(EVIDENCE_WEIGHT[levels[n]] for n in matched_names) / len(matched_names)
        ev_score = _round(15 * avg, 15)
        claimed_only = [n for n in matched_names if levels[n] == "claimed"]
        ev_note = f"{len(matched_names) - len(claimed_only)} of {len(matched_names)} matched skills are shown in a project, a job or verified here" + (f"; only listed: {', '.join(claimed_only[:5])}." if claimed_only else ".")
    else:
        avg, claimed_only, ev_score = 0.0, [], 0
        ev_note = "No required skill was found, so there is nothing to back up yet."

    # ---- 3. contact and links (10)
    head_text = "\n".join(sections.get("header", [])[:12]) + "\n" + clean[:600]
    has_email = bool(EMAIL_RE.search(clean))
    has_phone = any(p.search(clean) for p in PHONE_RES)
    has_linkedin = bool(LINKEDIN_RE.search(clean))
    has_github = bool(GITHUB_RE.search(clean))
    contact_score = 3 * has_email + 3 * has_phone + 2 * has_linkedin + 2 * has_github
    absent = [n for n, ok in (("email", has_email), ("phone", has_phone), ("LinkedIn", has_linkedin), ("GitHub", has_github)) if not ok]
    contact_note = "Email, phone, LinkedIn and GitHub are all present." if not absent else f"Missing: {', '.join(absent)}."

    # ---- 4. section completeness and order (10)
    present = set(parsed["order"])
    has_experience = "experience" in present
    sec_points = {"skills": 2, "education": 2, "projects": 2, "experience": 2}
    sec_score = sum(p for s, p in sec_points.items() if s in present)
    sec_score += 1 if present & {"certifications", "achievements"} else 0
    contact_first = bool(EMAIL_RE.search(head_text) or any(p.search(head_text) for p in PHONE_RES))
    sec_score += 1 if contact_first else 0
    missing_secs = [s for s in sec_points if s not in present]
    sec_note = ("All core sections found" if not missing_secs else f"Missing sections: {', '.join(missing_secs)}") + ("; contact details are at the top." if contact_first else "; contact details are not at the top.")

    # ---- 5/6. bullets: quantified impact (10) and action verbs + length (10)
    bullet_lines = sections.get("projects", []) + sections.get("experience", []) + sections.get("achievements", [])
    bullets = extract_bullets(bullet_lines)
    quantified = [b for b in bullets if _has_number(b)]
    impact_score = _round(10 * len(quantified) / 3, 10)  # three quantified bullets earn full marks
    impact_note = f"{len(quantified)} of {len(bullets)} bullets contain a number; three or more earns full marks." if bullets else "No bullet points found in Projects or Experience."
    if bullets:
        with_verb = [b for b in bullets if _starts_with_action_verb(b)]
        good_len = [b for b in bullets if 6 <= len(b.split()) <= MAX_BULLET_WORDS]
        bullet_score = _round(6 * len(with_verb) / len(bullets) + 4 * len(good_len) / len(bullets), 10)
        bullet_note = f"{len(with_verb)} of {len(bullets)} bullets start with an action verb; {len(good_len)} are a good length (6 to {MAX_BULLET_WORDS} words)."
    else:
        with_verb, good_len, bullet_score = [], [], 0
        bullet_note = "No bullet points found, so action verbs and length could not be checked."

    # ---- 7. length and readability (5)
    n_words = len(words)
    lines_ = [l for l in clean.split("\n") if l.strip()]
    long_lines = sum(1 for l in lines_ if len(l) > 200)
    length_pts = 3 if 250 <= n_words <= 900 else 2 if 120 <= n_words < 250 else 1 if n_words > 900 else 0
    read_pts = 2 if lines_ and long_lines / len(lines_) < 0.1 else 0
    read_score = length_pts + read_pts
    read_note = f"{n_words} words (best: 250 to 900)" + ("; some lines are very long." if read_pts == 0 else "; lines are easy to scan.")

    # ---- 8. formatting risk (5)
    fmt = 5
    fmt_issues: List[str] = []
    if meta and meta.ocr_used:
        if (meta.ocr_confidence or 0) < resume_extract.LOW_CONFIDENCE:
            fmt -= 2; fmt_issues.append(f"low OCR confidence ({meta.ocr_confidence}%)")
        else:
            fmt -= 1; fmt_issues.append("the resume is a scan or photo; many ATS tools cannot read these")
    if meta and meta.has_tables:
        fmt -= 1; fmt_issues.append("tables or columns can scramble reading order")
    odd = sum(1 for c in clean if not (c.isalnum() or c.isspace() or c in ".,;:()/&+#%@'\"-–—•|[]!?_=*<>"))
    if odd / max(1, len(clean)) > 0.05:
        fmt -= 2; fmt_issues.append("many unusual symbols")
    if len(present) < 2:
        fmt -= 1; fmt_issues.append("no clear section headings were found")
    fmt_score = max(0, fmt)
    fmt_note = "No formatting risks found." if not fmt_issues else "Risks: " + "; ".join(fmt_issues) + "."

    # ---- 9. education details (5)
    edu_text = "\n".join(sections.get("education", []))
    edu_parts = {"degree": bool(DEGREE_RE.search(edu_text)), "institution": bool(INSTITUTION_RE.search(edu_text)),
                 "year": bool(YEAR_RE.search(edu_text)), "CGPA or percentage": bool(GRADE_RE.search(edu_text))}
    edu_score = 2 * edu_parts["degree"] + edu_parts["institution"] + edu_parts["year"] + edu_parts["CGPA or percentage"]
    edu_missing = [k for k, ok in edu_parts.items() if not ok]
    edu_note = ("Degree, institution, year and grade are all present." if not edu_missing else
                (f"Missing: {', '.join(edu_missing)}." if "education" in present else "No Education section found."))

    categories = [
        CategoryScore(key="keywords", label="Keyword and skill match", score=kw_score, max=30, explanation=kw_note),
        CategoryScore(key="evidence", label="Evidence quality", score=ev_score, max=15, explanation=ev_note),
        CategoryScore(key="contact", label="Contact and links", score=contact_score, max=10, explanation=contact_note),
        CategoryScore(key="sections", label="Sections and order", score=min(10, sec_score), max=10, explanation=sec_note),
        CategoryScore(key="impact", label="Quantified impact", score=impact_score, max=10, explanation=impact_note),
        CategoryScore(key="bullets", label="Action verbs and bullet quality", score=bullet_score, max=10, explanation=bullet_note),
        CategoryScore(key="readability", label="Length and readability", score=read_score, max=5, explanation=read_note),
        CategoryScore(key="formatting", label="Formatting risk", score=fmt_score, max=5, explanation=fmt_note),
        CategoryScore(key="education", label="Education details", score=edu_score, max=5, explanation=edu_note),
    ]
    overall = sum(c.score for c in categories)
    scores = {c.key: c.score for c in categories}

    # ---- bullet coach (templates, never rewritten claims)
    tips: List[BulletTip] = []
    for b in bullets:
        issues = []
        if not _starts_with_action_verb(b):
            issues.append("no action verb")
        if not _has_number(b):
            issues.append("no number")
        if len(b.split()) > MAX_BULLET_WORDS:
            issues.append("too long")
        if issues:
            tips.append((len(issues), b, issues))
    tips.sort(key=lambda t: -t[0])
    coach = []
    for _, b, issues in tips[:5]:
        mentioned = next(iter(catalog.scan(b)), None) or "<skill or tool>"
        advice = []
        if "no action verb" in issues:
            advice.append("Start with a verb for what you did (for example Built, Designed, Implemented), but only one that is true.")
        if "no number" in issues:
            advice.append("Add one real number: users, records, percent, milliseconds or hours.")
        if "too long" in issues:
            advice.append(f"Split it into two bullets of under {MAX_BULLET_WORDS} words: what you did, and the result.")
        coach.append(BulletTip(
            original=b[:300], issues=issues, advice=" ".join(advice),
            template=f"<Action verb> <what you built or did> using {mentioned} to <result, with a real number>.",
        ))

    # ---- ranked fixes with expected point gain
    fixes: List[Dict[str, Any]] = []
    per_req = 30 / max(1, len(requirements)) if not use_jd else 30 / max(1, len(jd.keywords))
    if use_jd:
        for kw in jd.missing[:3]:
            fixes.append(dict(category="keywords", names=[kw], title=f"Add the job-description keyword \"{kw}\"", points=per_req,
                              detail=f"The job description asks for {kw} and your resume does not mention it. Add it only if you have really used it.",
                              example=f"Skills: ..., {kw}   and a bullet such as: \"Built <what> using {kw} to <result with a number>.\""))
    else:
        for r in missing_reqs[:3]:
            name = _skill_gain_phrase(r["label"], r["alternatives"])
            fixes.append(dict(category="keywords", names=list(r["alternatives"]) or [r["label"]], title=f"Cover the {title} requirement \"{r['label']}\"", points=per_req,
                              detail=f"{title} roles list {r['label']}. Your resume does not mention it. If you have used it, add it; if not, learn it first.",
                              example=f"Skills: ..., {name}   and a bullet such as: \"Built <what> using {name} to <result with a number>.\""))
    for n in claimed_only[:2]:
        fixes.append(dict(category="evidence", names=[n], title=f"Show {n} in a project or internship, not only in Skills", points=15 * 0.7 / max(1, len(matched_names)),
                          detail=f"{n} is only listed in Skills. Recruiters trust skills that appear inside a project or job bullet.",
                          example=f"Project bullet: \"Implemented <feature> with {n}, <number> <users/records/tests>.\""))
    for label, ok, pts, ex in (("email address", has_email, 3, "name@example.com"), ("phone number", has_phone, 3, "+91 98xxxxxx12"),
                               ("LinkedIn link", has_linkedin, 2, "linkedin.com/in/your-name"), ("GitHub link", has_github, 2, "github.com/your-handle")):
        if not ok:
            fixes.append(dict(category="contact", title=f"Add your {label}", points=pts,
                              detail=f"Your {label} was not found. ATS tools and recruiters look for it at the top of the resume.", example=f"Header line: {ex}"))
    sec_example = {"skills": "SKILLS\nLanguages: ...\nTools: ...", "education": "EDUCATION\nB.Tech in <branch>, <college>, <year>, CGPA <x.x>",
                   "projects": "PROJECTS\n<Project name> | <tech used>\n- <Action verb> <what> using <skill> to <result with number>", "experience": "EXPERIENCE / INTERNSHIP\n<Role>, <company>, <months>\n- <bullet>"}
    for s in missing_secs:
        fixes.append(dict(category="sections", title=f"Add a {s.title()} section", points=sec_points[s],
                          detail=f"No {s} section was recognized. If you have no internship yet, a Projects section can carry the experience.", example=sec_example[s]))
    if len(quantified) < 3 and bullets:
        unquantified = next((b for b in bullets if not _has_number(b)), bullets[0])
        fixes.append(dict(category="impact", title="Put numbers in your bullets", points=10 - impact_score,
                          detail=f"Only {len(quantified)} bullet(s) contain a number. Numbers make your impact believable.",
                          example=f"Your bullet: \"{unquantified[:140]}\"  ->  add one real figure (users, records, %, ms, hours)."))
    elif not bullets:
        fixes.append(dict(category="impact", title="Write your projects and experience as bullet points", points=10,
                          detail="No bullet points were found under Projects or Experience, so impact and verbs could not be scored.",
                          example="- <Action verb> <what you built> using <skill> to <result with a number>"))
    weak_verbs = [b for b in bullets if not _starts_with_action_verb(b)]
    if weak_verbs:
        fixes.append(dict(category="bullets", title="Start bullets with an action verb", points=6 * len(weak_verbs) / len(bullets),
                          detail=f"{len(weak_verbs)} of {len(bullets)} bullets do not start with a strong verb (for example Built, Designed, Implemented).",
                          example=f"Your bullet: \"{weak_verbs[0][:120]}\"  ->  \"<Action verb> ... \" (use only a verb that is true)."))
    if length_pts < 3:
        fixes.append(dict(category="readability", title="Bring the resume to 250 to 900 words", points=3 - length_pts,
                          detail=f"Your resume has {n_words} words. " + ("Too short: add project detail." if n_words < 250 else "Too long: keep it to one or two pages."),
                          example="One page for a fresher: 4 to 6 bullets per project, 2 projects."))
    if fmt_score < 5:
        fixes.append(dict(category="formatting", title="Reduce formatting risk", points=5 - fmt_score, detail=fmt_note,
                          example="Export a text-based PDF or DOCX with one column and standard headings instead of a scan or photo."))
    for part in edu_missing:
        if "education" in present:
            fixes.append(dict(category="education", title=f"Add your {part} to Education", points=2 if part == "degree" else 1,
                              detail=f"The Education section does not show a {part}.", example="B.Tech in Computer Science, <college name>, 2022-2026, CGPA 8.2/10"))
    fixes.sort(key=lambda f: -f["points"])
    fix_models = []
    for f in fixes:
        pts = int(round(f["points"]))
        if pts >= 1 and len(fix_models) < 8:
            course = _course_for(f.get("names", []), courses or [])
            fix_models.append(ResumeFix(
                rank=len(fix_models) + 1, points=pts,
                course_slug=course["slug"] if course else None, course_title=course["title"] if course else None,
                **{k: v for k, v in f.items() if k not in ("points", "names")}))

    # ---- strengths, gaps, learning steps
    strengths = []
    for r in matched_reqs:
        name = r["matched_by"]
        if name in levels and levels[name] in ("verified", "demonstrated"):
            reason = verified.get(name) or f"{name} appears in your Projects or Experience, which satisfies \"{r['label']}\"."
            strengths.append(ResumeStrength(skill=name, reason=reason))
    gaps = [ResumeGap(skill=r["label"], reason=f"{title} roles require this and it was not found in your resume.") for r in missing_reqs]
    learning = _learning_steps(missing_reqs, courses or [])

    strong = [n for n, lv in levels.items() if lv in ("verified", "demonstrated")]
    band = "High" if overall >= 75 else "Moderate" if overall >= 50 else "Low"

    # ---- company benchmarks (derived from the same detected skills)
    company_matches = []
    for comp in COMPANY_BENCHMARKS:
        got = [s for s in comp["required_skills"] if s in detected]
        pct = int(100 * len(got) / len(comp["required_skills"]))
        company_matches.append(CompanyMatch(
            company=comp["company"], role=comp["role"], match_percentage=pct,
            status="Eligible" if pct >= 75 else "Possibly Eligible" if pct >= 55 else "Needs Skill Improvement",
            missing_skills=[s for s in comp["required_skills"] if s not in detected], location=comp["location"]))

    result = ResumeAnalysisResult(
        overall_score=overall,
        headline=f"{band} ATS-style match for {title}",
        recommended_path=title,
        extracted_text_snippet=(clean[:350] + "...") if len(clean) > 350 else clean,
        detected_skills=sorted(detected), strong_skills=sorted(strong),
        missing_skills=[r["label"] for r in missing_reqs],
        strengths=strengths, gaps=gaps, company_matches=company_matches,
        recommendations=[f.title for f in fix_models[:3]],
        ats_compatibility=band, parsed_skills=sorted(detected), missing_critical_skills=[r["label"] for r in missing_reqs],
        categories=categories, fixes=fix_models, skills=skill_rows, role_match=role_match,
        skill_contexts=_skill_contexts(parsed),
        matched_requirements=[r["label"] for r in matched_reqs], missing_requirements=[r["label"] for r in missing_reqs],
        jd=jd, bullet_coach=coach, learning_steps=learning,
        comparison=_compare(previous, overall, scores),
        extracted_text=clean, text_hash=text_hash(clean),
        source=meta.kind if meta else "text", ocr_used=bool(meta and meta.ocr_used), ocr_engine=meta.engine if meta else None,
        ocr_confidence=meta.ocr_confidence if meta else None, pages_processed=meta.pages_processed if meta else 1,
        warnings=list(meta.warnings) if meta else [],
    )
    return result


def _course_for(names: List[str], courses: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The first catalog course that covers one of these skills, if any."""
    wanted = {n.lower() for n in names}
    return next((c for c in courses if wanted & {str(s).lower() for s in c.get("skills", [])}), None)


def _learning_steps(missing: List[Dict[str, Any]], courses: List[Dict[str, Any]]) -> List[LearningStep]:
    """A real course when the courses collection has one for that skill; otherwise a plain 'Learn <skill>'. No links invented."""
    steps = []
    for r in missing[:8]:
        wanted = {r["label"].lower()} | {a.lower() for a in r["alternatives"]}
        course = next((c for c in courses if wanted & {str(s).lower() for s in c.get("skills", [])}), None)
        if course:
            steps.append(LearningStep(skill=r["label"], title=course["title"], course_slug=course.get("slug"), kind="course"))
        else:
            steps.append(LearningStep(skill=r["label"], title=f"Learn {r['label']}", kind="plain"))
    return steps


def _compare(previous: Optional[Dict[str, Any]], overall: int, scores: Dict[str, int]) -> Optional[Comparison]:
    if not previous or "overall_score" not in previous:
        return None
    changes = []
    old = {c.get("key"): c for c in previous.get("categories", []) if isinstance(c, dict)}
    for key, new_score in scores.items():
        if key in old and old[key].get("score") is not None and old[key]["score"] != new_score:
            diff = new_score - old[key]["score"]
            changes.append(f"{key}: {'+' if diff > 0 else ''}{diff}")
    created = previous.get("created_at")
    return Comparison(previous_score=int(previous["overall_score"]), delta=overall - int(previous["overall_score"]),
                      previous_date=created.isoformat() if isinstance(created, datetime) else None, changes=changes)


def _skill_contexts(parsed: Dict[str, Any]) -> Dict[str, str]:
    """skill -> the first project or job (its title line) whose text mentions it. Used to phrase interview prompts."""
    contexts: Dict[str, str] = {}
    for section in ("projects", "experience"):
        blocks: List[Tuple[str, List[str]]] = []
        for line in parsed["sections"].get(section, []):
            is_title = not BULLET_MARK.match(line) and len(line.split()) <= 14 and _looks_like_title(line)
            if is_title or not blocks:
                blocks.append((re.split(r"[|,]| - ", line)[0].strip()[:60], [line]))
            else:
                blocks[-1][1].append(line)
        for name, lines in blocks:
            for skill in catalog.scan("\n".join(lines)):
                contexts.setdefault(skill, name)
    return contexts


def stored_record(result: ResumeAnalysisResult, jd_used: bool) -> Dict[str, Any]:
    """What is saved per analysis: scores and skills only. Never the file, never the full text (just its hash)."""
    return {
        "id": uuid.uuid4().hex, "skill_levels": {s.name: s.evidence for s in result.skills},
        "skill_contexts": result.skill_contexts,
        "overall_score": result.overall_score, "career_path": result.recommended_path, "recommended_path": result.recommended_path,
        "jd_used": jd_used, "jd_match": result.jd.match_percent if result.jd else None,
        "categories": [{"key": c.key, "score": c.score, "max": c.max} for c in result.categories],
        "detected_skills": result.detected_skills, "strong_skills": result.strong_skills, "missing_skills": result.missing_skills,
        "top_fixes": [{"title": f.title, "points": f.points} for f in result.fixes[:5]],  # for the career report
        "text_hash": result.text_hash, "source": result.source, "ocr_used": result.ocr_used,
        "ocr_confidence": result.ocr_confidence, "word_count": len(result.extracted_text.split()),
    }


# ---------------------------------------------------------------------------
# Verified skills: this student's own data only
# ---------------------------------------------------------------------------
ASSESSMENT_SKILLS = {
    "python": ["Python"], "javascript": ["JavaScript"], "react": ["React"], "dsa": ["DSA"],
    "sql & databases": ["SQL", "DBMS"], "ai / machine learning": ["Machine Learning"],
}
LANGUAGE_SKILLS = {"python": "Python", "java": "Java", "c": "C", "cpp": "C++", "javascript": "JavaScript"}
PASS_PERCENT = 60


async def verified_skills(user_id: str) -> Dict[str, str]:
    """skill -> why. A skill is verified when THIS student passed an assessment for it or has an Accepted submission in it."""
    from app.repositories import assessment_bank, attempts, practice

    verified: Dict[str, str] = {}
    set_skill: Dict[str, str] = {}
    for attempt in await attempts.for_user(user_id):
        if attempt.get("overall_score", 0) < PASS_PERCENT:
            continue
        aid = attempt.get("assessment_id")
        if aid not in set_skill:
            found = await assessment_bank.get_set(aid) if aid else None
            set_skill[aid] = (found or {}).get("skill", "")
        for name in ASSESSMENT_SKILLS.get(set_skill[aid].lower(), []):
            verified.setdefault(name, f"You passed the {set_skill[aid]} assessment ({attempt['overall_score']}%).")
    accepted = [a for a in await practice.attempts_for_user(user_id) if a.get("verdict") == "Accepted"]
    for a in accepted:
        name = LANGUAGE_SKILLS.get(str(a.get("language", "")).lower())
        if name:
            verified.setdefault(name, f"You have an Accepted {name} solution in Coding Practice.")
    if accepted:
        verified.setdefault("DSA", "You have Accepted solutions in Coding Practice.")
    return verified
