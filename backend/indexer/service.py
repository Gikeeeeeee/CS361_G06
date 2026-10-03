from __future__ import annotations

import os
from typing import Any

import boto3
from opensearchpy import (
    AWSV4SignerAuth,
    OpenSearch,
    RequestsHttpConnection,
)

from indexer.mapper import (
    get_deleted_document_id,
    map_stream_image,
)


class IndexerService:
    def __init__(
        self,
        *,
        client: OpenSearch | None = None,
        index_name: str | None = None,
    ) -> None:
        self.index_name = (
            index_name
            or os.getenv("OPENSEARCH_INDEX", "university")
        )

        self.client = client or self._create_client()

    @staticmethod
    def _create_client() -> OpenSearch:
        endpoint = os.environ["OPENSEARCH_ENDPOINT"]
        endpoint = (
            endpoint
            .replace("https://", "")
            .replace("http://", "")
            .rstrip("/")
        )

        region = os.getenv(
            "AWS_REGION",
            "us-east-1",
        )

        credentials = boto3.Session().get_credentials()

        if credentials is None:
            raise RuntimeError(
                "AWS credentials are unavailable."
            )

        auth = AWSV4SignerAuth(
            credentials,
            region,
            service="aoss",
        )

        return OpenSearch(
            hosts=[
                {
                    "host": endpoint,
                    "port": 443,
                }
            ],
            http_auth=auth,
            use_ssl=True,
            verify_certs=True,
            connection_class=RequestsHttpConnection,
            timeout=10,
            max_retries=2,
            retry_on_timeout=True,
        )

    def index_record(self, image: dict[str, Any]) -> None:
        document = map_stream_image(image)

        document_id = document["id"]

        self.client.index(
            index=self.index_name,
            id=document_id,
            body=document,
            refresh=False,
        )

    def delete_record(self, keys: dict[str, Any]) -> None:
        document_id = get_deleted_document_id(keys)

        try:
            self.client.delete(
                index=self.index_name,
                id=document_id,
                refresh=False,
            )
        except Exception as exc:
            # OpenSearch can return a not-found error if the projection
            # is already missing. That should not break the stream.
            error_info = getattr(exc, "info", {})

            if (
                isinstance(error_info, dict)
                and error_info.get("result") == "not_found"
            ):
                return

            raise

    def process_record(self, record: dict[str, Any]) -> None:
        event_name = record.get("eventName")

        if event_name in {"INSERT", "MODIFY"}:
            dynamodb = record.get("dynamodb", {})
            new_image = dynamodb.get("NewImage")

            if not new_image:
                raise ValueError(
                    f"{event_name} record has no NewImage."
                )

            self.index_record(new_image)
            return

        if event_name == "REMOVE":
            dynamodb = record.get("dynamodb", {})
            keys = dynamodb.get("Keys")

            if not keys:
                raise ValueError(
                    "REMOVE record has no Keys."
                )

            self.delete_record(keys)
            return

        # Ignore events we do not currently support.
        if event_name:
            print(
                f"Ignoring unsupported DynamoDB event: "
                f"{event_name}"
            )

    def process_event(
        self,
        event: dict[str, Any],
    ) -> None:
        records = event.get("Records", [])

        for record in records:
            self.process_record(record)