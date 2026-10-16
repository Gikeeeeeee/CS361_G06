"""
User service (application layer).

Orchestrates user-related use cases and raises domain errors.
Layer: application / core.
"""

from typing import Optional

from errors import UserNotFound
from models.user import User
from ports.user_source import UserSource


class UserService:
    def __init__(self, source: UserSource):
        self.source = source

    def get_profile(
        self, user_id: str, auth_token: Optional[str] = None
    ) -> User:
        """Fetch user profile or raise UserNotFound."""
        user = self.source.get_user_by_id(user_id, auth_token=auth_token)
        if user is None:
            raise UserNotFound(user_id)
        return user
