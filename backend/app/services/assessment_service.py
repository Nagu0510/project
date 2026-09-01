from typing import Dict, List, Optional
import uuid
from app.data.assessment_bank import (
    ASSESSMENT_QUESTION_BANK,
    ASSESSMENT_SETS,
    get_questions_dict,
    get_assessments_list,
)
from app.models.assessment import (
    AssessmentQuestion,
    AssessmentSummary,
    AssessmentDetail,
    AssessmentResult,
    TopicScore,
    PracticeVerifyResponse,
)

# Build question lookup map
QUESTIONS_MAP = get_questions_dict()

def get_available_assessments(career_path: Optional[str] = None, difficulty: Optional[str] = None, skill: Optional[str] = None) -> List[AssessmentSummary]:
    """Return filtered assessment catalog summaries"""
    sets = get_assessments_list(career_path, difficulty, skill)
    return [
        AssessmentSummary(
            id=s["id"],
            title=s["title"],
            skill=s["skill"],
            career_path=s["career_path"],
            difficulty=s["difficulty"],
            questions_count=s["questions_count"],
            duration_minutes=s["duration_minutes"],
            best_score=None,
            attempts_count=0,
        )
        for s in sets
    ]

def get_assessment_detail(assessment_id: str, strip_answers: bool = True) -> Optional[AssessmentDetail]:
    """Retrieve assessment with questions (with answers strictly stripped for candidates)"""
    # Find matching assessment set or fallback
    target_set = next((s for s in ASSESSMENT_SETS if s["id"] == assessment_id), None)
    if not target_set:
        # Fallback to first available set
        target_set = ASSESSMENT_SETS[0]

    q_ids = target_set["question_ids"]
    questions = []
    for idx, qid in enumerate(q_ids):
        raw_q = QUESTIONS_MAP.get(qid)
        if raw_q:
            q_copy = dict(raw_q)
            q_copy["number"] = idx + 1
            if strip_answers:
                q_copy["correct_option_index"] = None  # Hide answer key
            questions.append(AssessmentQuestion(**q_copy))

    return AssessmentDetail(
        id=target_set["id"],
        title=target_set["title"],
        skill=target_set["skill"],
        career_path=target_set["career_path"],
        difficulty=target_set["difficulty"],
        questions_count=len(questions),
        duration_minutes=target_set["duration_minutes"],
        questions=questions,
    )

def evaluate_assessment_submission(
    user_id: str,
    assessment_id: str,
    answers: Dict[str, int],
    time_taken_seconds: int,
) -> AssessmentResult:
    """Evaluate candidate answers against ground truth question bank on backend"""
    target_set = next((s for s in ASSESSMENT_SETS if s["id"] == assessment_id), None)
    if not target_set:
        target_set = ASSESSMENT_SETS[0]

    q_ids = target_set["question_ids"]
    total_questions = len(q_ids)
    correct_count = 0
    topic_map = {}
    strengths = []
    skill_gaps = []

    for qid in q_ids:
        raw_q = QUESTIONS_MAP.get(qid)
        if not raw_q:
            continue

        topic = raw_q.get("topic", "General Engineering")
        skill_name = raw_q.get("skill", "Core Concepts")
        correct_idx = raw_q.get("correct_option_index", 0)

        if topic not in topic_map:
            topic_map[topic] = {"score": 0, "total": 0}
        topic_map[topic]["total"] += 1

        user_ans = answers.get(qid)
        if user_ans is not None and user_ans == correct_idx:
            correct_count += 1
            topic_map[topic]["score"] += 1
            if skill_name not in strengths:
                strengths.append(skill_name)
        else:
            if skill_name not in skill_gaps:
                skill_gaps.append(skill_name)

    overall_percentage = int((correct_count / total_questions) * 100) if total_questions > 0 else 0

    # Calculate transparent weighted career readiness score
    # 70% assessment + 25 baseline
    readiness_score = min(100, int((overall_percentage * 0.7) + 25))

    topic_scores = [
        TopicScore(
            topic=t_name,
            score=int((data["score"] / data["total"]) * 100) if data["total"] > 0 else 0,
            total=data["total"],
        )
        for t_name, data in topic_map.items()
    ]

    # Generate personalized recommendations
    rec_practice = f"{target_set['skill']} Practice Set (Medium)" if overall_percentage >= 60 else f"{target_set['skill']} Foundations (Easy)"
    rec_roadmap = "Milestone 05: API Architecture & Systems" if overall_percentage >= 75 else "Milestone 03: Data Structures & Core Skills"

    return AssessmentResult(
        attempt_id=f"att-{uuid.uuid4().hex[:8]}",
        user_id=user_id,
        assessment_id=target_set["id"],
        assessment_title=target_set["title"],
        difficulty=target_set["difficulty"],
        overall_score=overall_percentage,
        readiness_score=readiness_score,
        correct_count=correct_count,
        total_questions=total_questions,
        topic_scores=topic_scores,
        strengths=strengths if strengths else [target_set["skill"]],
        skill_gaps=skill_gaps if skill_gaps else ["Advanced System Architecture"],
        recommended_practice=rec_practice,
        recommended_roadmap_step=rec_roadmap,
    )

def verify_practice_answer(question_id: str, selected_option_index: int) -> PracticeVerifyResponse:
    """Verify single question answer in interactive practice mode with immediate feedback"""
    raw_q = QUESTIONS_MAP.get(question_id)
    if not raw_q:
        return PracticeVerifyResponse(
            question_id=question_id,
            is_correct=False,
            correct_option_index=0,
            explanation="Question statement not found in catalog.",
        )

    correct_idx = raw_q.get("correct_option_index", 0)
    is_correct = (selected_option_index == correct_idx)
    explanation = raw_q.get("explanation", "Verified placement answer.")

    return PracticeVerifyResponse(
        question_id=question_id,
        is_correct=is_correct,
        correct_option_index=correct_idx,
        explanation=explanation,
    )
