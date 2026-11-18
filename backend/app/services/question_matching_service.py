import re
from typing import List, Optional, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.models.question_paper import QuestionMatchResponse, MatchDetail
from app.repositories import questions as question_repo
from app.config import settings

MATCH_THRESHOLD = getattr(settings, "SIMILARITY_THRESHOLD", 0.70)

# Global cached index structures
_CACHED_QUESTIONS: List[Dict[str, Any]] = []
_CACHED_VECTORIZER: Optional[TfidfVectorizer] = None
_CACHED_TFIDF_MATRIX = None

def invalidate_question_matching_cache():
    """Call when Admin publishes, approves, or deletes questions to force index rebuild."""
    global _CACHED_QUESTIONS, _CACHED_VECTORIZER, _CACHED_TFIDF_MATRIX
    _CACHED_QUESTIONS = []
    _CACHED_VECTORIZER = None
    _CACHED_TFIDF_MATRIX = None

def format_exam_origin(company: Optional[str], exam: Optional[str], year: Optional[object]) -> str:
    """"TCS NQT (2025)" from a company, exam name and year, without repeating any of them.

    The company is not prepended when the exam name already contains it, and the year is not
    appended when the exam name already carries it. A missing year or exam name is left out.
    """
    short = re.split(r"\s*\(", (company or "").strip())[0].strip()  # "TCS (Tata Consultancy Services)" -> "TCS"
    name = (exam or "").strip()
    year_text = str(year).strip() if year not in (None, "", 0) else ""

    if year_text:
        # remove the year wherever the exam name carries it ("— 2025", "(2025)", "2025"), then tidy separators
        name = re.sub(rf"\s*[(\[]?\s*(?<!\d){re.escape(year_text)}(?!\d)\s*[)\]]?", " ", name)
        name = re.sub(r"\s+", " ", name).strip(" \t-\u2014\u2013:,")

    has_company = bool(short) and re.search(rf"(?<!\w){re.escape(short)}(?!\w)", name, re.I) is not None
    label = " ".join(part for part in (short if not has_company else "", name) if part) or "Previous placement paper"
    return f"{label} ({year_text})" if year_text else label


def _clean_text(text: str) -> str:
    if not text:
        return ""
    text_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    return ' '.join(text_clean.split())

async def _get_published_questions_async() -> List[Dict[str, Any]]:
    """Only published questions are indexed. Approving a question publishes it (see routers/admin.py);
    needs_review and rejected questions never reach this pool."""
    return await question_repo.published_previous()


async def _build_tfidf_index_async():
    global _CACHED_QUESTIONS, _CACHED_VECTORIZER, _CACHED_TFIDF_MATRIX
    # Keep only questions that have text so row i of the matrix is always questions[i].
    questions = [
        q for q in await _get_published_questions_async()
        if _clean_text(q.get("question_text", "") or q.get("normalized_text", "")).strip()
    ]
    _CACHED_QUESTIONS, _CACHED_VECTORIZER, _CACHED_TFIDF_MATRIX = questions, None, None
    if not questions:
        return

    texts = [_clean_text(q.get("question_text", "") or q.get("normalized_text", "")) for q in questions]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
    try:
        _CACHED_TFIDF_MATRIX = vectorizer.fit_transform(texts)
        _CACHED_VECTORIZER = vectorizer
    except ValueError:  # e.g. every question is only stop words: exact/Jaccard layers still work
        _CACHED_TFIDF_MATRIX = None

