import boto3
import json
import os

from botocore.exceptions import ClientError


BUCKET_NAME = os.environ.get("BUCKET_NAME", "")


class BuildingRepository:
    def __init__(self, bucket_name: str = BUCKET_NAME):
        self.bucket_name = bucket_name
        self._s3_client = None

    @property
    def s3_client(self):
        if self._s3_client is None:
            self._s3_client = boto3.client("s3")
        return self._s3_client

    def get_all(self) -> list[dict]:
        """
        Fetch all building summaries from the building index in S3.
        """
        file_key = os.environ.get(
            "BUILDINGS_FILE",
            "building-index.json"
        )

        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=file_key
            )

            data = response["Body"].read().decode("utf-8")
            buildings_data = json.loads(data)

            buildings = buildings_data.get("buildings")

            if not isinstance(buildings, list):
                raise ValueError(
                    f"The building file '{file_key}' must contain "
                    f"a 'buildings' array."
                )

            return buildings

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")

            if error_code == "NoSuchKey":
                raise FileNotFoundError(
                    f"Building file '{file_key}' not found in "
                    f"S3 bucket '{self.bucket_name}'."
                )

            if error_code == "NoSuchBucket":
                raise ValueError(
                    f"S3 bucket '{self.bucket_name}' does not exist."
                )

            raise RuntimeError(
                f"AWS S3 Client Error [{error_code}]: {e}"
            )

        except json.JSONDecodeError:
            raise ValueError(
                f"The building file '{file_key}' contains invalid JSON data."
            )

    def get_building_raw(self, building_id: str) -> dict | None:
        """
        Fetch the raw building JSON from S3.

        Example:
            building/LC4.json
        """
        key = f"building/{building_id}.json"

        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key=key
            )

            content = response["Body"].read().decode("utf-8")
            return json.loads(content)

        except ClientError as e:
            error_code = (
                e.response.get("Error", {}).get("Code")
                if hasattr(e, "response")
                else None
            )

            if error_code in ["NoSuchKey", "404"]:
                # Try uppercase if requested ID is lowercase.
                if not building_id.isupper():
                    return self.get_building_raw(building_id.upper())

                return None
            raise e

            raise
    def get_facility_info(
        self, building_id: str, floor_id: str, facility_id: str
    ) -> dict | None:
        """
        Fetch specific facility details from a building's JSON data in S3,
        supporting id or name matching.
        """
        building_data = self.get_building_raw(building_id)
        if not building_data:
            return None

        target_floor = None
        for floor in building_data.get("floors", []):
            if (
                str(floor.get("id")) == str(floor_id)
                or str(floor.get("floor_number")) == str(floor_id)
            ):
                target_floor = floor
                break

        if not target_floor:
            return None

        target_lower = str(facility_id).strip().lower()
        for facility in target_floor.get("facilities", []):
            f_id = str(facility.get("id", "")).strip().lower()
            f_name = str(facility.get("name", "")).strip().lower()

            if (
                (f_id and f_id == target_lower)
                or (f_name and target_lower in f_name)
            ):
                return facility

        return None
    def generate_presigned_url(self, s3_key: str, expires_in: int = 3600) -> str:
        """
        Generates a pre-signed GET URL for an S3 object.
        """
        if not self.s3_client:
            raise RuntimeError("boto3 is not available")

        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": s3_key},
            ExpiresIn=expires_in
        )
