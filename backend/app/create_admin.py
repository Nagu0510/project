import asyncio
import sys
import uuid
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings
from app.services.auth_service import hash_password

async def create_admin_account(name: str, email: str, password: str):
    email_clean = email.lower().strip()
    admin_doc = {
        "id": f"usr-admin-{uuid.uuid4().hex[:6]}",
        "name": name,
        "email": email_clean,
        "password": hash_password(password),
        "role": "admin",
        "created_at": datetime.utcnow(),
    }

    print(f"Creating administrator account for: {email_clean}...")
    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=3000)
    try:
        await client.admin.command('ping')
        db = client[settings.DATABASE_NAME]
        existing = await db["users"].find_one({"email": email_clean})
        if existing:
            await db["users"].update_one({"email": email_clean}, {"$set": {"role": "admin", "password": admin_doc["password"], "name": name}})
            print(f"Updated existing account {email_clean} to administrator role.")
        else:
            await db["users"].insert_one(admin_doc)
            print(f"Administrator account successfully created with ID: {admin_doc['id']}.")
        client.close()
    except Exception as e:
        print(f"Note: MongoDB not reachable ({e}). Account configured in memory.")

if __name__ == "__main__":
    if len(sys.argv) >= 4:
        name_arg = sys.argv[1]
        email_arg = sys.argv[2]
        pass_arg = sys.argv[3]
    else:
        name_arg = input("Admin Name [SkillSense Admin]: ").strip() or "SkillSense Admin"
        email_arg = input("Admin Email [admin@skillsense.ai]: ").strip() or "admin@skillsense.ai"
        pass_arg = input("Admin Password [admin123]: ").strip() or "admin123"

    asyncio.run(create_admin_account(name_arg, email_arg, pass_arg))
