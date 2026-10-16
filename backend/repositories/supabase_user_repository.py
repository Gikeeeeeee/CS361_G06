"""
Supabase User repository (driven adapter).

Connects to Supabase PostgREST to fetch user profile data.
Layer: adapter / outbound.
"""

import logging
import os
from typing import Optional

import requests

from errors import UpstreamError
from models.user import User
from ports.user_source import UserSource

logger = logging.getLogger(__name__)

DEFAULT_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6"
    "ImhqcW13Z2F6dHF5dGpmdXpyYWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDcw"
    "OTgsImV4cCI6MjEwNzQ4MzA5OH0.0rFbYoq15FfUUNZgN_RYy1NTqpgoRMd0V2do5jhQ5Ug"
)


class SupabaseUserRepository(UserSource):
    """Fetches user records from Supabase public.User table via PostgREST."""

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

    def get_user_by_id(
        self, user_id: str, auth_token: Optional[str] = None
    ) -> Optional[User]:
        if not self.supabase_url:
            raise UpstreamError("SUPABASE_URL is not configured")

        url = f"{self.supabase_url}/rest/v1/User"
        params = {"id": f"eq.{user_id}", "select": "*"}

        headers = {
            "apikey": self.api_key,
            "Accept": "application/json",
        }
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        elif self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=5,
            )
        except requests.RequestException as exc:
            logger.warning("Failed to reach Supabase: %s", exc)
            raise UpstreamError(f"Database connection error: {exc}") from exc

        if response.status_code == 200:
            records = response.json()
            if records and isinstance(records, list):
                return User.from_record(records[0])
            return None

        if response.status_code == 404:
            return None

        logger.warning(
            "Supabase User query failed with status %d: %s",
            response.status_code,
            response.text,
        )
        raise UpstreamError(f"Database error ({response.status_code})")
