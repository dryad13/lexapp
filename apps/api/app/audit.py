from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, User


async def audit(
    db: AsyncSession,
    *,
    firm_id,
    actor: Optional[User],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    db.add(
        AuditLog(
            firm_id=firm_id,
            actor_user_id=actor.id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata_json=metadata,
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
