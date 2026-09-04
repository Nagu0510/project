import re
from typing import List, Optional, Dict, Any
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from app.models.question_paper import QuestionMatchResponse, MatchDetail
from app.database import db_manager

MATCH_THRESHOLD = 0.82

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

def _clean_text(text: str) -> str:
    if not text:
        return ""
    text_clean = re.sub(r'[^a-zA-Z0-9\s]', ' ', text.lower())
    return ' '.join(text_clean.split())

def _get_published_questions() -> List[Dict[str, Any]]:
    """Retrieve approved/published questions from in-memory store and MongoDB"""
    raw_qs = list(db_manager._memory_store["previous_questions"].values())
    published = [q for q in raw_qs if q.get("status") in ["approved", "published"]]
    
    # Also check extracted_questions approved by admin
    extracted = list(db_manager._memory_store["extracted_questions"].values())
    for eq in extracted:
        if eq.get("status") in ["approved", "published"]:
            published.append({
                "id": eq.get("id"),
                "company": eq.get("company", "Corporate"),
                "companies": [eq.get("company", "Corporate")],
                "exam": eq.get("exam", "Placement Paper"),
                "year": eq.get("year", 2025),
                "question_text": eq.get("question_text", ""),
                "normalized_text": eq.get("normalized_text") or _clean_text(eq.get("question_text", "")),
                "topic": eq.get("topic", "General"),
                "difficulty": eq.get("difficulty", "Medium"),
                "appearances_count": eq.get("appearances_count", 1),
            })

    return published

def _build_tfidf_index():
    global _CACHED_QUESTIONS, _CACHED_VECTORIZER, _CACHED_TFIDF_MATRIX
    questions = _get_published_questions()
    if not questions:
        _CACHED_QUESTIONS = []
        _CACHED_VECTORIZER = None
        _CACHED_TFIDF_MATRIX = None
        return

    texts = [_clean_text(q.get("question_text", "") or q.get("normalized_text", "")) for q in questions]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english')
    try:
        tfidf_matrix = vectorizer.fit_transform(texts)
        _CACHED_QUESTIONS = questions
        _CACHED_VECTORIZER = vectorizer
        _CACHED_TFIDF_MATRIX = tfidf_matrix
    except Exception:
        _CACHED_QUESTIONS = questions
        _CACHED_VECTORIZER = None
        _CACHED_TFIDF_MATRIX = None

def find_historical_question_match(
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

    # Ensure index built
    if _CACHED_VECTORIZER is None or _CACHED_TFIDF_MATRIX is None:
        _build_tfidf_index()

    questions = _CACHED_QUESTIONS or _get_published_questions()
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
        try:
            query_vec = _CACHED_VECTORIZER.transform([clean_query])
            cosine_sims = cosine_similarity(query_vec, _CACHED_TFIDF_MATRIX)[0]
            for idx, score in enumerate(cosine_sims):
                score_float = round(float(score), 2)
                if score_float >= MATCH_THRESHOLD:
                    q_obj = questions[idx]
                    # Avoid duplicate entry
                    if not any(m[1].get("id") == q_obj.get("id") for m in matches_list):
                        matches_list.append((score_float, q_obj))
        except Exception:
            pass

    # Sort matches by similarity score descending
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

    # Format response
    top_score, top_q = matches_list[0]
    top_company = top_q.get("company") or (top_q.get("companies")[0] if top_q.get("companies") else "Corporate")
    top_exam = top_q.get("exam") or top_q.get("exam_origin") or "Placement Drive"
    top_year = top_q.get("year", 2025)

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
        yr = q.get("year", 2025)
        all_match_details.append(MatchDetail(company=c_name, exam=ex_name, year=yr, similarity=score))
        if c_name not in seen_companies:
            seen_companies.add(c_name)
            distinct_companies.append(c_name)

    return QuestionMatchResponse(
        matched=True,
        similarity=top_score,
        topic=top_q.get("topic", query_topic or "General"),
        difficulty=top_q.get("difficulty", "Medium"),
        exam_origin=f"{top_company} {top_exam} ({top_year})",
        appearances_count=len(matches_list),
        companies=distinct_companies,
        best_match=best_match_detail,
        matches=all_match_details,
        historical_occurrences=top_q.get("historical_occurrences", [])
    )
