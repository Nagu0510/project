"""Load starter content into MongoDB:  python -m app.seed

Idempotent. Code-owned content (coding problems, assessment sets and questions, career paths) is
refreshed on every run, except documents flagged `edited_by_admin: true`, which are never touched.
Content admins create (placements, question papers, previous questions) is only inserted when
missing. Re-running never overwrites an admin's changes. Accounts are NOT seeded (see app.create_admin).
"""
import asyncio
import logging

from app.data.assessment_bank import ASSESSMENT_QUESTION_BANK, ASSESSMENT_SETS
from app.data.career_config import CAREER_PATHS_CONFIG
from app.data.courses import COURSES
from app.data.coding_problems import (
    EXPANDED_CODING_PROBLEMS, LEGACY_PROBLEM_FIELDS, RETIRED_PROBLEM_SLUGS, RETIRED_SLUG_REMAP, _normalize_problem_obj,
)
from app.services.function_judge import validate_problem
from app.data.papers import INITIAL_PAPERS
from app.data.placements import PLACEMENT_JOBS
from app.data.previous_questions import INITIAL_PREVIOUS_QUESTIONS
from app.utils.timeutil import utcnow

logger = logging.getLogger("skillsense_seed")


async def _upsert_code_owned(db, collection: str, key: str, doc: dict, unset=()) -> str:
    """Insert or refresh a seed document unless an admin has edited it. `unset` lists old fields to remove. Returns inserted/updated/skipped."""
    existing = await db[collection].find_one({key: doc[key]}, {"edited_by_admin": 1})
    if existing and existing.get("edited_by_admin"):
        return "skipped"
    update = {"$set": doc}
    if unset:
        update["$unset"] = {name: "" for name in unset if name not in doc}
    await db[collection].update_one({key: doc[key]}, update, upsert=True)
    return "updated" if existing else "inserted"


async def seed_collections(db) -> dict:
    report = {}

    async def run(collection: str, key: str, docs: list, unset=()) -> None:
        tally = {"inserted": 0, "updated": 0, "skipped": 0}
        for doc in docs:
            tally[await _upsert_code_owned(db, collection, key, doc, unset)] += 1
        report[collection] = tally

    invalid = [issue for p in EXPANDED_CODING_PROBLEMS for issue in validate_problem(p)]
    if invalid:
        raise SystemExit("Coding problem data is invalid: " + "; ".join(invalid[:5]))
    await run("practice_problems", "slug", [_normalize_problem_obj(p) for p in EXPANDED_CODING_PROBLEMS], unset=LEGACY_PROBLEM_FIELDS)
    # drop the retired function-style problems (an admin-edited one is left alone)
    retired = await db["practice_problems"].delete_many({"slug": {"$in": RETIRED_PROBLEM_SLUGS}, "edited_by_admin": {"$ne": True}})
    report["practice_problems"]["removed"] = retired.deleted_count
    await run("courses", "slug", COURSES)
    await run("assessment_questions", "id", ASSESSMENT_QUESTION_BANK)
    await run("assessments", "id", ASSESSMENT_SETS)
    await run("career_paths", "id", [
        {**cfg, "slug": cfg.get("slug", cfg["id"]), "position": i}
        for i, cfg in enumerate(CAREER_PATHS_CONFIG.values())
    ])

    for name, rows in (
        ("placements", PLACEMENT_JOBS),
        ("question_papers", INITIAL_PAPERS),
        ("previous_questions", INITIAL_PREVIOUS_QUESTIONS),
    ):
        inserted = 0
        for row in rows:
            doc = {**row, "created_at": row.get("created_at") or utcnow()}
            res = await db[name].update_one({"id": doc["id"]}, {"$setOnInsert": doc}, upsert=True)
            inserted += res.upserted_id is not None
        report[name] = {"inserted": inserted, "updated": 0, "skipped": len(rows) - inserted}

    # stored previous questions that still link to a retired practice problem: point them at the closest current one (or no link)
    relinked = 0
    for old, new in RETIRED_SLUG_REMAP.items():
        res = await db["previous_questions"].update_many({"problem_slug": old}, {"$set": {"problem_slug": new}})
        relinked += res.modified_count
    current = [p["slug"] for p in EXPANDED_CODING_PROBLEMS] + [""]
    dangling = await db["previous_questions"].update_many({"problem_slug": {"$exists": True, "$nin": current}}, {"$set": {"problem_slug": ""}})
    report["previous_questions"]["relinked"] = relinked + dangling.modified_count

    logger.info("Seeded: %s", report)
    return report


async def seed_database() -> None:
    from app.database import close_mongo_connection, connect_to_mongo, db_manager

    await connect_to_mongo()  # also creates the indexes
    try:
        if db_manager.using_fallback:
            raise SystemExit("Refusing to seed the throwaway in-memory database; start MongoDB first.")
        await seed_collections(db_manager.db)
        logger.info("Database seeding completed.")
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_database())
