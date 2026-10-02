from __future__ import annotations

from typing import Any

from indexer.service import IndexerService


_service: IndexerService | None = None


def _get_service() -> IndexerService:
    global _service

    if _service is None:
        _service = IndexerService()

    return _service


def lambda_handler(
    event: dict[str, Any],
    context: Any,
) -> dict[str, Any]:
    service = _get_service()

    service.process_event(event)

    return {
        "statusCode": 200,
        "processed": len(event.get("Records", [])),
    }