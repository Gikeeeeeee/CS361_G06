import argparse
import boto3


def legacy_keys(table):
    params = {
        "FilterExpression": "GSI0PK = :facility AND attribute_exists(room_id)",
        "ExpressionAttributeValues": {":facility": "FACILITY"},
        "ProjectionExpression": "PK, SK",
    }
    while True:
        page = table.scan(**params)
        yield from ((item["PK"], item["SK"]) for item in page.get("Items", []))
        if not page.get("LastEvaluatedKey"):
            return
        params["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def main(argv=None):
    parser = argparse.ArgumentParser(description="Remove legacy room-amenity Facility items")
    parser.add_argument("--table-name", required=True)
    parser.add_argument("--region", default="us-east-1")
    parser.add_argument("--apply", action="store_true", help="actually delete matched items")
    args = parser.parse_args(argv)

    table = boto3.resource("dynamodb", region_name=args.region).Table(args.table_name)
    keys = list(legacy_keys(table))
    print(f"Matched legacy facility items: {len(keys)}")
    if not args.apply:
        print("DRY RUN — no items deleted. Add --apply to delete these exact matches.")
        return 0

    with table.batch_writer() as batch:
        for pk, sk in keys:
            batch.delete_item(Key={"PK": pk, "SK": sk})
    print(f"Deleted: {len(keys)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
