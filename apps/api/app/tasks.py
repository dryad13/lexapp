from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.celery_app import celery
from app.db import AsyncSessionLocal
from app.mailer import ConsoleMailer, EmailMessage
from app.models import Matter, Firm, Client, OnboardingRequest
from app.config import settings


@celery.task(name="app.tasks.send_onboarding_email")
def send_onboarding_email(firm_id: str, matter_id: str) -> dict:
    return _run_send_onboarding_email(firm_id, matter_id)


def _run_send_onboarding_email(firm_id: str, matter_id: str) -> dict:
    mailer = ConsoleMailer()

    async def _inner():
        async with AsyncSessionLocal() as db:  # type: AsyncSession
            mr = await db.execute(select(Matter).where(Matter.id == matter_id))
            matter = mr.scalar_one_or_none()
            if not matter:
                return {"sent": False, "reason": "matter not found"}

            firm = await db.get(Firm, matter.firm_id)
            client = await db.get(Client, matter.client_id) if matter.client_id else None

            rr = await db.execute(
                select(OnboardingRequest).where(OnboardingRequest.matter_id == matter.id).order_by(OnboardingRequest.created_at.desc()).limit(1)
            )
            req = rr.scalar_one_or_none()
            if not req:
                return {"sent": False, "reason": "no onboarding request"}

            link = f"{settings.client_portal_origin}/o/{req.token}"
            to = (client.email if client and client.email else "client@example.com")

            mailer.send(
                EmailMessage(
                    to=to,
                    subject=f"{firm.name if firm else 'Your firm'} – Onboarding link for matter {matter.reference}",
                    body="\n".join(
                        [
                            "Hello,",
                            "",
                            "Please complete your onboarding via the secure link below:",
                            link,
                            "",
                            f"Backup code (if requested): {req.backup_code or '(none)'}",
                            "",
                            f"Sent: {datetime.now(timezone.utc).isoformat()}",
                        ]
                    ),
                )
            )
            return {"sent": True, "to": to, "link": link}

    import asyncio
    return asyncio.run(_inner())
