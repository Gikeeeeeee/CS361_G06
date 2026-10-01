from models.search import SearchQuery, SearchResponse
from ports.search_repository import SearchRepository
from errors import InvalidParameter


ALLOWED_TYPES = {
    "building",
    "room",
    "course",
    "schedule",
    "exam",
    "activity",
    "facility",
}


class SearchService:
    def __init__(self, repository: SearchRepository) -> None:
        self.repository = repository

    def search(
        self,
        query: str,
        *,
        entity_type: str | None = None,
        building_id: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> SearchResponse:
        query = query.strip()

        if not query:
            raise InvalidParameter(
                "Search query must not be empty."
            )

        if entity_type is not None:
            entity_type = entity_type.strip().lower()

            if entity_type not in ALLOWED_TYPES:
                raise InvalidParameter(
                    "Invalid search type. "
                    f"Allowed values: {sorted(ALLOWED_TYPES)}"
                )

        if page < 1:
            raise InvalidParameter(
                "page must be >= 1."
            )

        if page_size < 1 or page_size > 100:
            raise InvalidParameter(
                "page_size must be between 1 and 100."
            )

        search_query = SearchQuery(
            query=query,
            entity_type=entity_type,
            building_id=building_id,
            page=page,
            page_size=page_size,
        )

        total, results = self.repository.search(
            search_query
        )

        return SearchResponse(
            query=query,
            page=page,
            page_size=page_size,
            total=total,
            results=results,
        )