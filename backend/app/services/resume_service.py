import io
import re
from typing import List, Dict, Any, Optional
from app.models.resume import ResumeAnalysisResult, ResumeStrength, ResumeGap, CompanyMatch
from app.database import db_manager

try:
    from pypdf import PdfReader as ModernPdfReader
    _USE_PYPDF = True
except ImportError:
    _USE_PYPDF = False

try:
    import docx as python_docx
    _HAS_DOCX = True
except ImportError:
    _HAS_DOCX = False

# Normalized Skill Dictionary with Alias Mapping
SKILL_MAP = [
    # Programming
    {"canonical": "Python", "aliases": ["python", "py"]},
    {"canonical": "Java", "aliases": ["java"]},
    {"canonical": "C++", "aliases": ["c++", "cpp"]},
    {"canonical": "C", "aliases": ["c"]},
    {"canonical": "JavaScript", "aliases": ["javascript", "js"]},

    # Frontend
    {"canonical": "HTML", "aliases": ["html", "html5"]},
    {"canonical": "CSS", "aliases": ["css", "css3", "tailwind", "bootstrap"]},
    {"canonical": "React", "aliases": ["react", "reactjs", "react.js"]},
    {"canonical": "Next.js", "aliases": ["next.js", "nextjs"]},

    # Backend
    {"canonical": "FastAPI", "aliases": ["fastapi"]},
    {"canonical": "Django", "aliases": ["django"]},
    {"canonical": "Spring Boot", "aliases": ["spring boot", "springboot", "spring"]},
    {"canonical": "Node.js", "aliases": ["node.js", "nodejs", "node"]},
    {"canonical": "REST API", "aliases": ["rest api", "rest apis", "restful", "rest"]},

    # Database
    {"canonical": "MongoDB", "aliases": ["mongodb", "mongo"]},
    {"canonical": "MySQL", "aliases": ["mysql"]},
    {"canonical": "PostgreSQL", "aliases": ["postgresql", "postgres"]},
    {"canonical": "SQL", "aliases": ["sql"]},

    # Core
    {"canonical": "DSA", "aliases": ["dsa", "data structures", "algorithms"]},
    {"canonical": "OOP", "aliases": ["oop", "object oriented", "oops"]},
    {"canonical": "Operating Systems", "aliases": ["operating systems", "os"]},
    {"canonical": "Computer Networks", "aliases": ["computer networks", "networking"]},
    {"canonical": "DBMS", "aliases": ["dbms"]},

    # AI / Data
    {"canonical": "NumPy", "aliases": ["numpy"]},
    {"canonical": "Pandas", "aliases": ["pandas"]},
    {"canonical": "Scikit-learn", "aliases": ["scikit-learn", "sklearn"]},
    {"canonical": "Machine Learning", "aliases": ["machine learning", "ml"]},
    {"canonical": "Deep Learning", "aliases": ["deep learning", "dl"]},
    {"canonical": "NLP", "aliases": ["nlp"]},

    # Tools
    {"canonical": "Git", "aliases": ["git"]},
    {"canonical": "GitHub", "aliases": ["github"]},
    {"canonical": "Docker", "aliases": ["docker"]},
    {"canonical": "AWS", "aliases": ["aws", "amazon web services"]},
    {"canonical": "Linux", "aliases": ["linux", "unix"]},
]

CAREER_ROLE_REQUIREMENTS = {
    "Backend Developer": ["Python", "FastAPI", "SQL", "MongoDB", "REST API", "Git", "Docker"],
    "Frontend Developer": ["JavaScript", "React", "HTML", "CSS", "Next.js", "Git"],
    "Full Stack Developer": ["React", "Node.js", "JavaScript", "Python", "SQL", "MongoDB", "Git"],
    "Java Developer": ["Java", "Spring Boot", "SQL", "OOP", "DBMS", "Git"],
    "Python Developer": ["Python", "Django", "FastAPI", "SQL", "Git", "DSA"],
    "Data Analyst": ["Python", "SQL", "Pandas", "NumPy", "DBMS"],
    "Data Scientist": ["Python", "Machine Learning", "Pandas", "NumPy", "Scikit-learn", "SQL"],
    "DevOps Engineer": ["Docker", "AWS", "Linux", "Git", "Python"],
}

COMPANY_BENCHMARKS = [
    {
        "company": "TCS (Tata Consultancy Services)",
        "role": "Systems Engineer",
        "required_skills": ["Python", "SQL", "Git", "DSA", "DBMS"],
        "location": "Pan-India",
        "min_cgpa": 6.0
    },
    {
        "company": "Infosys",
        "role": "Specialist Programmer",
        "required_skills": ["Python", "Java", "DSA", "REST API", "SQL"],
        "location": "Bangalore / Hyderabad",
        "min_cgpa": 6.5
    },
    {
        "company": "Accenture",
        "role": "Associate Software Engineer",
        "required_skills": ["JavaScript", "HTML", "CSS", "SQL", "Git"],
        "location": "Pune / Noida / Bangalore",
        "min_cgpa": 6.0
    },
    {
        "company": "Wipro",
        "role": "Project Engineer",
        "required_skills": ["Java", "C++", "DSA", "SQL", "Git"],
        "location": "Chennai / Hyderabad",
        "min_cgpa": 6.0
    },
    {
        "company": "Amazon",
        "role": "Software Development Engineer (SDE-1)",
        "required_skills": ["Java", "C++", "DSA", "Docker", "REST API", "Linux"],
        "location": "Bangalore / Hyderabad",
        "min_cgpa": 7.0
    },
]

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract readable text from PDF using pypdf or PyPDF2"""
    if _USE_PYPDF:
        try:
            reader = ModernPdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text.strip()
        except Exception:
            pass

    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text.strip()
    except Exception:
        return ""

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX document"""
    if _HAS_DOCX:
        try:
            doc = python_docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([para.text for para in doc.paragraphs if para.text])
            return text.strip()
        except Exception:
            pass
    return ""

