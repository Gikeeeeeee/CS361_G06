import os

import boto3
from opensearchpy import (
    AWSV4SignerAuth,
    OpenSearch,
    RequestsHttpConnection,
)
from opensearchpy.exceptions import ConnectionError, ConnectionTimeout

from errors import SearchServiceUnavailable
from models.search import SearchQuery, SearchResult


class OpenSearchRepository:
    def __init__(
        self,
        endpoint: str | None = None,
        *,
        index_name: str | None = None,
        region: str | None = None,
    ) -> None:
        endpoint = (
            endpoint
            or os.environ["OPENSEARCH_ENDPOINT"]
        )

        self.index_name = (
            index_name
            or os.getenv(
                "OPENSEARCH_INDEX",
                "university",
            )
        )

        region = (
            region
            or os.getenv(
                "AWS_REGION",
                "us-east-1",
            )
        )

        endpoint = (
            endpoint
            .replace("https://", "")
            .rstrip("/")
        )

        credentials = (
            boto3.Session()
            .get_credentials()
        )

        if credentials is None:
            raise RuntimeError(
                "AWS credentials are unavailable."
            )

        auth = AWSV4SignerAuth(
            credentials,
            region,
            service="aoss",
        )

        self.client = OpenSearch(
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
            timeout=60,
            max_retries=2,
            retry_on_timeout=True,
        )

    def search(
        self,
        query: SearchQuery,
    ) -> tuple[int, list[SearchResult]]:
        fields = [
            "code^10",
            "room_number^10",
            "course_code^10",
            "title^6",
            "title_en^5",
            "title_th^5",
            "organizer^3",
            "description_en^2",
            "description_th^2",
        ]

        filters = []

        if query.entity_type:
            if query.entity_type in {
                "building",
                "room",
                "facility",
                "schedule",
            }:
                filters.append(
                    {
                        "term": {
                            "entity_type.keyword": (
                                query.entity_type.upper()
                            ),
                        }
                    }
                )

            elif query.entity_type in {
                "course",
                "exam",
                "activity",
            }:
                filters.append(
                    {
                        "term": {
                            "entity_type.keyword": "SCHEDULE",
                        }
                    }
                )

                filters.append(
                    {
                        "term": {
                            "type.keyword": (
                                query.entity_type.upper()
                            ),
                        }
                    }
                )

        if query.building_id:
            filters.append(
                {
                    "term": {
                        "building_id.keyword": query.building_id,
                    }
                }
            )

        body = {
            "from": (
                (query.page - 1)
                * query.page_size
            ),
            "size": query.page_size,
            "track_total_hits": True,
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query.query,
                                "type": "phrase_prefix",
                                "fields": fields,
                            }
                        }
                    ],
                    "filter": filters,
                }
            },
        }

        try:
            response = self.client.search(
                index=self.index_name,
                body=body,
            )

        except (
            ConnectionError,
            ConnectionTimeout,
        ) as exc:
            raise SearchServiceUnavailable() from exc

        total_value = response["hits"]["total"]

        total = int(
            total_value["value"]
            if isinstance(total_value, dict)
            else total_value
        )

        results = []

        for hit in response["hits"]["hits"]:
            source = hit.get(
                "_source",
                {},
            )

            results.append(
                SearchResult(
                    id=source.get(
                        "id",
                        hit.get("_id", ""),
                    ),
                    type=source.get(
                        "entity_type",
                        "",
                    ),
                    title=source.get(
                        "title",
                        "",
                    ),
                    subtitle=(
                        source.get("course_code")
                        or source.get("room_number")
                        or source.get("code")
                        or source.get("organizer")
                    ),
                    building_id=source.get(
                        "building_id"
                    ),
                    building_code=source.get(
                        "code"
                    ),
                    room_id=source.get(
                        "room_id"
                    ),
                    room_code=source.get(
                        "room_number"
                    ),
                    course_code=source.get(
                        "course_code"
                    ),
                )
            )

        return total, results