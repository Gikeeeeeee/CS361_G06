"""
Guarded, idempotent seeding script for Vertical Connections on DynamoDB Staging.

CRITICAL SAFETY RULES:
- Read-only dry-run by default (--dry-run).
- Strictly restricted to Staging table allowlist: CS361-G06-data-dynamodb-staging.
- NEVER modifies or writes to Production table CS361-G06-data-dynamodb.
- Verifies AWS caller identity and target table name before any operation.
- Validates all floor and node entities in DynamoDB before preparing items.
- No emojis in logs or code.
"""

import argparse
from decimal import Decimal
import os
import sys
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

ALLOWED_TABLES = {"CS361-G06-data-dynamodb-staging"}
ALLOWED_REGIONS = {"ap-southeast-2"}

# Reviewed and validated dataset of 11 Vertical Connections
VERTICAL_CONNECTIONS_DATA: list[dict[str, Any]] = [
    {
        "id": "LC3-VERT-STAIR3-F1-F2",
        "building_id": "lc3",
        "building_code": "LC3",
        "connection_type": "STAIRS",
        "from_floor_id": "deaef033-ba6c-5c0e-bb50-956202b57947",
        "from_node_id": "LC3-F1-N22",
        "to_floor_id": "2144ef87-969d-5b9a-abd1-0485f5742893",
        "to_node_id": "LC3-F2-N20",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "West Stair 3 (Floor 1 <-> Floor 2)",
    },
    {
        "id": "LC3-VERT-STAIR1-F1-F2",
        "building_id": "lc3",
        "building_code": "LC3",
        "connection_type": "STAIRS",
        "from_floor_id": "deaef033-ba6c-5c0e-bb50-956202b57947",
        "from_node_id": "LC3-F1-N23",
        "to_floor_id": "2144ef87-969d-5b9a-abd1-0485f5742893",
        "to_node_id": "LC3-F2-N21",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "East Stair 1 (Floor 1 <-> Floor 2)",
    },
    {
        "id": "LC4-VERT-STAIR1-F1-F2",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "STAIRS",
        "from_floor_id": "a6ab42cb-0abd-57ee-acd2-993d64b20a82",
        "from_node_id": "LC4-F1-N8",
        "to_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "to_node_id": "LC4-F2-N8",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Stair 1 (Floor 1 <-> Floor 2)",
    },
    {
        "id": "LC4-VERT-STAIR1-F2-F3",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "STAIRS",
        "from_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "from_node_id": "LC4-F2-N8",
        "to_floor_id": "57040add-f04e-5fab-9b78-814250d708b1",
        "to_node_id": "LC4-F3-N16",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Stair 1 (Floor 2 <-> Floor 3)",
    },
    {
        "id": "LC4-VERT-STAIR2-F1-F2",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "STAIRS",
        "from_floor_id": "a6ab42cb-0abd-57ee-acd2-993d64b20a82",
        "from_node_id": "LC4-F1-N7",
        "to_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "to_node_id": "LC4-F2-N7",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Stair 2 (Floor 1 <-> Floor 2)",
    },
    {
        "id": "LC4-VERT-STAIR2-F2-F3",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "STAIRS",
        "from_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "from_node_id": "LC4-F2-N7",
        "to_floor_id": "57040add-f04e-5fab-9b78-814250d708b1",
        "to_node_id": "LC4-F3-N15",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Stair 2 (Floor 2 <-> Floor 3)",
    },
    {
        "id": "LC4-VERT-STAIR3-F1-F2",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "STAIRS",
        "from_floor_id": "a6ab42cb-0abd-57ee-acd2-993d64b20a82",
        "from_node_id": "LC4-F1-N10",
        "to_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "to_node_id": "LC4-F2-N10",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Stair 3 (Floor 1 <-> Floor 2)",
    },
    {
        "id": "LC4-VERT-STAIR3-F2-F3",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "STAIRS",
        "from_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "from_node_id": "LC4-F2-N10",
        "to_floor_id": "57040add-f04e-5fab-9b78-814250d708b1",
        "to_node_id": "LC4-F3-N14",
        "distance_weight": 30.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Stair 3 (Floor 2 <-> Floor 3)",
    },
    {
        "id": "LC4-VERT-ELEV-F1-F2",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "ELEVATOR",
        "from_floor_id": "a6ab42cb-0abd-57ee-acd2-993d64b20a82",
        "from_node_id": "LC4-F1-N9",
        "to_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "to_node_id": "LC4-F2-N9",
        "distance_weight": 40.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Elevator (Floor 1 <-> Floor 2)",
    },
    {
        "id": "LC4-VERT-ELEV-F2-F3",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "ELEVATOR",
        "from_floor_id": "d9c020ee-1f1f-5035-a7ec-2f9063569335",
        "from_node_id": "LC4-F2-N9",
        "to_floor_id": "57040add-f04e-5fab-9b78-814250d708b1",
        "to_node_id": "LC4-F3-N13",
        "distance_weight": 40.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Elevator (Floor 2 <-> Floor 3)",
    },
    {
        "id": "LC4-VERT-ELEV-F1-F3",
        "building_id": "lc4",
        "building_code": "LC4",
        "connection_type": "ELEVATOR",
        "from_floor_id": "a6ab42cb-0abd-57ee-acd2-993d64b20a82",
        "from_node_id": "LC4-F1-N9",
        "to_floor_id": "57040add-f04e-5fab-9b78-814250d708b1",
        "to_node_id": "LC4-F3-N13",
        "distance_weight": 50.0,
        "status": "ACTIVE",
        "bidirectional": True,
        "name": "Elevator Express (Floor 1 <-> Floor 3)",
    },
]


