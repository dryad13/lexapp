from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import require_roles
from app.models import Matter, OnboardingRequest, OnboardingSubmission, Document
from app.schemas import OnboardingRequestOut, OnboardingProgressOut, OnboardingUpsert
from app.audit import audit
from app.rate_limit import limiter, ONBOARD_LIMIT
from app.celery_app import celery

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _calc_progress(sub: OnboardingSubmission | None, docs: list[Document], matter_id: uuid.UUID) -> OnboardingProgressOut:
    required = [
        ("personal_details", "Personal details"),
        ("address_history", "Address history"),
        ("sof", "Source of funds"),
        ("consents", "Consents"),
    ]
    doc_required = ["ID", "SELFIE", "POA"]
    missing = []
    done = 0
    total = len(required) + len(doc_required)

    if sub:
        for key, label in required:
            if getattr(sub, key) is not None:
                done += 1
            else:
                missing.append(label)
    else:
        missing.extend([label for _, label in required])

    have = {d.category for d in docs}
    for cat in doc_required:
        if cat in have:
            done += 1
        else:
            missing.append(f"Document: {cat}")

    percent = int((done / total) * 100)
    return OnboardingProgressOut(
        matter_id=matter_id,
        is_complete=bool(sub.is_complete) if sub else False,
        completed_at=sub.completed_at if sub else None,
        percent=percent,
        missing=missing,
        personal_details=sub.personal_details if sub else None,
        address_history=sub.address_history if sub else None,
        sof=sub.sof if sub else None,
        consents=sub.consents if sub else None,
    )


@router.post("/matters/{matter_id}/request", response_model=OnboardingRequestOut)
async def create_onboarding_request(
    matter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    mr = await db.execute(select(Matter).where(Matter.id == matter_id, Matter.firm_id == user.firm_id))
    matter = mr.scalar_one_or_none()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    now = datetime.now(timezone.utc)
    token = secrets.token_urlsafe(24)
    backup = f"{secrets.randbelow(1_000_000):06d}"

    req = OnboardingRequest(
        id=uuid.uuid4(),
        matter_id=matter.id,
        token=token,
        backup_code=backup,
        expires_at=now + timedelta(days=14),
        created_at=now,
    )
    db.add(req)
    await db.commit()

    await audit(db, firm_id=user.firm_id, actor=user, action="ONBOARDING_REQUEST_CREATED", entity_type="Matter", entity_id=str(matter.id))
    link = f"{settings.client_portal_origin}/o/{token}"
    return OnboardingRequestOut(
        id=req.id,
        matter_id=req.matter_id,
        token=req.token,
        expires_at=req.expires_at,
        backup_code=req.backup_code,
        created_at=req.created_at,
        link=link,
    )


@router.post("/matters/{matter_id}/send-email")
async def send_onboarding_email(
    matter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    celery.send_task("app.tasks.send_onboarding_email", args=[str(user.firm_id), str(matter_id)])
    await audit(db, firm_id=user.firm_id, actor=user, action="ONBOARDING_EMAIL_QUEUED", entity_type="Matter", entity_id=str(matter_id))
    return {"queued": True}


async def _resolve_request(db: AsyncSession, token: str, backup_code: str | None) -> OnboardingRequest:
    rr = await db.execute(select(OnboardingRequest).where(OnboardingRequest.token == token))
    req = rr.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Invalid link")
    if req.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Link expired")
    if req.backup_code and backup_code and req.backup_code != backup_code:
        raise HTTPException(status_code=401, detail="Invalid backup code")
    return req


@router.get("/client/{token}", response_model=OnboardingProgressOut)
@limiter.limit(ONBOARD_LIMIT)
async def client_get_progress(request: Request, token: str, backup_code: str | None = None, db: AsyncSession = Depends(get_db)):
    req = await _resolve_request(db, token, backup_code)
    subr = await db.execute(select(OnboardingSubmission).where(OnboardingSubmission.matter_id == req.matter_id))
    sub = subr.scalar_one_or_none()
    docr = await db.execute(select(Document).where(Document.matter_id == req.matter_id))
    docs = docr.scalars().all()
    return _calc_progress(sub, docs, req.matter_id)


@router.put("/client/{token}", response_model=OnboardingProgressOut)
@limiter.limit(ONBOARD_LIMIT)
async def client_upsert(request: Request, token: str, data: OnboardingUpsert, backup_code: str | None = None, db: AsyncSession = Depends(get_db)):
    req = await _resolve_request(db, token, backup_code)

    subr = await db.execute(select(OnboardingSubmission).where(OnboardingSubmission.matter_id == req.matter_id))
    sub = subr.scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if not sub:
        sub = OnboardingSubmission(
            id=uuid.uuid4(),
            matter_id=req.matter_id,
            personal_details=data.personal_details,
            address_history=data.address_history,
            sof=data.sof,
            consents=data.consents,
            is_complete=False,
            completed_at=None,
            created_at=now,
            updated_at=now,
        )
        db.add(sub)
    else:
        if data.personal_details is not None:
            sub.personal_details = data.personal_details
        if data.address_history is not None:
            sub.address_history = data.address_history
        if data.sof is not None:
            sub.sof = data.sof
        if data.consents is not None:
            sub.consents = data.consents
        sub.updated_at = now

    docr = await db.execute(select(Document).where(Document.matter_id == req.matter_id))
    docs = docr.scalars().all()
    have = {d.category for d in docs}
    steps_ok = all([
        sub.personal_details is not None,
        sub.address_history is not None,
        sub.sof is not None,
        sub.consents is not None,
        {"ID", "SELFIE", "POA"}.issubset(have)
    ])
    if steps_ok and not sub.is_complete:
        sub.is_complete = True
        sub.completed_at = now

    await db.commit()

    matter = await db.get(Matter, req.matter_id)
    await audit(db, firm_id=matter.firm_id, actor=None, action="ONBOARDING_UPDATED", entity_type="Matter", entity_id=str(req.matter_id), metadata={"is_complete": sub.is_complete})

    return _calc_progress(sub, docs, req.matter_id)
