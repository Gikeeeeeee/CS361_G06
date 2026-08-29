import json
import os

try:
    import boto3
    from botocore.exceptions import ClientError
except ImportError:
    boto3 = None
    ClientError = Exception

BUCKET_NAME = os.environ.get("BUCKET_NAME", "")


class BuildingRepository:
    def __init__(self, bucket_name: str = BUCKET_NAME):
        self.bucket_name = bucket_name
        self._s3_client = None

    @property
    def s3_client(self):
        if self._s3_client is None and boto3 is not None:
            self._s3_client = boto3.client("s3")
        return self._s3_client

    def get_building_raw(self, building_id: str) -> dict | None:
        """
        Fetches the raw building JSON from S3 (e.g., building/LC4.json).
        """
        if not self.s3_client:
            raise RuntimeError("boto3 is not available")

        key = f"building/{building_id}.json"

        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            content = response["Body"].read().decode("utf-8")
            return json.loads(content)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code") if hasattr(e, "response") else None
            if error_code in ["NoSuchKey", "404"]:
                # Try uppercase if the requested id is not uppercase (e.g. lc4 -> LC4)
                if not building_id.isupper():
                    return self.get_building_raw(building_id.upper())
                return None
            raise e
