from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from app.models.placement import PlacementJob
from app.models.user import UserOut
from app.utils.security import get_current_user
from app.database import db_manager

router = APIRouter(prefix="/placements", tags=["Placements"])

MOCK_PLACEMENT_JOBS = [
    {
        "id": "job-tcs-01",
        "company": "TCS (Tata Consultancy Services)",
        "role": "Systems Engineer — Digital Cadre",
        "package": "₹7.0 - ₹9.0 LPA",
        "location": "Pan India / Hybrid",
        "deadline": "March 15, 2026",
        "match_percentage": 92,
        "status": "Ready to Apply",
        "hiring_batch": "2025 & 2026 Batch",
        "required_skills": ["Python / Java", "SQL & DBMS", "Data Structures", "REST APIs"],
        "missing_skills": [],
        "description": "TCS Digital Cadre hiring for engineering candidates proficient in algorithms, database design, and web APIs.",
    },
    {
        "id": "job-inf-02",
        "company": "Infosys",
        "role": "Specialist Programmer (Power Programmer)",
        "package": "₹9.5 LPA",
        "location": "Bangalore / Hyderabad / Pune",
        "deadline": "March 20, 2026",
        "match_percentage": 88,
        "status": "Ready to Apply",
        "hiring_batch": "2026 Batch",
        "required_skills": ["Data Structures & Algorithms", "Python / C++", "FastAPI / Spring Boot", "System Architecture"],
        "missing_skills": ["System Architecture"],
        "description": "High-tier coding role at Infosys focused on developing scalable platforms and distributed systems.",
    },
    {
        "id": "job-acc-03",
        "company": "Accenture",
        "role": "Advanced Associate Software Engineer",
        "package": "₹6.5 - ₹8.0 LPA",
        "location": "Bangalore / Gurgaon / Chennai",
        "deadline": "April 05, 2026",
        "match_percentage": 94,
        "status": "Ready to Apply",
        "hiring_batch": "2026 Batch",
        "required_skills": ["Python 3", "Relational Databases", "Web Technologies", "Git"],
        "missing_skills": [],
        "description": "Work on global enterprise application transformation and high-performance software engineering teams.",
    },
    {
        "id": "job-amz-04",
        "company": "Amazon",
        "role": "Software Development Engineer (SDE-1)",
        "package": "₹16.0 - ₹24.0 LPA",
        "location": "Hyderabad / Bangalore",
        "deadline": "April 10, 2026",
        "match_percentage": 68,
        "status": "Skill Gap Identified",
        "hiring_batch": "2026 Graduating Batch",
        "required_skills": ["Advanced DSA", "System Design", "Distributed Systems", "Multi-threading", "Java / Python"],
        "missing_skills": ["System Design", "Distributed Systems"],
        "description": "Build high-throughput customer-facing services supporting millions of concurrent transactions.",
    },
    {
        "id": "job-cap-05",
        "company": "Capgemini",
        "role": "Senior Analyst — Backend Engineering",
        "package": "₹5.75 - ₹7.5 LPA",
        "location": "Mumbai / Pune / Noida",
        "deadline": "March 28, 2026",
        "match_percentage": 89,
        "status": "Ready to Apply",
        "hiring_batch": "2025 & 2026 Batch",
        "required_skills": ["Python / Java", "SQL Indexing", "REST APIs", "Microservices"],
        "missing_skills": ["Microservices"],
        "description": "Cloud native and microservices development for tier-1 financial and retail enterprise accounts.",
    },
]

# Seed placements into memory store
for job in MOCK_PLACEMENT_JOBS:
    db_manager._memory_store["placements"][job["id"]] = job

@router.get("", response_model=List[PlacementJob])
async def get_placement_jobs(current_user: Optional[UserOut] = Depends(get_current_user)):
    user_skills = [s.lower() for s in current_user.strong_skills] if current_user and current_user.strong_skills else ["python", "sql", "rest apis"]
    
    jobs = list(db_manager._memory_store["placements"].values())
    if db_manager.is_connected and db_manager.db is not None:
        try:
            cursor = db_manager.db["placements"].find({})
            db_jobs = await cursor.to_list(length=100)
            if db_jobs:
                jobs = db_jobs
        except Exception:
            pass

    # Dynamic match calculation based on student skills
    results = []
    for j in jobs:
        req_skills = j.get("required_skills", [])
        matched_count = 0
        missing = []
        for req in req_skills:
            req_clean = req.lower()
            if any(us in req_clean or req_clean in us for us in user_skills):
                matched_count += 1
            else:
                missing.append(req)
        
        match_score = int((matched_count / len(req_skills)) * 100) if req_skills else 85
        match_score = max(match_score, 65)  # Baseline candidate score

        job_copy = dict(j)
        job_copy["match_percentage"] = match_score
        job_copy["missing_skills"] = missing[:2]
        job_copy["status"] = "Ready to Apply" if match_score >= 80 else "Skill Gap Identified"
        results.append(PlacementJob(**job_copy))

    return results

@router.get("/{job_id}", response_model=PlacementJob)
async def get_placement_job_by_id(job_id: str, current_user: Optional[UserOut] = Depends(get_current_user)):
    job = db_manager._memory_store["placements"].get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Placement opportunity not found")
    return PlacementJob(**job)
