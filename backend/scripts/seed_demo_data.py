"""Create or remove demo data (fake students and their activity) so the admin pages have something to show.

  python scripts/seed_demo_data.py --yes                 # create / refresh 25 demo students (run `python -m app.seed` first)
  python scripts/seed_demo_data.py --yes --count 40      # a different number (1 to 100)
  python scripts/seed_demo_data.py --yes --reset         # remove ONLY the demo-flagged records

Run from backend/. It refuses to run without --yes, and in production without --allow-production. Demo students are flagged `demo: true`,
use @example.test addresses and have no password, so nobody can sign in as one. Running it twice never duplicates anything; --reset never
touches a real user. It prints what it created or removed and never prints a connection string or a secret.
"""
import argparse
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from app.config import settings  # noqa: E402
except Exception as exc:  # backend/.env is missing a value or has a bad one: say which, in one line (values are never printed)
    problems = [f"{'.'.join(str(x) for x in e.get('loc', ())) or 'settings'}: {e.get('msg', '')}" for e in getattr(exc, "errors", lambda: [])()]
    print("FAILED: backend/.env is not ready -> " + ("; ".join(problems) or type(exc).__name__))
    sys.exit(1)

from app.services import demo_data  # noqa: E402


def parse(argv=None) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Create or remove demo data.")
    ap.add_argument("--yes", action="store_true", help="required: confirms you want to write to (or delete from) the database")
    ap.add_argument("--reset", action="store_true", help="remove the demo-flagged records instead of creating them")
    ap.add_argument("--count", type=int, default=25, help="number of demo students to create (default 25, 1 to 100)")
    ap.add_argument("--allow-production", action="store_true", help="allow it when ENV=production (not recommended)")
    return ap.parse_args(argv)


async def run(args: argparse.Namespace, db) -> int:
    if args.reset:
        removed = await demo_data.reset(db)
        print("Removed demo records:", ", ".join(f"{k} {v}" for k, v in removed.items()))
        return 0
    try:
        made = await demo_data.seed(db, args.count)
    except demo_data.DemoDataError as exc:
        print(f"FAILED: {exc}")
        return 1
    print(f"Created or refreshed demo data for {args.count} students:", ", ".join(f"{k} {v}" for k, v in made.items()))
    print(f"Demo accounts: demo01@{demo_data.EMAIL_DOMAIN} ... (no password: they cannot sign in). Remove them with: python scripts/seed_demo_data.py --yes --reset")
    return 0


async def main(argv=None) -> int:
    args = parse(argv)
    if not args.yes:
        print("Refusing to run without --yes. This writes (or, with --reset, deletes) demo records in the configured database.")
        return 2
    if settings.is_production and not args.allow_production:
        print("Refusing to run: ENV=production. Demo data does not belong in a live database (use --allow-production only if you are sure).")
        return 2
    from app.database import close_mongo_connection, connect_to_mongo, db_manager

    await connect_to_mongo()  # also creates the indexes
    try:
        if db_manager.using_fallback:
            print("Refusing to write into the throwaway in-memory database; start MongoDB first.")
            return 2
        return await run(args, db_manager.db)
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING)
    sys.exit(asyncio.run(main()))
