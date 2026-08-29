import json
import logging
from typing import Any

from service import BuildingService
from repository import LocalBuildingRepository


logger = logging.getLogger()
logger.setLevel(logging.INFO)

repository = LocalBuildingRepository()
service = BuildingService(repository=repository)


def response(status_code: int, body: Any) -> dict:
    """
    Build API Gateway response.
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }


def lambda_handler(event, context):
    try:
        request_context = event.get("requestContext", {})
        http_info = request_context.get("http", {})

        method = (
            http_info.get("method") or 
            event.get("httpMethod") or 
            ""
        ).upper()

        path = (
            event.get("rawPath") or 
            event.get("path") or 
            ""
        )

        logger.info(f"Incoming Request -> Method: {method}, Path: {path}")

        if method == "GET" and path == "/api/v1/buildings":
            result = service.get_all_buildings()

            if isinstance(result, dict):
                body = result
            else:
                body = {"buildings": result}

            return response(200, body)

        return response(
            404,
            {
                "message": f"Route not found for method '{method}' and path '{path}'"
            }
        )

    except FileNotFoundError as e:
        logger.warning(f"Resource not found: {str(e)}")
        return response(
            404,
            {
                "message": str(e)
            }
        )

    except ValueError as e:
        logger.warning(f"Bad request / Invalid data: {str(e)}")
        return response(
            400,
            {
                "message": str(e)
            }
        )

    except Exception as e:
        logger.exception("Internal server error encountered")
        return response(
            500,
            {
                "message": "Internal server error",
                "error": str(e)
            }
        )