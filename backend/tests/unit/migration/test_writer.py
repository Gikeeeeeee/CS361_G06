from decimal import Decimal

from migration.writer import _dynamodb_value


def test_writer_converts_nested_floats_for_dynamodb():
    value = _dynamodb_value({"latitude": 14.07, "nested": [100.6]})
    assert value == {"latitude": Decimal("14.07"), "nested": [Decimal("100.6")]}
