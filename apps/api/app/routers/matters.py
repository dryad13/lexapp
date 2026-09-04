from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_roles
from app.models import Client, Matter, PostCompletionTask, OnboardingSubmission, Document, Payment
from app.schemas import MatterCreate, MatterOut, MatterDashboardOut, OnboardingProgressOut, DocumentOut, PaymentOut, TaskOut
from app.audit import audit
from app.seed import TASK_TEMPLATES

router = APIRouter(prefix="/matters", tags=["matters"])


def _onboarding_progress(sub: OnboardingSubmission | None, docs: list[Document], matter_id: uuid.UUID) -> OnboardingProgressOut:
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

    have_cats = {d.category for d in docs}
    for cat in doc_required:
        if cat in have_cats:
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


@router.get("", response_model=list[MatterOut])
async def list_matters(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    res = await db.execute(select(Matter).where(Matter.firm_id == user.firm_id).order_by(Matter.created_at.desc()))
    return res.scalars().all()


@router.post("", response_model=MatterOut, status_code=status.HTTP_201_CREATED)
async def create_matter(
    data: MatterCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER")),
):
    now = datetime.now(timezone.utc)

    client = Client(
        id=uuid.uuid4(),
        firm_id=user.firm_id,
        first_name=data.client.first_name,
        last_name=data.client.last_name,
        email=str(data.client.email) if data.client.email else None,
        phone=data.client.phone,
        joint_first_name=data.client.joint_first_name,
        joint_last_name=data.client.joint_last_name,
        created_at=now,
    )
    db.add(client)
    await db.flush()

    matter = Matter(
        id=uuid.uuid4(),
        firm_id=user.firm_id,
        client_id=client.id,
        reference=data.reference,
        type=data.type,
        status="ONBOARDING",
        property_address=data.property_address,
        created_at=now,
        updated_at=now,
    )
    db.add(matter)
    await db.flush()

    templates = TASK_TEMPLATES.get(data.type, [])
    for key, title in templates:
        db.add(
            PostCompletionTask(
                id=uuid.uuid4(),
                matter_id=matter.id,
                template_key=key,
                title=title,
                due_date=now,
                status="PENDING",
                notes=None,
                created_at=now,
                updated_at=now,
            )
        )

    await db.commit()
    await audit(db, firm_id=user.firm_id, actor=user, action="MATTER_CREATED", entity_type="Matter", entity_id=str(matter.id), metadata={"reference": data.reference, "type": data.type})
    return matter


@router.get("/{matter_id}", response_model=MatterDashboardOut)
async def get_matter_dashboard(
    matter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    mr = await db.execute(select(Matter).where(Matter.id == matter_id, Matter.firm_id == user.firm_id))
    matter = mr.scalar_one_or_none()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    subr = await db.execute(select(OnboardingSubmission).where(OnboardingSubmission.matter_id == matter.id))
    sub = subr.scalar_one_or_none()

    docr = await db.execute(select(Document).where(Document.matter_id == matter.id).order_by(Document.created_at.desc()))
    docs = docr.scalars().all()

    payr = await db.execute(select(Payment).where(Payment.matter_id == matter.id).order_by(Payment.created_at.desc()))
    pays = payr.scalars().all()

    taskr = await db.execute(select(PostCompletionTask).where(PostCompletionTask.matter_id == matter.id).order_by(PostCompletionTask.created_at.asc()))
    tasks = taskr.scalars().all()

    onboarding = _onboarding_progress(sub, docs, matter.id)

    def doc_out(d: Document) -> DocumentOut:
        return DocumentOut(
            id=d.id,
            matter_id=d.matter_id,
            category=d.category,  # type: ignore
            original_filename=d.original_filename,
            mime_type=d.mime_type,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
            download_url=f"/api/v1/documents/{d.id}/download",
        )

    return MatterDashboardOut(
        matter=MatterOut.model_validate(matter),
        onboarding=onboarding,
        documents=[doc_out(d) for d in docs],
        payments=[
            PaymentOut(
                id=p.id,
                matter_id=p.matter_id,
                amount_pence=p.amount_pence,
                currency=p.currency,
                status=p.status,  # type: ignore
                stripe_payment_intent_id=p.stripe_payment_intent_id,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
            for p in pays
        ],
        tasks=[
            TaskOut(
                id=t.id,
                matter_id=t.matter_id,
                template_key=t.template_key,
                title=t.title,
                due_date=t.due_date,
                status=t.status,  # type: ignore
                notes=t.notes,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in tasks
        ],
    )
