"""Create or promote an administrator account.

    python -m app.create_admin                       (prompts; password is not echoed)
    python -m app.create_admin "Name" admin@x.com    (password still prompted)
    python -m app.create_admin --reset               (forgot the admin password: prompts for email and a new strong password)
"""
import asyncio
import getpass
import re
import sys
import uuid

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.user import check_password_policy
from app.services.auth_service import hash_password
from app.utils.timeutil import utcnow


# Passwords an admin may never use (compared in lower case, and as a part of the password for the longer ones)
COMMON_PASSWORDS = {
    "admin123", "admin1234", "administrator", "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop",
    "letmein", "welcome1", "welcome123", "iloveyou", "changeme", "123456789", "1234567890", "skillsense", "skillsense123",
}


def check_admin_password(password: str) -> None:
    """The admin reset needs a STRONG password: 12+ characters with upper, lower, digit and symbol, and nothing from the common list.
    Raises ValueError naming the unmet rules (never the password itself)."""
    problems = []
    if len(password) < 12:
        problems.append("at least 12 characters")
    if len(password.encode("utf-8")) > 72:
        problems.append("at most 72 bytes")
    if not re.search(r"[a-z]", password):
        problems.append("a lower-case letter")
    if not re.search(r"[A-Z]", password):
        problems.append("an upper-case letter")
    if not re.search(r"\d", password):
        problems.append("a digit")
    if not re.search(r"[^A-Za-z0-9]", password):
        problems.append("a symbol such as ! or #")
    lowered = password.lower()
    if lowered in COMMON_PASSWORDS or any(common in lowered for common in COMMON_PASSWORDS if len(common) >= 8):
        problems.append("nothing from the list of common passwords (such as admin123 or password123)")
    if problems:
        raise ValueError("The password is too weak. It needs: " + ", ".join(problems) + ".")


async def reset_admin_account(db, email: str, password: str) -> str:
    """Set a new password for an ADMIN account (or create the admin if that email does not exist yet).

    Refuses an email that belongs to a student. Clears the lockout and the failed-attempt counter, and revokes every session the
    admin had: `password_changed_at` makes the server reject all access and refresh tokens issued before now. Returns the email.
    Never prints, logs or returns the password.
    """
    email = email.lower().strip()
    check_admin_password(password)
    users = db["users"]
    hashed = hash_password(password)  # the same function the login verifies against
    existing = await users.find_one({"email": email}, {"_id": 0, "id": 1, "role": 1})
    if existing and existing.get("role") != "admin":
        raise PermissionError("That account is not an administrator. Nothing was changed.")
    now = utcnow()
    changes = {"password": hashed, "password_changed_at": now, "failed_logins": 0, "locked_until": None}
    if existing:
        await users.update_one({"email": email, "role": "admin"}, {"$set": changes})
    else:
        await users.insert_one({
            "id": f"usr-admin-{uuid.uuid4().hex[:6]}", "name": "Administrator", "email": email, "role": "admin",
            "created_at": now, "email_verified": True, **changes,
        })
    return email


async def create_admin_account(name: str, email: str, password: str) -> None:
    email = email.lower().strip()
    check_password_policy(password)
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=3000)
    try:
        await client.admin.command("ping")
        users = client[settings.DATABASE_NAME]["users"]
        hashed = hash_password(password)
        if await users.find_one({"email": email}, {"_id": 1}):
            await users.update_one(
                {"email": email},
                {"$set": {"role": "admin", "password": hashed, "name": name, "password_changed_at": utcnow()}},
            )
            print(f"Existing account {email} is now an administrator.")
        else:
            await users.insert_one({
                "id": f"usr-admin-{uuid.uuid4().hex[:6]}", "name": name, "email": email,
                "password": hashed, "role": "admin", "created_at": utcnow(),
            })
            print(f"Administrator {email} created.")
    finally:
        client.close()


def _run_reset() -> None:
    email = input("Admin email: ").strip()
    pw = getpass.getpass("New password: ")
    if pw != getpass.getpass("Type it again: "):
        sys.exit("The two passwords do not match. Nothing was changed.")

    async def go() -> str:
        client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=5000)
        try:
            await client.admin.command("ping")
            return await reset_admin_account(client[settings.DATABASE_NAME], email, pw)
        finally:
            client.close()

    try:
        done = asyncio.run(go())
    except (ValueError, PermissionError) as exc:  # weak password, or not an admin: say why, change nothing
        sys.exit(str(exc))
    except Exception as exc:  # database unreachable etc.: the error type only
        sys.exit(f"Could not update the administrator ({type(exc).__name__}). Nothing was changed.")
    print(f"Admin updated for {done}")


if __name__ == "__main__":
    if "--reset" in sys.argv[1:]:
        _run_reset()
        sys.exit(0)
    name = sys.argv[1] if len(sys.argv) > 1 else input("Admin name: ").strip()
    email = sys.argv[2] if len(sys.argv) > 2 else input("Admin email: ").strip()
    pw = getpass.getpass("Password: ")
    if pw != getpass.getpass("Confirm password: "):
        sys.exit("Passwords do not match.")
    try:
        asyncio.run(create_admin_account(name, email, pw))
    except ValueError as exc:  # password policy
        sys.exit(str(exc))
    except Exception as exc:  # Mongo unreachable etc.: fail loudly, never pretend it worked
        sys.exit(f"Could not create administrator ({type(exc).__name__}). Check MONGODB_URL and that the database is reachable.")
