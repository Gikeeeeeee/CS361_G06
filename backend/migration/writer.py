from decimal import Decimal
from typing import Any


def _dynamodb_value(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _dynamodb_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_dynamodb_value(item) for item in value]
    return value


def write(table: Any, items: list[dict[str, Any]]) -> None:
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=_dynamodb_value(item))
