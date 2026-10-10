from typing import Protocol

from models.search import SearchQuery, SearchResult


class SearchRepository(Protocol):
    def search(
        self,
        query: SearchQuery,
    ) -> tuple[int, list[SearchResult]]:
        ...