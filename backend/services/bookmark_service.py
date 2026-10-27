"""
Bookmark service (application layer).

Validates bookmark input and raises domain errors.
Layer: application / core.
"""

from typing import Any, Optional

from errors import BookmarkNotFound, InvalidBookmark, MissingParameters
from models.bookmark import BOOKMARK_TYPES, Bookmark
from ports.bookmark_source import BookmarkSource


class BookmarkService:
    def __init__(self, source: BookmarkSource):
        self.source = source

    def list_bookmarks(self, user_id: str, auth_token: Optional[str] = None) -> list[Bookmark]:
        return self.source.list_bookmarks(user_id, auth_token=auth_token)

    def add_bookmark(
        self, user_id: str, body: Any, auth_token: Optional[str] = None
    ) -> Bookmark:
        if not isinstance(body, dict):
            raise InvalidBookmark.not_object()

        entity_id = str(body.get("entity_id") or "").strip()
        entity_type = str(body.get("entity_type") or "").strip().upper()

        missing = [
            name
            for name, value in (("entity_id", entity_id), ("entity_type", entity_type))
            if not value
        ]
        if missing:
            raise MissingParameters(missing)

        if entity_type not in BOOKMARK_TYPES:
            raise InvalidBookmark.bad_type(entity_type)

        return self.source.add_bookmark(user_id, entity_id, entity_type, auth_token=auth_token)

    def remove_bookmark(
        self, user_id: str, entity_id: str, auth_token: Optional[str] = None
    ) -> Bookmark:
        bookmark = self.source.remove_bookmark(user_id, entity_id, auth_token=auth_token)
        if bookmark is None:
            raise BookmarkNotFound(entity_id)
        return bookmark
