"""A personal practice set built from one stored resume analysis.

Questions come from the bank for the skills the resume really shows, at the right difficulty: skills that are only listed (or that the
target role needs but the resume lacks) start with Easy questions, skills shown in a project start at Medium, verified skills at Hard.
Interview prompts are fill-in templates that name only skills (and projects) found in the resume, and are labelled "generated template".
"""
from typing import Any, Dict, List

from app.data import skills as catalog

# resume skill -> question-bank skills that test it
BANK_SKILLS: Dict[str, List[str]] = {
    "C": ["C"], "C++": ["C++"], "Python": ["Python"], "Java": ["Java"], "JavaScript": ["JavaScript"], "React": ["React"],
    "Machine Learning": ["Machine Learning", "AI / Machine Learning"], "Scikit-learn": ["Machine Learning"], "Model Evaluation": ["Machine Learning"],
    "Deep Learning": ["Deep Learning & AI"], "NLP": ["Deep Learning & AI"], "Computer Vision": ["Deep Learning & AI"],
    "Generative AI": ["Deep Learning & AI"], "TensorFlow": ["Deep Learning & AI"], "PyTorch": ["Deep Learning & AI"], "Keras": ["Deep Learning & AI"],
    "SQL": ["SQL & Databases"], "MySQL": ["SQL & Databases"], "PostgreSQL": ["SQL & Databases"], "DBMS": ["SQL & Databases"],
    "DSA": ["DSA"],
    "Docker": ["Cloud / DevOps"], "AWS": ["Cloud / DevOps"], "Kubernetes": ["Cloud / DevOps"], "CI/CD": ["Cloud / DevOps"], "Linux": ["Cloud / DevOps"],
}
# where to start, by how well the resume backs the skill up
DIFFICULTY_ORDER = {
    "gap": ["Easy", "Medium"],
    "claimed": ["Easy", "Medium"],
    "demonstrated": ["Medium", "Hard", "Easy"],
    "verified": ["Hard", "Medium"],
}
PROMPT_LABEL = "generated template"


def _levels(analysis: Dict[str, Any]) -> Dict[str, str]:
    """resume skill -> claimed / demonstrated / verified (older analyses without it count as claimed)."""
    stored = analysis.get("skill_levels") or {}
    return {s: stored.get(s, "claimed") for s in analysis.get("detected_skills", [])}


def _gap_skills(analysis: Dict[str, Any]) -> List[str]:
    """Skills the target role needs but the resume does not show, as catalog names that have questions."""
    names: List[str] = []
    for label in analysis.get("missing_skills", []):
        for alternative in catalog.requirement_alternatives(label):
            if alternative in BANK_SKILLS and alternative not in names and alternative not in analysis.get("detected_skills", []):
                names.append(alternative)
                break
    return names


def build_questions(analysis: Dict[str, Any], bank: List[Dict[str, Any]], limit: int = 20) -> List[Dict[str, Any]]:
    """bank: public questions (no answer keys), already filtered by company. Weak skills lead with easier questions."""
    levels = _levels(analysis)
    plan: List[Dict[str, Any]] = [{"skill": s, "level": levels[s]} for s in levels if s in BANK_SKILLS]
    plan += [{"skill": s, "level": "gap"} for s in _gap_skills(analysis)]
    if not plan:
        return []

    per_skill = max(2, -(-limit // len(plan)))
    lists: List[List[Dict[str, Any]]] = []
    used: set = set()
    for entry in plan:
        order = DIFFICULTY_ORDER[entry["level"]]
        pool = [q for q in bank if q["skill"] in BANK_SKILLS[entry["skill"]] and q["id"] not in used]
        if entry["level"] in ("gap", "claimed"):  # weak or missing skills only ever get the easier questions
            pool = [q for q in pool if q["difficulty"] in order]
        pool.sort(key=lambda q: (order.index(q["difficulty"]) if q["difficulty"] in order else len(order), q["id"]))
        picked = pool[:per_skill]
        used.update(q["id"] for q in picked)
        why = ("Needed for your target role but missing from your resume: starting easy" if entry["level"] == "gap"
               else f"You list {entry['skill']} ({entry['level']} on your resume): "
                    + ("starting with easier questions" if entry["level"] == "claimed" else "questions at the level you have shown"))
        lists.append([{**q, "reason": why, "for_skill": entry["skill"], "level": entry["level"]} for q in picked])

    # interleave the skills so one skill does not use the whole set; weak/missing skills lead each round
    lists.sort(key=lambda items: 0 if items and items[0]["level"] in ("gap", "claimed") else 1)
    mixed: List[Dict[str, Any]] = []
    for round_ in range(per_skill):
        for items in lists:
            if round_ < len(items):
                mixed.append(items[round_])
    return mixed[:limit]


def build_prompts(analysis: Dict[str, Any], limit: int = 6) -> List[Dict[str, str]]:
    """Interview prompts from templates. Each one names only a skill (and project) that is in the resume."""
    levels = _levels(analysis)
    contexts = analysis.get("skill_contexts") or {}
    rank = {"verified": 0, "demonstrated": 1, "claimed": 2}
    prompts: List[Dict[str, str]] = []
    for skill in sorted(levels, key=lambda s: (rank.get(levels[s], 3), s))[:limit]:
        where = contexts.get(skill)
        if where and levels[skill] != "claimed":
            text = f"You list {skill} in {where}: explain how you used it and one problem you solved."
        else:
            text = f"You list {skill} under Skills: describe one small thing you built or practised with it, and what you would study next."
        prompts.append({"skill": skill, "text": text, "label": PROMPT_LABEL})
    claimed = [s for s in levels if levels[s] == "claimed"]
    if claimed:
        prompts.append({"skill": claimed[0], "label": PROMPT_LABEL,
                        "text": f"You are least able to back up {claimed[0]} with a project. How would you learn it well enough to use it at work in two weeks?"})
    return prompts
