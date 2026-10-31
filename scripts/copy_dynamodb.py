"""Copy every item from one DynamoDB table into another (e.g. prod -> sandbox).

Reads the source with Scan only; never writes to it.

    python scripts/copy_dynamodb.py CS361-G06-data-dynamodb CS361-G06-data-dynamodb-sandbox
"""

import argparse

import boto3


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("target")
    parser.add_argument("--region", default="ap-southeast-2")
    args = parser.parse_args()

    if args.source == args.target:
        parser.error("source and target must differ")
    if not args.target.endswith("-sandbox"):
        parser.error("target must be a -sandbox table")

    dynamodb = boto3.resource("dynamodb", region_name=args.region)
    source = dynamodb.Table(args.source)
    target = dynamodb.Table(args.target)

    count = 0
    scan_kwargs = {}
    # batch_writer chunks to 25 items and retries unprocessed ones.
    with target.batch_writer() as batch:
        while True:
            page = source.scan(**scan_kwargs)
            for item in page["Items"]:
                batch.put_item(Item=item)
                count += 1
            if "LastEvaluatedKey" not in page:
                break
            scan_kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]

    print(f"Copied {count} items {args.source} -> {args.target}")


if __name__ == "__main__":
    main()