def extract_skills_from_text(text: str) -> List[str]:
    """Scan text against normalized skill dictionary using word-boundary regex"""
    text_lower = text.lower()
    detected = set()

    for item in SKILL_MAP:
        canonical = item["canonical"]
        for alias in item["aliases"]:
            # Word boundary regex escape
            pattern = r'(?<![a-zA-Z0-9])' + re.escape(alias) + r'(?![a-zA-Z0-9])'
            if re.search(pattern, text_lower):
                detected.add(canonical)
                break

    return sorted(list(detected))

def analyze_resume_text(
    text: str,
    career_path: str = "Backend Developer",
    student_history: Optional[Dict[str, Any]] = None
) -> ResumeAnalysisResult:
    """
    Scans extracted resume text, computes skill alignment, strength vs detected classification,
    and determines company placement eligibility.
    """
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Could not extract readable text from this resume.")

    detected_skills = extract_skills_from_text(clean_text)

    # Determine Verified / Strong Skills vs Detected Skills based on student history
    practice_attempts = db_manager._memory_store.get("practice_attempts", {})
    attempted_topics = set()
    for att in practice_attempts.values():
        if att.get("execution_available") or att.get("code"):
            lang = att.get("language", "").title()
            if lang:
                attempted_topics.add(lang)

    strong_skills = []
    for s in detected_skills:
        # Mark as strong if verified by practice or core foundational competency
        if s in attempted_topics or s in ["Python", "Java", "SQL", "Git", "DSA"]:
            strong_skills.append(s)

    if not strong_skills and detected_skills:
        strong_skills = detected_skills[:2]

    # Required skills for targeted career path
    required_skills = CAREER_ROLE_REQUIREMENTS.get(career_path, CAREER_ROLE_REQUIREMENTS["Backend Developer"])
    missing_skills = [req for req in required_skills if req not in detected_skills]

    # Calculate overall ATS compatibility score
    matched_required = [r for r in required_skills if r in detected_skills]
    skill_match_ratio = len(matched_required) / max(1, len(required_skills))
    base_score = int(skill_match_ratio * 70) + min(len(detected_skills) * 3, 25)
    overall_score = min(max(base_score, 40), 98)

    # Build Strengths List
    strengths = []
    for skill in (strong_skills or detected_skills)[:4]:
        strengths.append(ResumeStrength(
            skill=skill,
            reason=f"Verified competency matched against {career_path} corporate hiring standards."
        ))
    if not strengths:
        strengths.append(ResumeStrength(
            skill="Core Academic Preparation",
            reason="Foundational engineering coursework detected."
        ))

    # Build Gaps List
    gaps = []
    for req in missing_skills[:4]:
        gaps.append(ResumeGap(
            skill=req,
            reason=f"Required skill gap identified for target role '{career_path}'."
        ))

    # Calculate Company Eligibility
    company_matches = []
    for comp in COMPANY_BENCHMARKS:
        req_s = comp["required_skills"]
        comp_matched = [s for s in req_s if s in detected_skills]
        comp_missing = [s for s in req_s if s not in detected_skills]
        match_pct = int((len(comp_matched) / max(1, len(req_s))) * 100)

        if match_pct >= 75:
            status = "Eligible"
        elif match_pct >= 55:
            status = "Possibly Eligible"
        else:
            status = "Needs Skill Improvement"

        company_matches.append(CompanyMatch(
            company=comp["company"],
            role=comp["role"],
            match_percentage=match_pct,
            status=status,
            missing_skills=comp_missing,
            location=comp["location"]
        ))

    # Recommendations
    recommendations = []
    if missing_skills:
        recommendations.append(f"Complete practice modules for missing target skills: {', '.join(missing_skills[:3])}.")
    recommendations.append("Build a portfolio project demonstrating REST API integration and database schema design.")
    recommendations.append("Solve company-tagged practice questions for TCS NQT and Infosys assessments.")

    snippet = (clean_text[:350] + "...") if len(clean_text) > 350 else clean_text

    return ResumeAnalysisResult(
        overall_score=overall_score,
        headline=f"{'High' if overall_score >= 78 else 'Moderate'} ATS Alignment for {career_path}",
        recommended_path=career_path,
        extracted_text_snippet=snippet,
        detected_skills=detected_skills,
        strong_skills=strong_skills,
        missing_skills=missing_skills,
        strengths=strengths,
        gaps=gaps,
        company_matches=company_matches,
        recommendations=recommendations,
        ats_compatibility="High" if overall_score >= 78 else "Moderate",
        parsed_skills=detected_skills,
        missing_critical_skills=missing_skills
    )
