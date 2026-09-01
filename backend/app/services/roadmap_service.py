from typing import List, Optional
from app.models.roadmap import RoadmapMilestone, RoadmapResponse
from app.data.career_config import get_career_path_by_id_or_title

def generate_personalized_roadmap(career_path: str, skill_gaps: Optional[List[str]] = None) -> RoadmapResponse:
    """Generate career-specific roadmap influenced by assessment results and skill gaps"""
    config = get_career_path_by_id_or_title(career_path)
    milestones_raw = config.get("milestones", [])
    gaps = [g.lower() for g in (skill_gaps or [])]

    processed_milestones = []
    completed_count = 0
    total_milestones = len(milestones_raw)
    current_milestone_num = 1

    for idx, m in enumerate(milestones_raw):
        m_copy = dict(m)
        m_skills = [s.lower() for s in m_copy.get("skills", [])]
        
        # Check if any skill in this milestone is in student's skill gaps
        has_gap = any(any(g in s or s in g for g in gaps) for s in m_skills)
        m_copy["is_priority_gap"] = has_gap

        # Initial status heuristics if not explicitly set
        if idx == 0:
            m_copy["status"] = "completed"
            completed_count += 1
        elif idx == 1 and not has_gap:
            m_copy["status"] = "completed"
            completed_count += 1
        elif idx == 2 or (has_gap and idx < 4):
            m_copy["status"] = "in_progress"
            current_milestone_num = m_copy.get("number", idx + 1)
        else:
            m_copy["status"] = "locked"

        if has_gap and m_copy["status"] != "completed":
            m_copy["action_label"] = f"Priority Skill Gap: Practice Now ↗"

        processed_milestones.append(RoadmapMilestone(**m_copy))

    completion_percentage = int((completed_count / total_milestones) * 100) if total_milestones > 0 else 0

    return RoadmapResponse(
        career_path=config.get("title", career_path),
        current_milestone=current_milestone_num,
        completion_percentage=completion_percentage,
        milestones=processed_milestones,
    )
