#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Any, Iterator

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import boto3
from opensearchpy import (
    AWSV4SignerAuth,
    OpenSearch,
    RequestsHttpConnection,
)
from opensearchpy.helpers import bulk

from indexer.mapper import (
    deserialize_item,
    to_search_document,
)


AWS_REGION = os.getenv(
    "AWS_REGION",
    "us-east-1",
)

DYNAMODB_TABLE_NAME = os.getenv(
    "DYNAMODB_TABLE_NAME",
    "CS361-G06-rickoroxd-data-dynamodb",
)

OPENSEARCH_ENDPOINT = os.getenv(
    "OPENSEARCH_ENDPOINT"
)

OPENSEARCH_INDEX = os.getenv(
    "OPENSEARCH_INDEX",
    "university",
)


def create_opensearch_client() -> OpenSearch:
    if not OPENSEARCH_ENDPOINT:
        raise RuntimeError(
            "OPENSEARCH_ENDPOINT environment variable is required."
        )

    endpoint = (
        OPENSEARCH_ENDPOINT
        .replace("https://", "")
        .replace("http://", "")
        .rstrip("/")
    )

    credentials = boto3.Session().get_credentials()

    if credentials is None:
        raise RuntimeError(
            "AWS credentials are unavailable."
        )

    auth = AWSV4SignerAuth(
        credentials,
        AWS_REGION,
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
        max_retries=3,
        retry_on_timeout=True,
    )


def create_index(client: OpenSearch) -> None:
    """
    Create the OpenSearch index with the required mappings.

    Thai text fields use the built-in Thai analyzer.
    """

    if client.indices.exists(index=OPENSEARCH_INDEX):
        print(
            f"OpenSearch index already exists: {OPENSEARCH_INDEX}"
        )
        return

    print(
        f"Creating OpenSearch index: {OPENSEARCH_INDEX}"
    )

    client.indices.create(
        index=OPENSEARCH_INDEX,
        body={
            "settings": {
                "analysis": {
                    "analyzer": {
                        "thai_analyzer": {
                            "type": "thai"
                        }
                    }
                }
            },
            "mappings": {
                "properties": {

                    "id": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "entity_type": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "title": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "title_th": {
                        "type": "text",
                        "analyzer": "thai_analyzer",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "title_en": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "code": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "room_number": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "type": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "course_code": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "organizer": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "facility_type": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "description": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "description_th": {
                        "type": "text",
                        "analyzer": "thai_analyzer",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },

                    "description_en": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "ignore_above": 256,
                            }
                        },
                    },
                }
            },
        },
    )

    print(
        f"OpenSearch index created: {OPENSEARCH_INDEX}"
    )


def scan_dynamodb() -> Iterator[dict[str, Any]]:
    dynamodb = boto3.client(
        "dynamodb",
        region_name=AWS_REGION,
    )

    scan_kwargs: dict[str, Any] = {
        "TableName": DYNAMODB_TABLE_NAME,
    }

    while True:
        response = dynamodb.scan(
            **scan_kwargs
        )

        for item in response.get("Items", []):
            yield item

        last_evaluated_key = response.get(
            "LastEvaluatedKey"
        )

        if not last_evaluated_key:
            break

        scan_kwargs["ExclusiveStartKey"] = (
            last_evaluated_key
        )


def build_actions(
    items: Iterator[dict[str, Any]],
) -> Iterator[dict[str, Any]]:

    for raw_item in items:
        try:
            # DynamoDB AttributeValue
            # -> normal Python values
            item = deserialize_item(raw_item)

            document = to_search_document(item)

            document_id = document.get("id")

            if not document_id:
                print(
                    "SKIP: document has no id"
                )
                continue

            yield {
                "_op_type": "index",
                "_index": OPENSEARCH_INDEX,
                "_id": str(document_id),
                "_source": document,
            }

        except Exception as exc:
            print(
                f"ERROR: failed to map item: {exc}"
            )


def main() -> int:
    print("=== Reindex started ===")

    print(
        f"AWS region       : {AWS_REGION}"
    )

    print(
        f"DynamoDB table   : {DYNAMODB_TABLE_NAME}"
    )

    print(
        f"OpenSearch index : {OPENSEARCH_INDEX}"
    )

    client = create_opensearch_client()

    print("Checking OpenSearch access...")

    try:
        if client.indices.exists(index=OPENSEARCH_INDEX):
            print(
                f"OpenSearch index exists: {OPENSEARCH_INDEX}"
            )
        else:
            print(
                f"OpenSearch index does not exist: {OPENSEARCH_INDEX}"
            )

    except Exception as exc:
        print(
            "ERROR: Cannot access OpenSearch."
        )

        print(
            f"{type(exc).__name__}: {exc}"
        )

        return 1

    # Create index if it does not exist.
    create_index(client)

    total = 0

    def actions() -> Iterator[dict[str, Any]]:
        nonlocal total

        for action in build_actions(
            scan_dynamodb()
        ):
            total += 1
            yield action

    print(
        "Scanning DynamoDB and indexing documents..."
    )

    success, errors = bulk(
        client,
        actions(),
        chunk_size=100,
        raise_on_error=False,
        stats_only=False,
    )

    failed = len(errors)

    print("\n=== Reindex finished ===")

    print(
        f"Documents processed : {total}"
    )

    print(
        f"Documents indexed   : {success}"
    )

    print(
        f"Documents failed    : {failed}"
    )

    if errors:
        print("\n=== Errors ===")

        for error in errors[:10]:
            print(error)

        if len(errors) > 10:
            print(
                f"... and {len(errors) - 10} more errors"
            )

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())