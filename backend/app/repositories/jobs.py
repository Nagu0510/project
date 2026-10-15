"""Background-job bookkeeping (collection: job_runs), so a daily task runs once per day even across restarts."""
from pymongo.errors import DuplicateKeyError

from app.repositories._base import col


async def claim_day(name: str, day: str) -> bool:
    """Atomically mark `name` as run for `day`. False if it already ran that day (here or in another process)."""
    res = await col("job_runs").update_one({"name": name, "last_run_date": {"$ne": day}}, {"$set": {"last_run_date": day}})
    if res.modified_count:
        return True
    try:
        await col("job_runs").insert_one({"name": name, "last_run_date": day})
        return True
    except DuplicateKeyError:
        return False


async def release_day(name: str, day: str) -> None:
    """Undo a claim after a failed run so the next attempt tries again."""
    await col("job_runs").update_one({"name": name, "last_run_date": day}, {"$set": {"last_run_date": ""}})


async def last_run(name: str):
    doc = await col("job_runs").find_one({"name": name}, {"_id": 0})
    return (doc or {}).get("last_run_date")
