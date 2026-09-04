from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["ADMIN", "FEE_EARNER", "ASSISTANT"]
MatterType = Literal["PURCHASE", "SALE", "REMORTGAGE", "TRANSFER"]
DocCategory = Literal["ID", "POA", "SOF", "MORTGAGE_OFFER", "SIGNED_DEED", "SELFIE", "OTHER"]
PaymentStatus = Literal["REQUIRES_PAYMENT_METHOD", "REQUIRES_CONFIRMATION", "PROCESSING", "SUCCEEDED", "CANCELED", "FAILED"]
TaskStatus = Literal["PENDING", "IN_PROGRESS", "COMPLETED"]


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str


class ClientIn(BaseModel):
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    joint_first_name: Optional[str] = None
    joint_last_name: Optional[str] = None


class MatterCreate(BaseModel):
    reference: str = Field(min_length=3, max_length=64)
    type: MatterType
    property_address: Optional[str] = None
    client: ClientIn


class MatterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    firm_id: UUID
    client_id: Optional[UUID]
    reference: str
    type: MatterType
    status: str
    property_address: Optional[str]
    created_at: datetime
    updated_at: datetime


class OnboardingRequestOut(BaseModel):
    id: UUID
    matter_id: UUID
    token: str
    expires_at: datetime
    backup_code: Optional[str]
    created_at: datetime
    link: str


class OnboardingProgressOut(BaseModel):
    matter_id: UUID
    is_complete: bool
    completed_at: Optional[datetime]
    percent: int
    missing: list[str]
    personal_details: Optional[dict[str, Any]] = None
    address_history: Optional[list[dict[str, Any]]] = None
    sof: Optional[dict[str, Any]] = None
    consents: Optional[dict[str, Any]] = None


class OnboardingUpsert(BaseModel):
    personal_details: Optional[dict[str, Any]] = None
    address_history: Optional[list[dict[str, Any]]] = None
    sof: Optional[dict[str, Any]] = None
    consents: Optional[dict[str, Any]] = None


class DocumentOut(BaseModel):
    id: UUID
    matter_id: UUID
    category: DocCategory
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime
    download_url: str


class PaymentIntentCreateIn(BaseModel):
    amount_pence: int = Field(gt=0, le=5_000_000)
    currency: str = Field(default="gbp", min_length=3, max_length=8)


class PaymentOut(BaseModel):
    id: UUID
    matter_id: UUID
    amount_pence: int
    currency: str
    status: PaymentStatus
    stripe_payment_intent_id: Optional[str]
    created_at: datetime
    updated_at: datetime


class PaymentIntentCreateOut(BaseModel):
    payment: PaymentOut
    client_secret: str
    publishable_key: str


class TaskOut(BaseModel):
    id: UUID
    matter_id: UUID
    template_key: str
    title: str
    due_date: Optional[datetime]
    status: TaskStatus
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class TaskUpdate(BaseModel):
    due_date: Optional[datetime] = None
    status: Optional[TaskStatus] = None
    notes: Optional[str] = None


class MatterDashboardOut(BaseModel):
    matter: MatterOut
    onboarding: OnboardingProgressOut
    documents: list[DocumentOut]
    payments: list[PaymentOut]
    tasks: list[TaskOut]
