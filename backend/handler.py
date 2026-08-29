import json

try:
    from service import BuildingService
except ImportError:
    from .service import BuildingService

service = BuildingService()

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
}


def lambda_handler(event, context):
    """
    AWS Lambda entry point for API Gateway HTTP API.
    Handles:
      - GET /buildings/{buildingId}
      - GET /buildings/{buildingId}/floors/{floorId}
    """
    # Handle preflight OPTIONS request
    http_method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
    )
    if http_method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": CORS_HEADERS,
            "body": ""
        }

    path_params = event.get("pathParameters") or {}
    building_id = path_params.get("buildingId")
    floor_id = path_params.get("floorId")

    if not building_id:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Missing buildingId parameter"})
        }

    try:
        if floor_id:
            floor_data = service.get_floor_details(building_id, floor_id)

            if not floor_data:
                return {
                    "statusCode": 404,
                    "headers": CORS_HEADERS,
                    "body": json.dumps({"error": f"Floor '{floor_id}' in building '{building_id}' not found"})
                }

            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps(floor_data, ensure_ascii=False)
            }
        else:
            building = service.get_building_summary(building_id)

            if not building:
                return {
                    "statusCode": 404,
                    "headers": CORS_HEADERS,
                    "body": json.dumps({"error": f"Building '{building_id}' not found"})
                }

            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": json.dumps(building, ensure_ascii=False)
            }

    except Exception as e:
        print(f"Error handling request: {str(e)}")
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Internal server error"})
        }

