from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class SearchQuery:
    query: str
    entity_type: str | None = None
    building_id: str | None = None
    page: int = 1
    page_size: int = 20


@dataclass(frozen=True)
class SearchResult:
    id: str
    type: str
    title: str = ""
    name_th: str | None = None
    
    name_en: str | None = None
    
    subtitle: str | None = None

    description: str | None = None

    building_id: str | None = None
    building_code: str | None = None

    room_id: str | None = None
    room_code: str | None = None

    course_code: str | None = None
    organizer: str | None = None

    start_at: str | None = None
    end_at: str | None = None
    time_zone: str | None = None
    recurrence_rule: str | None = None

    status: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SearchResponse:
    query: str
    page: int
    page_size: int
    total: int
    results: list[SearchResult]

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "page": self.page,
            "page_size": self.page_size,
            "total": self.total,
            "results": [
                result.to_dict()
                for result in self.results
            ],
        }