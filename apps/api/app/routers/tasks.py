from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_roles
from app.models import PostCompletionTask, Matter
from app.schemas import TaskOut, TaskUpdate
from app.audit import audit

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/matters/{matter_id}", response_model=list[TaskOut])
async def list_tasks(
    matter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    mr = await db.execute(select(Matter).where(Matter.id == matter_id, Matter.firm_id == user.firm_id))
    if not mr.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Matter not found")

    tr = await db.execute(select(PostCompletionTask).where(PostCompletionTask.matter_id == matter_id).order_by(PostCompletionTask.created_at.asc()))
    tasks = tr.scalars().all()
    return [
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
    ]


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_roles("ADMIN", "FEE_EARNER", "ASSISTANT")),
):
    task = await db.get(PostCompletionTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    matter = await db.get(Matter, task.matter_id)
    if not matter or matter.firm_id != user.firm_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if data.due_date is not None:
        task.due_date = data.due_date
    if data.status is not None:
        task.status = data.status
    if data.notes is not None:
        task.notes = data.notes

    task.updated_at = datetime.now(timezone.utc)
    await db.commit()

    await audit(db, firm_id=user.firm_id, actor=user, action="TASK_UPDATED", entity_type="PostCompletionTask", entity_id=str(task.id), metadata={"status": task.status})

    return TaskOut(
        id=task.id,
        matter_id=task.matter_id,
        template_key=task.template_key,
        title=task.title,
        due_date=task.due_date,
        status=task.status,  # type: ignore
        notes=task.notes,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
