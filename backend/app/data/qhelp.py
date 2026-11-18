"""Builder for the authored question bank. Every question here was written for SkillSense AI (origin "authored")."""
import random

LANGUAGE_OF_SKILL = {
    "C": "c", "C++": "cpp", "Python": "python", "Java": "java", "JavaScript": "javascript",
    "Machine Learning": "python", "Deep Learning & AI": "python",
}


def q(qid, skill, topic, difficulty, qtype, text, options, answer, explanation, code=None, practice=True):
    """options: exactly four strings, the correct one at index `answer` as written.

    The options are shuffled with a generator seeded by the question id, so the correct position is spread across
    A-D but never changes between runs or deployments.
    """
    assert len(options) == 4 and 0 <= answer < 4, qid
    order = list(range(4))
    random.Random(qid).shuffle(order)
    shuffled = [options[i] for i in order]
    doc = {
        "id": qid,
        "title": text[:70],
        "skill": skill,
        "topic": topic,
        "subtopic": topic,
        "difficulty": difficulty,
        "question_type": qtype,
        "question_text": text,
        "options": shuffled,
        "correct_option_index": order.index(answer),
        "explanation": explanation,
        "origin": "authored",
        "practice": practice,
        "companies": [],
    }
    if code:
        doc["code"] = code.strip("\n")
        doc["language"] = LANGUAGE_OF_SKILL[skill]
    return doc