async def find_historical_question_match(
    query_text: str,
    query_topic: Optional[str] = None
) -> QuestionMatchResponse:
    """
    Multi-layer question matching algorithm:
    Layer 1: Normalized exact text match
    Layer 2: Token Jaccard similarity
    Layer 3 & 4: TF-IDF vectorization + Cosine Similarity using scikit-learn
    """
    clean_query = _clean_text(query_text)
    if not clean_query:
        return QuestionMatchResponse(
            matched=False,
            similarity=0.0,
            topic=query_topic or "General",
            difficulty="Medium",
            exam_origin="No Question Provided",
            appearances_count=0,
            companies=[],
            best_match=None,
            matches=[]
        )

    # Ensure TF-IDF index is populated from MongoDB
    if _CACHED_VECTORIZER is None or _CACHED_TFIDF_MATRIX is None or not _CACHED_QUESTIONS:
        await _build_tfidf_index_async()

    questions = _CACHED_QUESTIONS or (await _get_published_questions_async())
    if not questions:
        return QuestionMatchResponse(
            matched=False,
            similarity=0.0,
            topic=query_topic or "General",
            difficulty="Medium",
            exam_origin="No Historical Papers Uploaded",
            appearances_count=0,
            companies=[],
            best_match=None,
            matches=[]
        )

    matches_list = []
    
    # Layer 1 & 2: Exact & Jaccard token check
    query_tokens = set(clean_query.split())

    for q in questions:
        q_text = _clean_text(q.get("question_text", "") or q.get("normalized_text", ""))
        if not q_text:
            continue
        
        sim = 0.0
        if clean_query == q_text:
            sim = 0.98
        else:
            q_tokens = set(q_text.split())
            if query_tokens and q_tokens:
                intersection = query_tokens.intersection(q_tokens)
                union = query_tokens.union(q_tokens)
                jaccard = float(len(intersection)) / len(union) if union else 0.0
                if jaccard >= 0.7:
                    sim = min(0.95, round(0.70 + (jaccard * 0.28), 2))

        if sim >= MATCH_THRESHOLD:
            matches_list.append((sim, q))

    # Layer 3 & 4: TF-IDF + Cosine Similarity
    if _CACHED_VECTORIZER is not None and _CACHED_TFIDF_MATRIX is not None:
        query_vec = _CACHED_VECTORIZER.transform([clean_query])
        cosine_sims = cosine_similarity(query_vec, _CACHED_TFIDF_MATRIX)[0]
        for idx, score in enumerate(cosine_sims):
            score_float = round(float(score), 2)
            if score_float >= MATCH_THRESHOLD:
                q_obj = questions[idx]
                if not any(m[1].get("id") == q_obj.get("id") for m in matches_list):
                    matches_list.append((score_float, q_obj))

    matches_list.sort(key=lambda x: x[0], reverse=True)

    if not matches_list:
        return QuestionMatchResponse(
            matched=False,
            similarity=0.0,
            topic=query_topic or "General",
            difficulty="Medium",
            exam_origin="No Paper Match Found",
            appearances_count=0,
            companies=[],
            best_match=None,
            matches=[]
        )

    top_score, top_q = matches_list[0]
    top_company = top_q.get("company") or (top_q.get("companies")[0] if top_q.get("companies") else "Corporate")
    top_exam = top_q.get("exam") or top_q.get("exam_origin") or "Placement Drive"
    top_year = top_q.get("year")

    best_match_detail = MatchDetail(
        company=top_company,
        exam=top_exam,
        year=top_year,
        similarity=top_score
    )

    all_match_details = []
    seen_companies = set()
    distinct_companies = []

    for score, q in matches_list:
        c_name = q.get("company") or (q.get("companies")[0] if q.get("companies") else "Corporate")
        ex_name = q.get("exam") or q.get("exam_origin") or "Placement Drive"
        yr = q.get("year")
        all_match_details.append(MatchDetail(company=c_name, exam=ex_name, year=yr, similarity=score))
        if c_name not in seen_companies:
            seen_companies.add(c_name)
            distinct_companies.append(c_name)

    return QuestionMatchResponse(
        matched=True,
        similarity=top_score,
        topic=top_q.get("topic", query_topic or "General"),
        difficulty=top_q.get("difficulty", "Medium"),
        exam_origin=format_exam_origin(top_company, top_exam, top_year),
        appearances_count=len(matches_list),
        companies=distinct_companies,
        best_match=best_match_detail,
        matches=all_match_details,
        historical_occurrences=top_q.get("historical_occurrences", [])
    )
