import pytest

from app.services.question_matching_service import format_exam_origin


@pytest.mark.parametrize("company,exam,year,expected", [
    # the reported bug: company and year both repeated inside the exam name
    ("TCS", "TCS NQT — 2025", 2025, "TCS NQT (2025)"),
    # company repeated in the exam name, year separate
    ("Infosys", "Infosys Online Assessment", 2026, "Infosys Online Assessment (2026)"),
    ("TCS (Tata Consultancy Services)", "TCS NQT", 2025, "TCS NQT (2025)"),
    ("tcs", "TCS NQT", 2025, "TCS NQT (2025)"),
    # company absent from the exam name: it is prepended once
    ("Accenture", "Technical Assessment", 2025, "Accenture Technical Assessment (2025)"),
    # year repeated in different shapes
    ("Cognizant", "GenC (2025)", 2025, "Cognizant GenC (2025)"),
    ("Cognizant", "GenC 2025", 2025, "Cognizant GenC (2025)"),
    ("Cognizant", "GenC - 2025 Elevate", 2025, "Cognizant GenC - Elevate (2025)"),
    # a different number is not a year to strip
    ("Wipro", "Elite NLTH 2024", 2025, "Wipro Elite NLTH 2024 (2025)"),
    ("Wipro", "Elite 12025 Drive", 2025, "Wipro Elite 12025 Drive (2025)"),
    # missing year: no empty brackets, no invented year
    ("TCS", "TCS NQT — 2025", None, "TCS NQT — 2025"),
    ("TCS", "TCS NQT", None, "TCS NQT"),
    ("TCS", "TCS NQT", "", "TCS NQT"),
    ("TCS", "TCS NQT", 0, "TCS NQT"),
    # missing exam name
    ("TCS", None, 2025, "TCS (2025)"),
    ("TCS", "", 2025, "TCS (2025)"),
    ("TCS", "   ", None, "TCS"),
    # nothing known
    (None, None, None, "Previous placement paper"),
    ("", "", 2025, "Previous placement paper (2025)"),
    # the company name appearing only as part of another word is not a repeat
    ("IBM", "Bibmo Drive", 2025, "IBM Bibmo Drive (2025)"),
])
def test_exam_origin_never_repeats_company_or_year(company, exam, year, expected):
    assert format_exam_origin(company, exam, year) == expected


def test_exam_origin_contains_the_year_once_and_the_company_once():
    out = format_exam_origin("TCS", "TCS NQT — 2025", 2025)
    assert out.count("2025") == 1 and out.count("TCS") == 1


async def test_match_response_uses_the_clean_label(client, db):
    from app.seed import seed_collections
    from app.services.question_matching_service import find_historical_question_match, invalidate_question_matching_cache

    await seed_collections(db)
    invalidate_question_matching_cache()
    res = await find_historical_question_match(
        "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target."
    )
    assert res.matched
    assert res.exam_origin == "TCS NQT (2025)"
    assert res.best_match.year == 2025
