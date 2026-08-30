import unittest
from unittest.mock import MagicMock, patch
import json
import sys
import os

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from repository import BuildingRepository
from service import BuildingService
from handler import lambda_handler, CORS_HEADERS


class TestBackend(unittest.TestCase):

    def setUp(self):
        self.mock_building_data = {
            "id": "building-uuid",
            "name": "LC4",
            "latitude": 14.0726,
            "longitude": 100.6077,
            "floors": [
                {
                    "id": "floor-uuid-1",
                    "floor_number": 1,
                    "rooms": [
                        {
                            "id": "room-uuid-1",
                            "name": "LAB102",
                            "type": "LAB"
                        }
                    ],
                    "facilities": [
                        {
                            "id": "facility-uuid-1",
                            "name": "Stair 1",
                            "type": "STAIR"
                        }
                    ]
                },
                {
                    "id": "floor-uuid-2",
                    "floor_number": 2,
                    "rooms": [],
                    "facilities": []
                }
            ]
        }

    def test_repository_generate_presigned_url(self):
        repo = BuildingRepository(bucket_name="test-bucket")
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://test-bucket.s3.amazonaws.com/floor-plan/LC4/LC4-floor1-neutral.svg?signed=1"
        repo._s3_client = mock_s3

        url = repo.generate_presigned_url("floor-plan/LC4/LC4-floor1-neutral.svg", expires_in=1800)
        self.assertIn("https://test-bucket.s3.amazonaws.com", url)
        mock_s3.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": "test-bucket", "Key": "floor-plan/LC4/LC4-floor1-neutral.svg"},
            ExpiresIn=1800
        )

    def test_service_get_building_summary(self):
        mock_repo = MagicMock()
        mock_repo.get_building_raw.return_value = self.mock_building_data
        service = BuildingService(repository=mock_repo)

        summary = service.get_building_summary("LC4")
        self.assertIsNotNone(summary)
        self.assertEqual(summary["name"], "LC4")
        self.assertEqual(len(summary["floors"]), 2)
        self.assertEqual(summary["floors"][0], {"id": "floor-uuid-1", "floor_number": 1})
        self.assertNotIn("rooms", summary["floors"][0])

    def test_service_get_floor_details_by_id(self):
        mock_repo = MagicMock()
        mock_repo.get_building_raw.return_value = self.mock_building_data
        mock_repo.generate_presigned_url.return_value = "https://s3.signed/LC4-floor1.svg"
        service = BuildingService(repository=mock_repo)

        floor_details = service.get_floor_details("LC4", "floor-uuid-1")
        self.assertIsNotNone(floor_details)
        self.assertEqual(floor_details["id"], "floor-uuid-1")
        self.assertEqual(floor_details["floor_number"], 1)
        self.assertEqual(floor_details["map"]["type"], "svg")
        self.assertEqual(floor_details["map"]["url"], "https://s3.signed/LC4-floor1.svg")
        self.assertEqual(len(floor_details["rooms"]), 1)
        self.assertEqual(floor_details["rooms"][0]["name"], "LAB102")
        self.assertEqual(len(floor_details["facilities"]), 1)
        self.assertEqual(floor_details["facilities"][0]["name"], "Stair 1")

    def test_service_get_floor_details_by_floor_number(self):
        mock_repo = MagicMock()
        mock_repo.get_building_raw.return_value = self.mock_building_data
        mock_repo.generate_presigned_url.return_value = "https://s3.signed/LC4-floor1.svg"
        service = BuildingService(repository=mock_repo)

        # Query by "1" instead of UUID
        floor_details = service.get_floor_details("LC4", "1")
        self.assertIsNotNone(floor_details)
        self.assertEqual(floor_details["floor_number"], 1)

    def test_service_get_floor_details_not_found(self):
        mock_repo = MagicMock()
        mock_repo.get_building_raw.return_value = self.mock_building_data
        service = BuildingService(repository=mock_repo)

        floor_details = service.get_floor_details("LC4", "non-existent-floor")
        self.assertIsNone(floor_details)

    @patch("handler.service")
    def test_handler_get_building_success(self, mock_service):
        mock_service.get_building_summary.return_value = {"id": "building-uuid", "name": "LC4"}

        event = {
            "pathParameters": {"buildingId": "LC4"}
        }
        res = lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertEqual(body["name"], "LC4")
        self.assertEqual(res["headers"]["Access-Control-Allow-Origin"], "*")

    @patch("handler.service")
    def test_handler_get_floor_success(self, mock_service):
        mock_service.get_floor_details.return_value = {
            "id": "floor-uuid-1",
            "floor_number": 1,
            "map": {
                "type": "svg",
                "url": "https://s3.signed/map.svg"
            },
            "rooms": [{"id": "r1", "name": "LAB102", "type": "LAB"}],
            "facilities": [{"id": "f1", "name": "Stair 1", "type": "STAIR"}]
        }

        event = {
            "pathParameters": {"buildingId": "LC4", "floorId": "floor-uuid-1"}
        }
        res = lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertEqual(body["id"], "floor-uuid-1")
        self.assertEqual(body["map"]["type"], "svg")
        self.assertEqual(body["map"]["url"], "https://s3.signed/map.svg")

    @patch("handler.service")
    def test_handler_floor_not_found(self, mock_service):
        mock_service.get_floor_details.return_value = None

        event = {
            "pathParameters": {"buildingId": "LC4", "floorId": "unknown-floor"}
        }
        res = lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 404)
        body = json.loads(res["body"])
        self.assertIn("error", body)

    def test_handler_missing_building_id(self):
        event = {"pathParameters": {}}
        res = lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 400)

    def test_handler_options_preflight(self):
        event = {
            "httpMethod": "OPTIONS",
            "requestContext": {"http": {"method": "OPTIONS"}}
        }
        res = lambda_handler(event, None)
        self.assertEqual(res["statusCode"], 204)
        self.assertEqual(res["headers"]["Access-Control-Allow-Origin"], "*")


if __name__ == "__main__":
    unittest.main()
