import json
from pathlib import Path
from typing import Any

import boto3


class MigrationSource:
    """Read the V1 index and building documents without target-schema knowledge."""

    def __init__(self, directory: str | None = None, bucket: str | None = None):
        if bool(directory) == bool(bucket):
            raise ValueError("set exactly one of directory or bucket")
        self.directory = Path(directory) if directory else None
        self.bucket = bucket
        self.s3 = boto3.client("s3") if bucket else None

    def _read(self, key: str) -> dict[str, Any]:
        if self.directory:
            return json.loads((self.directory / key).read_text(encoding="utf-8"))
        response = self.s3.get_object(Bucket=self.bucket, Key=key)
        return json.loads(response["Body"].read().decode("utf-8"))

    def buildings(self, index_key: str = "building-index.json") -> list[dict[str, Any]]:
        index = self._read(index_key)
        summaries = index.get("buildings")
        if not isinstance(summaries, list):
            raise ValueError("building index must contain a buildings array")
        return [
            self._read(f"building/{str(item.get('code') or item['id']).upper()}.json")
            for item in summaries
        ]
