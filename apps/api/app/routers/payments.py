from __future__ import annotations

import uuid
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.deps import require_roles
from app.models import Matter, Payment, OnboardingRequest
from app.schemas import PaymentIntentCreateIn, PaymentIntentCreateOut, PaymentOut
from app.audit import audit
from app.rate_limit import limiter, ONBOARD_LIMIT

router = APIRouter(prefix="/stripe", tags=["payments"])

stripe.api_key = settings.stripe_secret_key


@router.post("/client/{token}/payment-intent", response_model=PaymentIntentCreateOut)
@limiter.limit(ONBOARD_LIMIT)
async def create_payment_intent(
    request: Request,
    token: str,
    payload: PaymentIntentCreateIn,
    backup_code: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    rr = await db.execute(select(OnboardingRequest).where(OnboardingRequest.token == token))
    req = rr.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Invalid link")
    if req.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Link expired")
    if req.backup_code and backup_code and req.backup_code != backup_code:
        raise HTTPException(status_code=401, detail="Invalid backup code")

    now = datetime.now(timezone.utc)
    pay = Payment(
        id=uuid.uuid4(),
        matter_id=req.matter_id,
        amount_pence=payload.amount_pence,
        currency=payload.currency.lower(),
        status="REQUIRES_PAYMENT_METHOD",
        stripe_payment_intent_id=None,
        stripe_customer_id=None,
        created_at=now,
        updated_at=now,
    )
    db.add(pay)
    await db.flush()

    intent = stripe.PaymentIntent.create(
        amount=payload.amount_pence,
        currency=payload.currency.lower(),
        automatic_payment_methods={"enabled": True},
        metadata={"matter_id": str(req.matter_id), "payment_id": str(pay.id)},
    )

    pay.status = str(intent.status).upper()
    pay.stripe_payment_intent_id = intent.id
    pay.updated_at = now
    await db.commit()

    matter = await db.get(Matter, req.matter_id)
    await audit(db, firm_id=matter.firm_id, actor=None, action="PAYMENT_INTENT_CREATED", entity_type="Payment", entity_id=str(pay.id), metadata={"pi": intent.id, "status": pay.status})

    return PaymentIntentCreateOut(
        payment=PaymentOut(
            id=pay.id,
            matter_id=pay.matter_id,
            amount_pence=pay.amount_pence,
            currency=pay.currency,
            status=pay.status,  # type: ignore
            stripe_payment_intent_id=pay.stripe_payment_intent_id,
            created_at=pay.created_at,
            updated_at=pay.updated_at,
        ),
        client_secret=intent.client_secret,
        publishable_key=settings.stripe_publishable_key,
    )


@router.post("/webhook")
async def webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    if not sig:
        raise HTTPException(status_code=400, detail="Missing signature")

    try:
        event = stripe.Webhook.construct_event(payload=payload, sig_header=sig, secret=settings.stripe_webhook_secret)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event["type"]
    data = event["data"]["object"]

    if etype in ("payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled", "payment_intent.processing"):
        pi_id = data["id"]
        status_up = str(data["status"]).upper()
        res = await db.execute(select(Payment).where(Payment.stripe_payment_intent_id == pi_id))
        pay = res.scalar_one_or_none()
        if pay:
            pay.status = status_up
            pay.updated_at = datetime.now(timezone.utc)
            await db.commit()

            matter = await db.get(Matter, pay.matter_id)
            await audit(db, firm_id=matter.firm_id, actor=None, action="PAYMENT_STATUS_UPDATED", entity_type="Payment", entity_id=str(pay.id), metadata={"pi": pi_id, "status": status_up})

    return {"received": True}


@router.get("/matters/{matter_id}/payments", response_model=list[PaymentOut])
async def list_payments(
    matter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    mr = await db.execute(select(Matter).where(Matter.id == matter_id, Matter.firm_id == user.firm_id))
    if not mr.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Matter not found")

    pr = await db.execute(select(Payment).where(Payment.matter_id == matter_id).order_by(Payment.created_at.desc()))
    pays = pr.scalars().all()
    return [
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
    ]
