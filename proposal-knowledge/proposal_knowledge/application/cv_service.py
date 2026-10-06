from __future__ import annotations

from sqlalchemy import distinct, or_, select
from sqlalchemy.orm import Session

from proposal_knowledge.config import get_settings, resolve_avatar_public_base_url
from proposal_knowledge.domain.auth import AuthorizedContext
from proposal_knowledge.infrastructure.db.models import PersonRow


def list_departments(
    session: Session, auth: AuthorizedContext, *, business_unit: str
) -> list[str]:
    auth.require_business_unit(business_unit)
    rows = session.scalars(
        select(distinct(PersonRow.department)).where(
            PersonRow.business_unit == business_unit
        )
    ).all()
    return sorted(r for r in rows if r)


def search_people(
    session: Session,
    auth: AuthorizedContext,
    *,
    business_unit: str,
    query: str = "",
    department: str | None = None,
    limit: int = 25,
) -> list[dict]:
    auth.require_business_unit(business_unit)
    limit = max(1, min(limit, 50))
    stmt = select(PersonRow).where(PersonRow.business_unit == business_unit)
    if department and department.strip():
        stmt = stmt.where(PersonRow.department == department.strip())
    q = query.strip()
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                PersonRow.display_name.ilike(like),
                PersonRow.title.ilike(like),
                PersonRow.bio.ilike(like),
            )
        )
    rows = session.scalars(stmt.limit(limit)).all()
    return [_person_dict(r) for r in rows]


def get_person(session: Session, auth: AuthorizedContext, *, person_id: str) -> dict:
    row = session.get(PersonRow, person_id)
    if row is None:
        raise LookupError("Person not found.")
    auth.require_business_unit(row.business_unit)
    return _person_dict(row)


def _person_dict(row: PersonRow) -> dict:
    return {
        "id": row.id,
        "business_unit": row.business_unit,
        "display_name": row.display_name,
        "department": row.department,
        "title": row.title,
        "bio": _truncate(row.bio, 2000),
        "phone": row.phone,
        "region": row.region,
        "avatar_url": _avatar_url(row.avatar_blob_path),
    }


def _avatar_url(path: str | None) -> str | None:
    if not path:
        return None
    if path.startswith("http://") or path.startswith("https://"):
        return path
    base = resolve_avatar_public_base_url(get_settings())
    if not base:
        return None
    rel = path.lstrip("/")
    return f"{base}/{rel}"


def _truncate(text: str | None, max_len: int) -> str:
    if not text:
        return ""
    if len(text) <= max_len:
        return text
    return text[: max_len - 3] + "..."
