from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Firm, User, Client, Matter, OnboardingRequest, PostCompletionTask
from app.security import hash_password

DEMO_FIRM_NAME = "Demo Firm LLP"
DEMO_USER_EMAIL = "admin@demo-firm.co.uk"
DEMO_USER_PASSWORD = "Password123!"

TASK_TEMPLATES = {
    "PURCHASE": [
        ("SDLT_SUBMISSION", "SDLT submission"),
        ("AP1_LODGEMENT", "AP1 lodgement"),
        ("OS1_EXPIRY", "OS1 priority expiry tracking"),
        ("REQUISITIONS", "Requisitions handling"),
        ("REG_COMPLETE", "Registration completed"),
    ],
    "SALE": [
        ("REDEMPTION", "Redemption statement"),
        ("DISCHARGE_EVIDENCE", "Mortgage discharge evidence (DS1/END)"),
        ("UNDERTAKINGS", "Undertakings tracker"),
        ("COMP_STATEMENT", "Completion statement issued"),
    ],
    "REMORTGAGE": [
        ("REDEMPTION", "Redemption statement"),
        ("DS1_END", "Mortgage discharge evidence (DS1/END)"),
        ("AP1_LODGEMENT", "AP1 lodgement"),
        ("REG_COMPLETE", "Registration completed"),
    ],
    "TRANSFER": [
        ("ID_CHECKS", "ID/AML checks completed"),
        ("AP1_LODGEMENT", "AP1 lodgement"),
        ("RESTRICTIONS", "Restrictions / notices handling"),
        ("REG_COMPLETE", "Registration completed"),
    ],
}


async def seed_if_empty(db: AsyncSession) -> None:
    existing = await db.execute(select(Firm).limit(1))
    if existing.scalar_one_or_none():
        return

    now = datetime.now(timezone.utc)

    firm = Firm(id=uuid.uuid4(), name=DEMO_FIRM_NAME, created_at=now)
    db.add(firm)
    await db.flush()

    user = User(
        id=uuid.uuid4(),
        firm_id=firm.id,
        email=DEMO_USER_EMAIL,
        full_name="Demo Admin",
        password_hash=hash_password(DEMO_USER_PASSWORD),
        role="ADMIN",
        is_active=True,
        created_at=now,
    )
    db.add(user)

    client = Client(
        id=uuid.uuid4(),
        firm_id=firm.id,
        first_name="John",
        last_name="Buyer",
        email="john.buyer@example.com",
        phone="+447700900000",
        created_at=now,
    )
    db.add(client)
    await db.flush()

    matter = Matter(
        id=uuid.uuid4(),
        firm_id=firm.id,
        client_id=client.id,
        reference="DEMO-0001",
        type="PURCHASE",
        status="ONBOARDING",
        property_address="1 Demo Street, London",
        created_at=now,
        updated_at=now,
    )
    db.add(matter)
    await db.flush()

    token = secrets.token_urlsafe(24)
    req = OnboardingRequest(
        id=uuid.uuid4(),
        matter_id=matter.id,
        token=token,
        backup_code="123456",
        expires_at=now + timedelta(days=14),
        created_at=now,
    )
    db.add(req)

    for key, title in TASK_TEMPLATES[matter.type]:
        db.add(
            PostCompletionTask(
                id=uuid.uuid4(),
                matter_id=matter.id,
                template_key=key,
                title=title,
                due_date=now + timedelta(days=7),
                status="PENDING",
                notes=None,
                created_at=now,
                updated_at=now,
            )
        )

    await db.commit()