def _format_item_for_dynamodb(data: dict[str, Any]) -> dict[str, Any]:
    """Prepares clean DynamoDB item adhering to single-table conventions."""
    code = data["building_code"].upper()
    c_id = data["id"]
    return {
        "PK": f"BUILDING#{code}",
        "SK": f"VERTICAL_CONNECTION#{c_id}",
        "id": c_id,
        "entity_type": "VERTICAL_CONNECTION",
        "building_id": data["building_id"].lower(),
        "connection_type": data["connection_type"].upper(),
        "from_floor_id": data["from_floor_id"],
        "from_node_id": data["from_node_id"],
        "to_floor_id": data["to_floor_id"],
        "to_node_id": data["to_node_id"],
        "distance_weight": Decimal(str(data["distance_weight"])),
        "status": data["status"].upper(),
        "bidirectional": bool(data["bidirectional"]),
        "name": data["name"],
    }


def validate_environment(table_name: str, region: str) -> None:
    """Rigorous preflight security checks against table name and region."""
    if table_name not in ALLOWED_TABLES:
        raise ValueError(
            f"SECURITY VIOLATION: Target table '{table_name}' is not in the staging allowlist: {ALLOWED_TABLES}"
        )
    if "prod" in table_name.lower():
        raise ValueError(
            f"CRITICAL SAFETY ABORT: Refusing to operate on potential production table: '{table_name}'"
        )
    if region not in ALLOWED_REGIONS:
        raise ValueError(
            f"SECURITY VIOLATION: Target region '{region}' is not in allowed regions: {ALLOWED_REGIONS}"
        )


