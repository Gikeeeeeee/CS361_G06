import pytest
from backend.handler import *

API_VERSION = ["v1"]

@pytest.mark.parametrize("version", API_VERSION)
def test_response_buildings():
   event = {
        "httpMethod": "GET",
        "path": "/api/{version}/buildings"
   }
   result = lambda_handler(event, None)
   assert result["statusCode"] == 200

@pytest.mark.parametrize("version", API_VERSION)
def test_response_buildings_wrong_method():
    event = {
        "httpMethod": "POST",
        "path": "/api/{version}/buildings"
    }
    result = lambda_handler(event, None)
    assert result["statusCode"] == 405

