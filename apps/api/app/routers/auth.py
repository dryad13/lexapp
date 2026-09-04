from fastapi import APIRouter, Body, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import User
from app.schemas import LoginIn, TokenPair, RefreshIn
from app.security import verify_password, create_token, access_ttl, refresh_ttl, decode_token
from app.audit import audit
from app.rate_limit import limiter, AUTH_LIMIT

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenPair)
@limiter.limit(AUTH_LIMIT)
async def login(request: Request, data: LoginIn = Body(...), db: AsyncSession = Depends(get_db)) -> TokenPair:
    res = await db.execute(select(User).where(User.email == data.email))
    user = res.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    access = create_token(str(user.id), "access", access_ttl(), extra={"firm_id": str(user.firm_id), "role": user.role})
    refresh = create_token(str(user.id), "refresh", refresh_ttl(), extra={"firm_id": str(user.firm_id)})

    await audit(db, firm_id=user.firm_id, actor=user, action="LOGIN", entity_type="User", entity_id=str(user.id))
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
@limiter.limit(AUTH_LIMIT)
async def refresh(request: Request, data: RefreshIn = Body(...), db: AsyncSession = Depends(get_db)) -> TokenPair:
    try:
        payload = decode_token(data.refresh_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if payload.get("typ") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user_id = payload.get("sub")
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

    access = create_token(str(user.id), "access", access_ttl(), extra={"firm_id": str(user.firm_id), "role": user.role})
    refresh2 = create_token(str(user.id), "refresh", refresh_ttl(), extra={"firm_id": str(user.firm_id)})

    await audit(db, firm_id=user.firm_id, actor=user, action="TOKEN_REFRESH", entity_type="User", entity_id=str(user.id))
    return TokenPair(access_token=access, refresh_token=refresh2)
