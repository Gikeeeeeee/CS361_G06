"""
Driven adapter: reads building data from Amazon S3.

This is the ONLY module in the backend that imports boto3 or knows a bucket
exists. It implements `ports.building_source.BuildingSource`.

It performs no filtering and no business rules -- finding a floor, a room or a
facility inside a building record is domain work and lives in `models/` and
`services/`.

Layer: driven adapter (outbound).
"""

import json
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError

from errors import UpstreamError

_MISSING_KEY_CODES = {"NoSuchKey", "404", "NotFound"}


class BuildingRepository:
    """S3-backed implementation of the BuildingSource port."""

    def __init__(
        self,
        bucket_name: str | None = None,
        index_key: str | None = None,
        s3_client: Any = None,
    ):
        # Read env at construction time (not import time) so tests and the
        # smoke script can point this at a different bucket.
        self.bucket_name = (
            bucket_name
            if bucket_name is not None
            else os.environ.get("BUCKET_NAME", "")
        )
        self.index_key = index_key or os.environ.get(
            "BUILDINGS_FILE", "building-index.json"
        )
        self._s3_client = s3_client

    @property
    def s3_client(self):
        """Created lazily so importing this module never touches the network."""
        if self._s3_client is None:
            self._s3_client = boto3.client("s3")
        return self._s3_client

    # -- BuildingSource ----------------------------------------------------

    def list_buildings(self) -> list[dict[str, Any]]:
        """Every building summary from the building index."""
        data = self._get_json(self.index_key)

        if data is None:
            raise UpstreamError(
                f"Building index '{self.index_key}' not found in "
                f"S3 bucket '{self.bucket_name}'."
            )

        buildings = data.get("buildings")

        if not isinstance(buildings, list):
            raise UpstreamError(
                f"The building file '{self.index_key}' must contain "
                f"a 'buildings' array."
            )

        return buildings

    def get_building(self, building_id: str) -> dict[str, Any] | None:
        """
        One building's raw record, or None if no such building exists.

        Object keys are upper case (`building/LC4.json`) while callers may pass
        `lc4`, so each candidate spelling is tried in order. (The previous
        implementation recursed into itself to do this.)
        """
        for candidate in self._key_candidates(building_id):
            data = self._get_json(f"building/{candidate}.json")

            if data is not None:
                return data

        return None

    def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """A time-limited GET URL for a stored object (used for floor plans)."""
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )

    # -- internals ---------------------------------------------------------

    @staticmethod
    def _key_candidates(building_id: str) -> list[str]:
        """`['lc4', 'LC4']` -- de-duplicated, original spelling first."""
        return list(dict.fromkeys([building_id, str(building_id).upper()]))

    def _get_json(self, key: str) -> dict[str, Any] | None:
        """
        Fetch and parse one JSON object from S3.

        Returns None when the key does not exist; raises UpstreamError for any
        other storage or parsing failure.
        """
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key,
            )
            body = response["Body"].read().decode("utf-8")

            return json.loads(body)

        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")

            if error_code in _MISSING_KEY_CODES:
                return None

            if error_code == "NoSuchBucket":
                raise UpstreamError(
                    f"S3 bucket '{self.bucket_name}' does not exist."
                ) from exc

            raise UpstreamError(
                f"AWS S3 client error [{error_code}] reading '{key}'."
            ) from exc

        except json.JSONDecodeError as exc:
            raise UpstreamError(
                f"The file '{key}' contains invalid JSON data."
            ) from exc
