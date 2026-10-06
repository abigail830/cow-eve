from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AuthorizedContext:
    key_id: str
    scopes: frozenset[str]
    allowed_business_units: frozenset[str] | None
    """None means all BUs (bu:*)."""

    def has_endpoint(self, scope: str) -> bool:
        return scope in self.scopes

    def allows_business_unit(self, business_unit: str) -> bool:
        if self.allowed_business_units is None:
            return True
        return business_unit in self.allowed_business_units

    def require_business_unit(self, business_unit: str) -> None:
        if not self.allows_business_unit(business_unit):
            raise PermissionError(f"API key is not authorized for business unit {business_unit!r}.")
