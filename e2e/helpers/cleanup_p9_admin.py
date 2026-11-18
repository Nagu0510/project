"""Delete exactly the records the P9 admin browser test created. Nothing else is touched.

    backend/.venv/Scripts/python.exe e2e/helpers/cleanup_p9_admin.py --since <ISO time> [--papers qp-xxxx ...] [--placements job-xxxx ...] [--question p9-test-123]

Every id must match the shape the app generates (qp-<8 hex>, job-<8 hex>, p9-test-<digits>) and the record must have been
created after --since (the start of the test run), so a real record can never be deleted by a typo. Prints counts only.
"""
import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from pymongo import MongoClient  # noqa: E402

from app.config import settings  # noqa: E402

parser = argparse.ArgumentParser()
parser.add_argument("--since", required=True)
parser.add_argument("--papers", nargs="*", default=[])
parser.add_argument("--placements", nargs="*", default=[])
parser.add_argument("--question", nargs="*", default=[])
args = parser.parse_args()

since = datetime.fromisoformat(args.since.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None)
for p in args.papers:
    if not re.fullmatch(r"qp-[0-9a-f]{8}", p):
        sys.exit(f"Refusing paper id {p!r}")
for j in args.placements:
    if not re.fullmatch(r"job-[0-9a-f]{8}", j):
        sys.exit(f"Refusing placement id {j!r}")
for q in args.question:
    if not re.fullmatch(r"p9-test-\d+", q):
        sys.exit(f"Refusing question id {q!r}")

options = {"tls": True} if settings.MONGODB_URL.startswith("mongodb+srv://") else {}
db = MongoClient(settings.MONGODB_URL, serverSelectionTimeoutMS=8000, **options)[settings.DATABASE_NAME]
removed = {"papers": 0, "extracted": 0, "previous": 0, "paper_notifications": 0, "placements": 0, "placement_notifications": 0, "questions": 0}

for paper_id in args.papers:
    paper = db["question_papers"].find_one({"id": paper_id, "uploaded_at": {"$gte": since}})
    if not paper:
        continue  # not a paper this run created: leave it alone
    ids = [d["id"] for d in db["extracted_questions"].find({"paper_id": paper_id}, {"id": 1})]
    removed["extracted"] += db["extracted_questions"].delete_many({"paper_id": paper_id}).deleted_count
    removed["previous"] += db["previous_questions"].delete_many({"id": {"$in": [f"pq-{i}" for i in ids]}}).deleted_count
    removed["paper_notifications"] += db["notifications"].delete_many({"dedupe_key": f"paper:{paper_id}"}).deleted_count
    removed["papers"] += db["question_papers"].delete_one({"id": paper_id}).deleted_count

for job_id in args.placements:
    job = db["placements"].find_one({"id": job_id, "created_at": {"$gte": since}}) or db["placements"].find_one({"id": job_id, "company": {"$regex": "^P9 Test"}})
    if not job:
        continue
    removed["placement_notifications"] += db["notifications"].delete_many({"dedupe_key": {"$in": [f"placement:{job_id}", f"deadline:{job_id}"]}}).deleted_count
    removed["placements"] += db["placements"].delete_one({"id": job_id}).deleted_count

for qid in args.question:
    removed["questions"] += db["assessment_questions"].delete_many({"id": qid, "created_by": {"$exists": True}}).deleted_count

print("removed:", removed)
