import argparse
import json
import os
from collections import Counter

import boto3

from migration.mapper import map_building, map_floor, map_room, map_facility, map_schedule, MigrationError
from migration.source import MigrationSource
from migration.validator import validate
from migration.writer import write


def build_plan(buildings, schedules=()):
    items, counts = [], Counter()
    counts["facilities"] = 0
    for building in buildings:
        items.append(map_building(building)); counts["buildings"] += 1
        for floor in building.get("floors") or []:
            items.append(map_floor(building, floor)); counts["floors"] += 1
            for facility in floor.get("facilities") or []:
                items.append(map_facility(building, floor, facility)); counts["facilities"] += 1
            for room in floor.get("rooms") or []:
                items.append(map_room(floor, room, building["id"])); counts["rooms"] += 1
    mapped_schedules = [map_schedule(s) for s in schedules]
    items.extend(mapped_schedules); counts["schedules"] = len(mapped_schedules)
    errors = validate(items, mapped_schedules)
    return items, counts, errors


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Migrate V1 building JSON into V2 DynamoDB")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--source-dir")
    source.add_argument("--bucket")
    parser.add_argument("--index-key", default="building-index.json")
    parser.add_argument("--table-name", default=os.getenv("DYNAMODB_TABLE_NAME"))
    parser.add_argument("--schedule-file", help="Optional separate V2 schedule JSON; never read from V1 building files")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    schedules = json.load(open(args.schedule_file, encoding="utf-8")) if args.schedule_file else []
    try:
        buildings = MigrationSource(directory=args.source_dir, bucket=args.bucket).buildings(args.index_key)
        items, counts, errors = build_plan(buildings, schedules)
    except (MigrationError, ValueError, KeyError) as exc:
        print(f"ERROR: {exc}")
        return 1
    print("Migration plan")
    for name in ("buildings", "floors", "rooms", "facilities", "schedules"):
        print(f"{name.title():10}: {counts[name]}")
    print(f"Validation errors: {len(errors)}")
    for error in errors:
        print(f"- {error}")
    if errors:
        return 1
    if args.dry_run:
        print("DRY RUN — no DynamoDB writes performed.")
        return 0
    if not args.table_name:
        parser.error("--table-name or DYNAMODB_TABLE_NAME is required unless --dry-run is used")
    write(boto3.resource("dynamodb").Table(args.table_name), items)
    print(f"Migrated {len(items)} items.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
