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
    Handles GET /buildings/{buildingId}
    """
    path_params = event.get("pathParameters") or {}
    building_id = path_params.get("buildingId")

    if not building_id:
        return {
            "statusCode": 400,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": "Missing buildingId parameter"})
        }

    try:
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
