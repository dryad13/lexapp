from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_roles
from app.models import Matter, Firm, PostCompletionTask
from app.pdfs import build_post_completion_report_pdf
from app.audit import audit

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/matters/{matter_id}/post-completion.pdf")
async def post_completion_report(
    matter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    mr = await db.execute(select(Matter).where(Matter.id == matter_id, Matter.firm_id == user.firm_id))
    matter = mr.scalar_one_or_none()
    if not matter:
        raise HTTPException(status_code=404, detail="Matter not found")

    firm = await db.get(Firm, matter.firm_id)
    tr = await db.execute(select(PostCompletionTask).where(PostCompletionTask.matter_id == matter.id))
    tasks = tr.scalars().all()

    lines = []
    for t in tasks:
        due = t.due_date.isoformat() if t.due_date else "n/a"
        note = (t.notes or "").strip()
        lines.append(f"{t.title} | {t.status} | due: {due}" + (f" | notes: {note}" if note else ""))

    pdf = build_post_completion_report_pdf(
        firm_name=firm.name if firm else "Firm",
        matter_ref=matter.reference,
        matter_type=matter.type,
        status=matter.status,
        summary_lines=lines,
    )

    await audit(db, firm_id=user.firm_id, actor=user, action="REPORT_EXPORTED", entity_type="Matter", entity_id=str(matter.id), metadata={"report": "post-completion"})
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="post-completion-{matter.reference}.pdf"'})
