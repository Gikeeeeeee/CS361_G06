import boto3
import json
import os
from botocore.exceptions import ClientError


class LocalBuildingRepository:

    def __init__(self):
        self.bucket_name = os.environ.get("bucket_name")
        self.file_key = os.environ.get(
            "BUILDINGS_FILE",
            "building-index.json"
        )
        self.s3 = boto3.client("s3")

    def get_all(self) -> list[dict]:
        try:
            response = self.s3.get_object(
                Bucket=self.bucket_name,
                Key=self.file_key
            )
            data = response["Body"].read().decode("utf-8")
            buildings = json.loads(data)
            return buildings

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "NoSuchKey":
                raise FileNotFoundError(
                    f"Building file '{self.file_key}' not found in S3 bucket '{self.bucket_name}'."
                )
            elif error_code == "NoSuchBucket":
                raise ValueError(
                    f"S3 bucket '{self.bucket_name}' does not exist."
                )
            else:
                raise RuntimeError(
                    f"AWS S3 Client Error [{error_code}]: {e}"
                )
        except json.JSONDecodeError:
            raise ValueError(
                f"The building file '{self.file_key}' contains invalid JSON data."
            )