import os
import jwt
from jwt import PyJWKClient
from errors import UnauthorizedError, ForbiddenError

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

_jwks_clients: dict[str, PyJWKClient] = {}

def _get_jwks_client(supabase_url: str) -> PyJWKClient:
    url = supabase_url.rstrip("/")
    if url not in _jwks_clients:
        jwks_url = f"{url}/auth/v1/.well-known/jwks.json"
        _jwks_clients[url] = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)
    return _jwks_clients[url]

   

def verify_token(event: dict, required_role: str = None) -> dict:
    headers = event.get("headers") or {}
    auth_header = headers.get("authorization") or headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise UnauthorizedError("Missing or invalid authentication token.")

    token = auth_header.split(" ")[1]

    try:
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg")

        if alg == "ES256":
            base_url = os.environ.get("SUPABASE_URL") or SUPABASE_URL
            if not base_url:
                raise UnauthorizedError("SUPABASE_URL is not configured for ES256 verification")
            jwks_client = _get_jwks_client(base_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            key = signing_key.key
            allowed_algs = ["ES256"]
        elif alg == "HS256":
            key = os.environ.get("SUPABASE_JWT_SECRET") or SUPABASE_JWT_SECRET
            allowed_algs = ["HS256"]
        else:
            raise UnauthorizedError("Missing or invalid authentication token.")

        payload = jwt.decode(
            token,
            key,
            algorithms=allowed_algs,
            audience="authenticated",
        )
    except (jwt.PyJWTError, UnauthorizedError) as exc:
        raise UnauthorizedError("Missing or invalid authentication token.") from exc

    # Check user role from app_metadata (claims) first, then user_metadata
    app_metadata = payload.get("app_metadata") or {}
    user_metadata = payload.get("user_metadata") or {}
    user_role = app_metadata.get("role") or user_metadata.get("role") or "STUDENT"

    if required_role and user_role != required_role:
        raise ForbiddenError(f"Operation requires {required_role} role")

    return {
        "user_id": payload.get("sub"),
        "email": payload.get("email"),
        "role": user_role,
        "token": token,
    }
