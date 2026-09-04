import io
import re
from typing import List
from app.models.resume import ResumeAnalysisResult, ResumeStrength, ResumeGap

# Try pypdf (modern) first, then PyPDF2 as fallback
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

TECH_SKILLS_KEYWORDS = [
    "python", "java", "c++", "c#", "javascript", "typescript", "react", "angular", "vue",
    "fastapi", "django", "flask", "node.js", "nodejs", "express", "sql", "postgresql", "mysql",
    "mongodb", "redis", "docker", "kubernetes", "aws", "azure", "gcp", "git", "linux",
    "dsa", "data structures", "algorithms", "rest api", "restful", "graphql", "system design",
    "microservices", "machine learning", "deep learning", "ai", "pandas", "numpy",
    "tensorflow", "pytorch", "scikit-learn", "nlp", "spark", "kafka",
    "spring", "spring boot", "hibernate", "junit", "maven", "gradle",
    "html", "css", "sass", "tailwind", "webpack", "vite", "next.js", "nextjs",
    "github", "gitlab", "ci/cd", "jenkins", "terraform", "ansible",
    "selenium", "pytest", "jest", "cypress",
]

CAREER_REQUIRED_SKILLS = {
    "Frontend Developer": ["React", "Javascript", "Html", "Css", "Typescript", "Git"],
    "Backend Developer": ["Python", "Sql", "Rest Api", "Fastapi", "Docker", "System Design", "Mongodb"],
    "Full Stack Developer": ["React", "Node.Js", "Sql", "Mongodb", "Docker", "Git", "Rest Api"],
    "Python Developer": ["Python", "Fastapi", "Sql", "Docker", "Pandas", "Git", "Pytest"],
    "Java Developer": ["Java", "Spring", "Sql", "Maven", "Docker", "Junit", "Git"],
    "Data Analyst": ["Sql", "Python", "Pandas", "Numpy", "Excel", "Matplotlib"],
    "Data Scientist": ["Python", "Machine Learning", "Pandas", "Numpy", "Tensorflow", "Sql"],
    "AI / ML Engineer": ["Python", "Tensorflow", "Pytorch", "Nlp", "Numpy", "Pandas", "Scikit-Learn"],
    "Cloud / DevOps Engineer": ["Docker", "Kubernetes", "Aws", "Terraform", "Linux", "Git"],
}

def extract_text_from_pdf(file_bytes: bytes) -> str:
    if _USE_PYPDF:
        try:
            reader = ModernPdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text
        except Exception:
            pass
    # Fallback to PyPDF2
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text
    except Exception:
        return ""

def extract_text_from_docx(file_bytes: bytes) -> str:
    if _HAS_DOCX:
        try:
            doc = python_docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except Exception:
            pass
    return ""

def analyze_resume_text(text: str, career_path: str = "Backend Developer") -> ResumeAnalysisResult:
    cleaned = text.lower()
    found_skills = []

    for skill in TECH_SKILLS_KEYWORDS:
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, cleaned):
            found_skills.append(skill.title())

    found_skills = sorted(list(set(found_skills)))

    # Calculate ATS score
    base_score = 45
    skill_bonus = min(len(found_skills) * 4, 45)
    overall_score = min(base_score + skill_bonus, 97)

    required_skills = CAREER_REQUIRED_SKILLS.get(career_path, CAREER_REQUIRED_SKILLS["Backend Developer"])
    strengths = []
    gaps = []

    matched_required = [s for s in found_skills if s in required_skills]
    missing_required = [s for s in required_skills if s not in found_skills]

    for s in (matched_required or found_skills)[:5]:
        strengths.append(ResumeStrength(skill=s, reason=f"Matched against {career_path} corporate placement filters."))

    if not strengths:
        strengths = [
            ResumeStrength(skill="Core Programming Fundamentals", reason="Foundational competency identified."),
            ResumeStrength(skill="Problem Solving", reason="Demonstrated through project-based experience."),
        ]

    for req in missing_required[:4]:
        gaps.append(ResumeGap(skill=req, reason=f"Critical skill for {career_path} recruitment drives."))

    if not gaps:
        gaps = [
            ResumeGap(skill="System Design and Scalability", reason="Essential for senior placement opportunities."),
            ResumeGap(skill="Docker Containerization", reason="Critical for modern cloud deployment pipelines."),
        ]

    snippet = (text[:300] + "...") if len(text) > 300 else text

    return ResumeAnalysisResult(
        overall_score=overall_score,
        headline=f"{'High' if overall_score >= 80 else 'Moderate'} ATS Compatibility for {career_path}",
        recommended_path=career_path,
        extracted_text_snippet=snippet,
        strengths=strengths,
        gaps=gaps,
        ats_compatibility="High" if overall_score >= 80 else "Moderate",
        parsed_skills=found_skills if found_skills else ["Python", "SQL", "Git"],
        missing_critical_skills=[g.skill for g in gaps],
    )
