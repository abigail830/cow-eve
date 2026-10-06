from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON


class Base(DeclarativeBase):
    pass


class ProductRow(Base):
    __tablename__ = "pk_product"
    __table_args__ = (
        UniqueConstraint("business_unit", "sku", name="uq_pk_product_bu_sku"),
    )

    business_unit: Mapped[str] = mapped_column(String(128), primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), primary_key=True)
    product_name: Mapped[str] = mapped_column(String(512))
    product_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    service_name_on_proposal: Mapped[str | None] = mapped_column(String(512), nullable=True)
    scope_of_work: Mapped[str | None] = mapped_column(Text, nullable=True)
    sku_semantic_for_ai: Mapped[str | None] = mapped_column(Text, nullable=True)
    billing_frequency: Mapped[str | None] = mapped_column(String(64), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(16), nullable=True)
    price: Mapped[str | None] = mapped_column(String(64), nullable=True)
    recurring: Mapped[str | None] = mapped_column(String(64), nullable=True)
    standard_pricing_matrix: Mapped[str | None] = mapped_column(Text, nullable=True)
    department_team: Mapped[str | None] = mapped_column(String(128), nullable=True)
    status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    jurisdictions: Mapped[list[str]] = mapped_column(JSON, default=list)


class PackageRow(Base):
    __tablename__ = "pk_package"
    __table_args__ = (
        UniqueConstraint("business_unit", "package_id", name="uq_pk_package_bu_id"),
    )

    business_unit: Mapped[str] = mapped_column(String(128), primary_key=True)
    package_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    package_name: Mapped[str] = mapped_column(String(512))
    package_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    package_semantic_for_ai: Mapped[str | None] = mapped_column(Text, nullable=True)
    linked_skus: Mapped[list[str]] = mapped_column(JSON, default=list)


class PersonRow(Base):
    __tablename__ = "pk_person"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    business_unit: Mapped[str] = mapped_column(String(128), index=True)
    display_name: Mapped[str] = mapped_column(String(256))
    department: Mapped[str] = mapped_column(String(128))
    title: Mapped[str] = mapped_column(String(256))
    bio: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    region: Mapped[str] = mapped_column(String(128))
    avatar_blob_path: Mapped[str | None] = mapped_column(String(512), nullable=True)


class ApiKeyRow(Base):
    __tablename__ = "pk_api_key"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    label: Mapped[str] = mapped_column(String(128))
    key_prefix: Mapped[str] = mapped_column(String(16), index=True)
    key_hash: Mapped[str] = mapped_column(String(128))
    scopes: Mapped[list[str]] = mapped_column(JSON, default=list)
    allowed_business_units: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    allow_all_business_units: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