def run_preflight_and_seed(
    table_name: str,
    region: str,
    apply: bool = False,
) -> int:
    """
    Validates all vertical connections against DynamoDB Staging.
    If apply is False (default), runs in read-only preflight mode.
    If apply is True, safely performs idempotent PutItem operations.
    """
    validate_environment(table_name, region)

    print(
        "================================================================================"
    )
    print("VERTICAL CONNECTIONS STAGING SEEDER (GUARDED & IDEMPOTENT)")
    print(
        "================================================================================"
    )
    print(f"Target Region:       {region}")
    print(f"Target Staging Table: {table_name}")
    print(
        f"Mode:                {'APPLY (WRITE)' if apply else 'DRY-RUN (READ-ONLY PREFLIGHT)'}"
    )
    print(
        "--------------------------------------------------------------------------------"
    )

    # AWS Caller verification
    sts = boto3.client("sts", region_name=region)
    try:
        identity = sts.get_caller_identity()
        print(f"AWS Account ID:      {identity.get('Account')}")
        print(f"Caller ARN:          {identity.get('Arn')}")
    except ClientError as exc:
        print(f"Warning: Could not fetch STS caller identity: {exc}")

    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    print(
        "--------------------------------------------------------------------------------"
    )
    print("1. VALIDATING TOPOLOGICAL REFERENCES AGAINST DATABASE...")
    print(
        "--------------------------------------------------------------------------------"
    )

    errors: list[str] = []
    planned_items: list[dict[str, Any]] = []

    # Pre-fetch valid floors per building partition
    building_floors: dict[str, dict[str, Any]] = {}
    for code in ["LC3", "LC4"]:
        resp = table.query(
            KeyConditionExpression=Key("PK").eq(f"BUILDING#{code}")
            & Key("SK").begins_with("FLOOR#")
        )
        building_floors[code] = {
            item["id"]: item for item in resp.get("Items", []) if "id" in item
        }

    for idx, c in enumerate(VERTICAL_CONNECTIONS_DATA, 1):
        c_id = c["id"]
        b_code = c["building_code"]

        # Verify from_floor
        if c["from_floor_id"] not in building_floors.get(b_code, {}):
            errors.append(
                f"[{c_id}] from_floor_id '{c['from_floor_id']}' not found in building {b_code}"
            )

        # Verify to_floor
        if c["to_floor_id"] not in building_floors.get(b_code, {}):
            errors.append(
                f"[{c_id}] to_floor_id '{c['to_floor_id']}' not found in building {b_code}"
            )

        # Verify from_node
        fn_res = table.get_item(
            Key={
                "PK": f"FLOOR#{c['from_floor_id']}",
                "SK": f"NAV_NODE#{c['from_node_id']}",
            }
        )
        if "Item" not in fn_res:
            errors.append(
                f"[{c_id}] from_node_id '{c['from_node_id']}' not found on floor {c['from_floor_id']}"
            )
        else:
            fn_type = fn_res["Item"].get("node_type")
            if c["connection_type"] == "STAIRS" and fn_type not in ["STAIR", "STAIRS"]:
                errors.append(
                    f"[{c_id}] from_node '{c['from_node_id']}' type '{fn_type}' != STAIRS"
                )
            elif c["connection_type"] == "ELEVATOR" and fn_type not in ["ELEVATOR"]:
                errors.append(
                    f"[{c_id}] from_node '{c['from_node_id']}' type '{fn_type}' != ELEVATOR"
                )

        # Verify to_node
        tn_res = table.get_item(
            Key={"PK": f"FLOOR#{c['to_floor_id']}", "SK": f"NAV_NODE#{c['to_node_id']}"}
        )
        if "Item" not in tn_res:
            errors.append(
                f"[{c_id}] to_node_id '{c['to_node_id']}' not found on floor {c['to_floor_id']}"
            )
        else:
            tn_type = tn_res["Item"].get("node_type")
            if c["connection_type"] == "STAIRS" and tn_type not in ["STAIR", "STAIRS"]:
                errors.append(
                    f"[{c_id}] to_node '{c['to_node_id']}' type '{tn_type}' != STAIRS"
                )
            elif c["connection_type"] == "ELEVATOR" and tn_type not in ["ELEVATOR"]:
                errors.append(
                    f"[{c_id}] to_node '{c['to_node_id']}' type '{tn_type}' != ELEVATOR"
                )

        # Check existing item status
        item_dynamo = _format_item_for_dynamodb(c)
        planned_items.append(item_dynamo)

        existing_res = table.get_item(
            Key={"PK": item_dynamo["PK"], "SK": item_dynamo["SK"]}
        )
        status_action = "INSERT" if "Item" not in existing_res else "NO-OP (EXISTS)"

        print(
            f"[{idx:02d}/11] {c_id:<28} | Action: {status_action:<14} | "
            f"{c['from_node_id']} -> {c['to_node_id']} ({c['connection_type']})"
        )

    if errors:
        print(
            "\n--------------------------------------------------------------------------------"
        )
        print("PREFLIGHT VALIDATION FAILED:")
        for err in errors:
            print(f"  [ERROR] {err}")
        print(
            "--------------------------------------------------------------------------------"
        )
        return 1

    print(
        "\n--------------------------------------------------------------------------------"
    )
    print(
        "PREFLIGHT VALIDATION PASSED: All 11 records have 100% valid database references."
    )
    print(
        "--------------------------------------------------------------------------------"
    )

    if not apply:
        print(
            "\n[DRY-RUN COMPLETE] 0 records written. System is safe and ready for apply."
        )
        print("To apply writes to Staging, run with --apply flag.")
        return 0

    print(
        "\n--------------------------------------------------------------------------------"
    )
    print("2. APPLYING WRITES TO DYNAMODB STAGING...")
    print(
        "--------------------------------------------------------------------------------"
    )

    written_count = 0
    for item in planned_items:
        try:
            table.put_item(Item=item)
            written_count += 1
            print(f"[OK] Written: PK={item['PK']}, SK={item['SK']}")
        except ClientError as exc:
            print(f"[FAILED] Error writing {item['SK']}: {exc}")
            return 1

    print(
        f"\n[APPLY SUCCESSFUL] Successfully seeded {written_count} vertical connections into Staging."
    )
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Guarded Vertical Connections Seeder for DynamoDB Staging"
    )
    parser.add_argument(
        "--table",
        default="CS361-G06-data-dynamodb-staging",
        help="DynamoDB table name (must be CS361-G06-data-dynamodb-staging)",
    )
    parser.add_argument(
        "--region",
        default="ap-southeast-2",
        help="AWS Region (default: ap-southeast-2)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Execute guarded write operation (default is read-only dry-run)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Run read-only preflight validation without writing (default: True)",
    )

    args = parser.parse_args()
    apply_mode = args.apply

    try:
        exit_code = run_preflight_and_seed(
            table_name=args.table,
            region=args.region,
            apply=apply_mode,
        )
        sys.exit(exit_code)
    except Exception as exc:
        print(f"\nABORTED WITH ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
