"""
BookmarkSource port (driven port, owned by the core).

The interface BookmarkService depends on.
Implemented by repositories/supabase_bookmark_repository.py.
"""

from typing import Optional, Protocol

from models.bookmark import Bookmark


class BookmarkSource(Protocol):
    def list_bookmarks(self, user_id: str, auth_token: Optional[str] = None) -> list[Bookmark]:
        """All bookmarks of one user, newest first."""
        ...

    def add_bookmark(
        self, user_id: str, entity_id: str, entity_type: str, auth_token: Optional[str] = None
    ) -> Bookmark:
        """Insert a bookmark; raise AlreadyBookmarked on a duplicate."""
        ...

    def remove_bookmark(
        self, user_id: str, entity_id: str, auth_token: Optional[str] = None
    ) -> Optional[Bookmark]:
        """Delete a bookmark by entity id; return the deleted row or None."""
        ...
