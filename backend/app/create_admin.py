"""Create or promote an administrator account.

    python -m app.create_admin                       (prompts; password is not echoed)
    python -m app.create_admin "Name" admin@x.com    (password still prompted)
"""
import asyncio
import getpass
import sys
import uuid

from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.models.user import check_password_policy
from app.services.auth_service import hash_password
from app.utils.timeutil import utcnow


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


if __name__ == "__main__":
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
        sys.exit(f"Could not create administrator: {exc}")
