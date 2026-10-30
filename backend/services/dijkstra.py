"""
Dijkstra shortest-path implementation.

Pure algorithm: no AWS, no database access, no HTTP.
Layer: domain / service.
"""

import heapq

from models.navigation import CorridorEdge, NavigationNode


def find_shortest_path(
    nodes: dict[str, NavigationNode],
    edges: list[CorridorEdge],
    start_node_id: str,
    end_node_id: str,
) -> tuple[list[str], float] | None:
    """
    Find the shortest path between start_node_id and end_node_id using Dijkstra's algorithm.

    Requirements:
    - Rejects negative weights.
    - Filters out inactive/blocked nodes and edges.
    - Produces deterministic results for equal-cost paths (node_id tie-breaking).
    - Returns (path_node_ids, total_distance) or None if unreachable.
    """
    if start_node_id not in nodes:
        return None
    if end_node_id not in nodes:
        return None

    if not nodes[start_node_id].is_active or not nodes[end_node_id].is_active:
        return None

    if start_node_id == end_node_id:
        return [start_node_id], 0.0

    # Build adjacency list: node_id -> list of (neighbor_id, weight, edge_id)
    adj: dict[str, list[tuple[str, float, str]]] = {nid: [] for nid in nodes}

    for edge in edges:
        if not edge.is_active:
            continue
        if edge.distance_weight < 0:
            raise ValueError(
                f"Negative distance weight {edge.distance_weight} on edge '{edge.id}' is invalid"
            )

        u = edge.from_node_id
        v = edge.to_node_id

        # Edge endpoints must both exist in active nodes
        if u in nodes and v in nodes and nodes[u].is_active and nodes[v].is_active:
            adj[u].append((v, float(edge.distance_weight), edge.id))
            adj[v].append((u, float(edge.distance_weight), edge.id))

    # Priority queue: (cost, node_id)
    # Using node_id in tuple ensures deterministic tie-breaking without comparing complex objects
    dist: dict[str, float] = {nid: float("inf") for nid in nodes}
    prev: dict[str, str | None] = {nid: None for nid in nodes}

    dist[start_node_id] = 0.0
    pq: list[tuple[float, str]] = [(0.0, start_node_id)]

    visited: set[str] = set()

    while pq:
        current_cost, u = heapq.heappop(pq)

        if u in visited:
            continue
        visited.add(u)

        if u == end_node_id:
            break

        if current_cost > dist[u]:
            continue

        # Sort neighbors for deterministic traversal when costs are identical
        neighbors = sorted(adj.get(u, []), key=lambda item: item[0])

        for v, weight, _edge_id in neighbors:
            if v in visited:
                continue
            new_cost = current_cost + weight
            if new_cost < dist[v]:
                dist[v] = new_cost
                prev[v] = u
                heapq.heappush(pq, (new_cost, v))

    if dist[end_node_id] == float("inf"):
        return None

    # Reconstruct path
    path: list[str] = []
    curr: str | None = end_node_id
    while curr is not None:
        path.append(curr)
        curr = prev[curr]
    path.reverse()

    return path, dist[end_node_id]
