"""Seed data. Loaded into MongoDB by `python -m app.seed` (idempotent upserts)."""
from app.utils.timeutil import utcnow

INITIAL_PAPERS = [
    {
        "id": "qp-2025-01",
        "company": "TCS (Tata Consultancy Services)",
        "exam": "TCS NQT — National Qualifier Test",
        "year": 2025,
        "paper_type": "Mixed (MCQ + Coding)",
        "role": "Systems Engineer / Digital Cadre",
        "description": "Full placement question paper with coding problems and technical MCQ sections.",
        "questions_count": 48,
        "status": "Extracted",
        "uploaded_at": utcnow(),
    },
    {
        "id": "qp-2025-02",
        "company": "Infosys",
        "exam": "Infosys Specialist Programmer Assessment",
        "year": 2025,
        "paper_type": "Coding",
        "role": "Specialist Programmer (Power Programmer)",
        "description": "3 Advanced Data Structure and Dynamic Programming coding challenges.",
        "questions_count": 3,
        "status": "Extracted",
        "uploaded_at": utcnow(),
    },
    {
        "id": "qp-2024-03",
        "company": "Accenture",
        "exam": "Accenture Technical & Cognitive Assessment",
        "year": 2024,
        "paper_type": "Technical MCQ",
        "role": "Associate Software Engineer",
        "description": "50 Technical MCQs covering SQL, Pseudocode, Networking, and Cloud.",
        "questions_count": 50,
        "status": "Approved",
        "uploaded_at": utcnow(),
    },
]
