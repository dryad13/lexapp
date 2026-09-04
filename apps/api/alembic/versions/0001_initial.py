from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        "firms",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("firm_id", sa.Uuid(), sa.ForeignKey("firms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, index=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("firm_id", "email", name="uq_users_firm_email"),
    )

    op.create_table(
        "clients",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("firm_id", sa.Uuid(), sa.ForeignKey("firms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("first_name", sa.String(length=120), nullable=False),
        sa.Column("last_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("joint_first_name", sa.String(length=120), nullable=True),
        sa.Column("joint_last_name", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_clients_firm_id", "firm_id"),
    )

    op.create_table(
        "matters",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("firm_id", sa.Uuid(), sa.ForeignKey("firms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Uuid(), sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reference", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("property_address", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("firm_id", "reference", name="uq_matters_firm_reference"),
        sa.Index("ix_matters_firm_id", "firm_id"),
    )

    op.create_table(
        "onboarding_requests",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("matter_id", sa.Uuid(), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False, unique=True, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("backup_code", sa.String(length=16), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "onboarding_submissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("matter_id", sa.Uuid(), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("personal_details", sa.JSON(), nullable=True),
        sa.Column("address_history", sa.JSON(), nullable=True),
        sa.Column("sof", sa.JSON(), nullable=True),
        sa.Column("consents", sa.JSON(), nullable=True),
        sa.Column("is_complete", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("matter_id", sa.Uuid(), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uploader_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_documents_matter_id", "matter_id"),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("matter_id", sa.Uuid(), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_pence", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("stripe_payment_intent_id", sa.String(length=128), nullable=True, index=True),
        sa.Column("stripe_customer_id", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_payments_matter_id", "matter_id"),
    )

    op.create_table(
        "post_completion_tasks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("matter_id", sa.Uuid(), sa.ForeignKey("matters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_key", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_tasks_matter_id", "matter_id"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("firm_id", sa.Uuid(), sa.ForeignKey("firms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=120), nullable=True),
        sa.Column("entity_id", sa.String(length=120), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Index("ix_audit_firm_id", "firm_id"),
        sa.Index("ix_audit_action", "action"),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("post_completion_tasks")
    op.drop_table("payments")
    op.drop_table("documents")
    op.drop_table("onboarding_submissions")
    op.drop_table("onboarding_requests")
    op.drop_table("matters")
    op.drop_table("clients")
    op.drop_table("users")
    op.drop_table("firms")
