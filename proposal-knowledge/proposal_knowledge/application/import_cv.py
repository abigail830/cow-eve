from __future__ import annotations

import json
import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from proposal_knowledge.infrastructure.db.models import PersonRow


def import_people_json(session: Session, path: Path) -> int:
    """Import CV rows from a JSON array (admin/ops; not from xlsx)."""
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of person objects.")

    count = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        bu = str(item.get("business_unit", "")).strip()
        display_name = str(item.get("display_name", "")).strip()
        department = str(item.get("department", "")).strip()
        title = str(item.get("title", "")).strip()
        region = str(item.get("region", "")).strip()
        if not bu or not display_name or not department or not title:
            raise ValueError(
                "Each person needs business_unit, display_name, department, title."
            )
        person_id = str(item.get("id", "")).strip() or str(uuid.uuid4())
        bio = str(item.get("bio", "") or "")
        phone = item.get("phone")
        phone_str = str(phone).strip() if phone is not None else None
        avatar = item.get("avatar_blob_path")
        avatar_str = str(avatar).strip() if avatar else None

        existing = session.get(PersonRow, person_id)
        if existing:
            existing.business_unit = bu
            existing.display_name = display_name
            existing.department = department
            existing.title = title
            existing.bio = bio
            existing.phone = phone_str
            existing.region = region
            existing.avatar_blob_path = avatar_str
        else:
            session.add(
                PersonRow(
                    id=person_id,
                    business_unit=bu,
                    display_name=display_name,
                    department=department,
                    title=title,
                    bio=bio,
                    phone=phone_str,
                    region=region,
                    avatar_blob_path=avatar_str,
                )
            )
        count += 1
    return count
