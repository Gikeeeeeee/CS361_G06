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
            "name_en^6",
            "name_th^6",
            "title^6",
            "title_en^5",
            "title_th^5",
            "organizer^3",
            "description_en^2",
            "description_th^2",
        ]

        filters = []

        # ---------------------------------------------------------
        # Entity / Schedule Type Filter
        # ---------------------------------------------------------

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
                # Course / Exam / Activity are all
                # Schedule entities.
                filters.append(
                    {
                        "term": {
                            "entity_type.keyword": "SCHEDULE",
                        }
                    }
                )

                # Schedule.type stores:
                # COURSE / EXAM / ACTIVITY
                filters.append(
                    {
                        "term": {
                            "type.keyword": (
                                query.entity_type.upper()
                            ),
                        }
                    }
                )

        # ---------------------------------------------------------
        # Building Filter
        # ---------------------------------------------------------

        if query.building_id:
            filters.append(
                {
                    "term": {
                        "building_id.keyword": (
                            query.building_id
                        ),
                    }
                }
            )

        # ---------------------------------------------------------
        # OpenSearch Query
        # ---------------------------------------------------------

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

        # ---------------------------------------------------------
        # Execute Search
        # ---------------------------------------------------------

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

        # ---------------------------------------------------------
        # Total
        # ---------------------------------------------------------

        total_value = response["hits"]["total"]

        total = int(
            total_value["value"]
            if isinstance(total_value, dict)
            else total_value
        )

        # ---------------------------------------------------------
        # Map Search Results
        # ---------------------------------------------------------

        results = []

        for hit in response["hits"]["hits"]:

            source = hit.get(
                "_source",
                {},
            )

            entity_type = source.get(
                "entity_type",
                "",
            )

            # For Schedule:
            #
            # entity_type = SCHEDULE
            # type        = COURSE / EXAM / ACTIVITY
            #
            # API result:
            # type = COURSE / EXAM / ACTIVITY
            #
            # For other entities:
            #
            # entity_type = BUILDING / ROOM / FACILITY
            #
            # API result:
            # type = BUILDING / ROOM / FACILITY

            if entity_type == "SCHEDULE":
                result_type = source.get(
                    "type",
                    "",
                )
            else:
                result_type = entity_type

            results.append(
                SearchResult(
                    id=source.get(
                        "id",
                        hit.get("_id", ""),
                    ),

                    type=result_type,

                    title=source.get(
                        "title",
                        "",
                    ),

                    # Localized names
                    name_th=source.get(
                        "name_th"
                    ),

                    name_en=source.get(
                        "name_en"
                    ),

                    subtitle=(
                        source.get("course_code")
                        or source.get("room_number")
                        or source.get("code")
                        or source.get("organizer")
                    ),

                    # Common / Schedule
                    description=source.get(
                        "description"
                    ),

                    # Building
                    building_id=source.get(
                        "building_id"
                    ),

                    # Use the explicit indexed building_code
                    # instead of the entity's own "code".
                    building_code=source.get(
                        "building_code"
                    ),

                    # Room / Schedule
                    room_id=source.get(
                        "room_id"
                    ),

                    room_code=source.get(
                        "room_number"
                    ),

                    # Schedule
                    course_code=source.get(
                        "course_code"
                    ),

                    organizer=source.get(
                        "organizer"
                    ),

                    start_at=source.get(
                        "start_at"
                    ),

                    end_at=source.get(
                        "end_at"
                    ),

                    time_zone=source.get(
                        "time_zone"
                    ),

                    recurrence_rule=source.get(
                        "recurrence_rule"
                    ),

                    status=source.get(
                        "status"
                    ),
                )
            )

        return total, results