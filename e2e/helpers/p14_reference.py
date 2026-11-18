"""Prints the Python reference solution of one practice problem:   p14_reference.py <slug>

Test use only (the e2e spec needs a correct answer to prove a solve and a streak). Reads backend/tests/reference_solutions.py,
which the app itself never imports.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from tests.reference_solutions import REFERENCE  # noqa: E402

if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else ""
    code = (REFERENCE.get(slug) or {}).get("python")
    if not code:
        print(f"no python reference for {slug!r}", file=sys.stderr)
        sys.exit(1)
    sys.stdout.write(code.strip("\n") + "\n")
