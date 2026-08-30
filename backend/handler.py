import json
import logging
from typing import Any

from service import BuildingService


logger = logging.getLogger()
logger.setLevel(logging.INFO)

service = BuildingService()


CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}


def response(status_code: int, body: Any) -> dict:
    """
    Build API Gateway response.
    """
    return {
        "statusCode": status_code,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False),
    }


def lambda_handler(event, context):
    """
    AWS Lambda entry point for API Gateway HTTP API.

    Handles:
      - GET /api/v1/buildings
      - GET /api/v1/buildings/{buildingId}
      - GET /api/v1/buildings/{buildingId}/floors/{floorId}
    """

    # ----------------------------------------
    # Request information
    # ----------------------------------------

    request_context = event.get("requestContext", {})
    http_info = request_context.get("http", {})

    method = (
        http_info.get("method")
        or event.get("httpMethod")
        or ""
    ).upper()

    path = (
        event.get("rawPath")
        or event.get("path")
        or ""
    )

    logger.info(
        f"Incoming Request -> Method: {method}, Path: {path}"
    )

    # ----------------------------------------
    # Handle CORS preflight
    # ----------------------------------------

    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": CORS_HEADERS,
            "body": "",
        }

    try:
        # ----------------------------------------
        # GET /api/v1/buildings
        # ----------------------------------------

        if method == "GET" and path == "/api/v1/buildings":
            buildings = service.get_all_buildings()

            return response(
                200,
                {"buildings": buildings},
            )

        # ----------------------------------------
        # GET /api/v1/buildings/{buildingId}
        # ----------------------------------------

        if (
            method == "GET"
            and path.startswith("/api/v1/buildings/")
        ):
            path_params = event.get("pathParameters") or {}

            building_id = path_params.get("buildingId")
            floor_id = path_params.get("floorId")

            if not building_id:
                return response(
                    400,
                    {
                        "error": "Missing buildingId parameter",
                    },
                )

            # ----------------------------------------
            # GET /api/v1/buildings/{buildingId}/floors/{floorId}
            # ----------------------------------------

            if floor_id:
                floor_data = service.get_floor_details(
                    building_id,
                    floor_id,
                )

                if not floor_data:
                    return response(
                        404,
                        {
                            "error": (
                                f"Floor '{floor_id}' in "
                                f"building '{building_id}' not found"
                            ),
                        },
                    )

                return response(
                    200,
                    floor_data,
                )

            # ----------------------------------------
            # GET /api/v1/buildings/{buildingId}
            # ----------------------------------------

            building = service.get_building_summary(
                building_id
            )

            if not building:
                return response(
                    404,
                    {
                        "error": (
                            f"Building '{building_id}' not found"
                        ),
                    },
                )

            return response(
                200,
                building,
            )

        # ----------------------------------------
        # Route not found
        # ----------------------------------------

        return response(
            404,
            {
                "message": (
                    f"Route not found for method "
                    f"'{method}' and path '{path}'"
                ),
            },
        )

    # ----------------------------------------
    # Error handling
    # ----------------------------------------

    except FileNotFoundError as e:
        logger.warning(
            f"Resource not found: {str(e)}"
        )

        return response(
            404,
            {"message": str(e)},
        )

    except ValueError as e:
        logger.warning(
            f"Bad request / Invalid data: {str(e)}"
        )

        return response(
            400,
            {"message": str(e)},
        )

    except Exception:
        logger.exception(
            "Internal server error encountered"
        )

        return response(
            500,
            {"message": "Internal server error"},
        )
