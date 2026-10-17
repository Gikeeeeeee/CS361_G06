"""
Supabase Bookmark repository (driven adapter).

Reads/writes public.User_Bookmark through Supabase PostgREST.
Requests carry the caller's JWT so Row Level Security scopes every row to them.
Layer: adapter / outbound.
"""

import logging
import os
from typing import Optional

import requests

from errors import AlreadyBookmarked, UpstreamError
from models.bookmark import Bookmark
from ports.bookmark_source import BookmarkSource
from repositories.supabase_user_repository import DEFAULT_ANON_KEY

logger = logging.getLogger(__name__)

# Postgres unique_violation. PostgREST also answers 409 for FK violations,
# so the status code alone does not mean "duplicate".
UNIQUE_VIOLATION = "23505"


class SupabaseBookmarkRepository(BookmarkSource):
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        api_key: Optional[str] = None,
    ):
        self.supabase_url = (
            supabase_url
            or os.environ.get("SUPABASE_URL")
            or ""
        ).rstrip("/")
        self.api_key = (
            api_key
            or os.environ.get("SUPABASE_ANON_KEY")
            or os.environ.get("SUPABASE_KEY")
            or DEFAULT_ANON_KEY
        )

    def list_bookmarks(self, user_id: str, auth_token: Optional[str] = None) -> list[Bookmark]:
        response = self._request(
            "GET",
            auth_token,
            params={"user_id": f"eq.{user_id}", "select": "*", "order": "saved_at.desc"},
        )
        if response.status_code == 200:
            return [Bookmark.from_record(record) for record in response.json()]
        raise self._upstream(response)

    def add_bookmark(
        self, user_id: str, entity_id: str, entity_type: str, auth_token: Optional[str] = None
    ) -> Bookmark:
        response = self._request(
            "POST",
            auth_token,
            json={"user_id": user_id, "entity_id": entity_id, "entity_type": entity_type},
        )
        if response.status_code == 201:
            return Bookmark.from_record(response.json()[0])
        if response.status_code == 409 and self._pg_code(response) == UNIQUE_VIOLATION:
            raise AlreadyBookmarked()
        raise self._upstream(response)

    def remove_bookmark(
        self, user_id: str, entity_id: str, auth_token: Optional[str] = None
    ) -> Optional[Bookmark]:
        response = self._request(
            "DELETE",
            auth_token,
            params={"user_id": f"eq.{user_id}", "entity_id": f"eq.{entity_id}"},
        )
        if response.status_code == 200:
            records = response.json()
            return Bookmark.from_record(records[0]) if records else None
        raise self._upstream(response)

    def _request(self, method: str, auth_token: Optional[str], **kwargs) -> requests.Response:
        if not self.supabase_url:
            raise UpstreamError("SUPABASE_URL is not configured")

        headers = {
            "apikey": self.api_key,
            "Accept": "application/json",
            "Authorization": f"Bearer {auth_token or self.api_key}",
            "Prefer": "return=representation",
        }
        try:
            return requests.request(
                method,
                f"{self.supabase_url}/rest/v1/User_Bookmark",
                headers=headers,
                timeout=5,
                **kwargs,
            )
        except requests.RequestException as exc:
            logger.warning("Failed to reach Supabase: %s", exc)
            raise UpstreamError(f"Database connection error: {exc}") from exc

    @staticmethod
    def _pg_code(response: requests.Response) -> Optional[str]:
        try:
            return response.json().get("code")
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def _upstream(response: requests.Response) -> UpstreamError:
        logger.warning(
            "Supabase User_Bookmark query failed with status %d: %s",
            response.status_code,
            response.text,
        )
        return UpstreamError(f"Database error ({response.status_code})")
