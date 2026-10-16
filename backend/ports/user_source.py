"""
UserSource port (driven port, owned by the core).

The interface UserService depends on.
Implemented by repositories/supabase_user_repository.py.
"""

from typing import Optional, Protocol
from models.user import User


class UserSource(Protocol):
    def get_user_by_id(self, user_id: str, auth_token: Optional[str] = None) -> Optional[User]:
        """Fetch user profile by user UUID (auth.users id)."""
        ...
