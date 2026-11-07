import pytest

from models.navigation import CorridorEdge, NavigationNode
from services.dijkstra import find_shortest_path


def make_node(
    node_id: str, is_active: bool = True, x: float = 0.0, y: float = 0.0
) -> NavigationNode:
    return NavigationNode(
        id=node_id,
        name=f"Node {node_id}",
        status="ACTIVE" if is_active else "BLOCKED",
        svg_x=x,
        svg_y=y,
        floor_id="floor-1",
    )


def make_edge(
    edge_id: str,
    from_id: str,
    to_id: str,
    weight: float,
    is_active: bool = True,
) -> CorridorEdge:
    return CorridorEdge(
        id=edge_id,
        from_node_id=from_id,
        to_node_id=to_id,
        distance_weight=weight,
        status="ACTIVE" if is_active else "BLOCKED",
        floor_id="floor-1",
    )


@pytest.mark.unit
def test_dijkstra_simple_shortest_path():
    nodes = {
        "N1": make_node("N1"),
        "N2": make_node("N2"),
        "N3": make_node("N3"),
    }
    edges = [
        make_edge("E1", "N1", "N2", 10.0),
        make_edge("E2", "N2", "N3", 15.0),
        make_edge("E3", "N1", "N3", 30.0),
    ]

    result = find_shortest_path(nodes, edges, "N1", "N3")
    assert result is not None
    path, cost = result
    assert path == ["N1", "N2", "N3"]
    assert cost == 25.0


@pytest.mark.unit
def test_dijkstra_single_node_same_start_and_end():
    nodes = {"N1": make_node("N1")}
    edges = []

    result = find_shortest_path(nodes, edges, "N1", "N1")
    assert result is not None
    path, cost = result
    assert path == ["N1"]
    assert cost == 0.0


@pytest.mark.unit
def test_dijkstra_multiple_competing_routes():
    nodes = {
        "N1": make_node("N1"),
        "N2": make_node("N2"),
        "N3": make_node("N3"),
        "N4": make_node("N4"),
    }
    # Path A: N1 -> N2 -> N4 (cost 10 + 20 = 30)
    # Path B: N1 -> N3 -> N4 (cost 12 + 8 = 20)
    edges = [
        make_edge("E1", "N1", "N2", 10.0),
        make_edge("E2", "N2", "N4", 20.0),
        make_edge("E3", "N1", "N3", 12.0),
        make_edge("E4", "N3", "N4", 8.0),
    ]

    result = find_shortest_path(nodes, edges, "N1", "N4")
    assert result is not None
    path, cost = result
    assert path == ["N1", "N3", "N4"]
    assert cost == 20.0


@pytest.mark.unit
def test_dijkstra_deterministic_equal_cost():
    nodes = {
        "A": make_node("A"),
        "B": make_node("B"),
        "C": make_node("C"),
        "D": make_node("D"),
    }
    # Path A -> B -> D: cost 10 + 10 = 20
    # Path A -> C -> D: cost 10 + 10 = 20
    edges = [
        make_edge("E1", "A", "B", 10.0),
        make_edge("E2", "B", "D", 10.0),
        make_edge("E3", "A", "C", 10.0),
        make_edge("E4", "C", "D", 10.0),
    ]

    # Run multiple times to verify deterministic result
    results = [find_shortest_path(nodes, edges, "A", "D") for _ in range(5)]
    assert all(r == results[0] for r in results)


@pytest.mark.unit
def test_dijkstra_blocked_edge_rerouting():
    nodes = {
        "N1": make_node("N1"),
        "N2": make_node("N2"),
        "N3": make_node("N3"),
    }
    # Direct edge N1 -> N3 is shorter but blocked
    edges = [
        make_edge("E_direct", "N1", "N3", 5.0, is_active=False),
        make_edge("E1", "N1", "N2", 10.0, is_active=True),
        make_edge("E2", "N2", "N3", 10.0, is_active=True),
    ]

    result = find_shortest_path(nodes, edges, "N1", "N3")
    assert result is not None
    path, cost = result
    assert path == ["N1", "N2", "N3"]
    assert cost == 20.0


@pytest.mark.unit
def test_dijkstra_blocked_node_rerouting():
    nodes = {
        "N1": make_node("N1"),
        "N2": make_node("N2", is_active=False),  # Blocked intermediate node
        "N3": make_node("N3"),
        "N4": make_node("N4"),
    }
    edges = [
        make_edge("E1", "N1", "N2", 5.0),
        make_edge("E2", "N2", "N4", 5.0),
        make_edge("E3", "N1", "N3", 10.0),
        make_edge("E4", "N3", "N4", 10.0),
    ]

    result = find_shortest_path(nodes, edges, "N1", "N4")
    assert result is not None
    path, cost = result
    assert path == ["N1", "N3", "N4"]
    assert cost == 20.0


@pytest.mark.unit
def test_dijkstra_disconnected_graph():
    nodes = {
        "N1": make_node("N1"),
        "N2": make_node("N2"),
        "N3": make_node("N3"),
    }
    edges = [
        make_edge("E1", "N1", "N2", 10.0),
    ]

    result = find_shortest_path(nodes, edges, "N1", "N3")
    assert result is None


@pytest.mark.unit
def test_dijkstra_missing_node_references():
    nodes = {"N1": make_node("N1")}
    edges = []

    assert find_shortest_path(nodes, edges, "N1", "NONEXISTENT") is None
    assert find_shortest_path(nodes, edges, "NONEXISTENT", "N1") is None


@pytest.mark.unit
def test_dijkstra_negative_weight_rejected():
    nodes = {
        "N1": make_node("N1"),
        "N2": make_node("N2"),
    }
    edges = [
        make_edge("E1", "N1", "N2", -5.0),
    ]

    with pytest.raises(ValueError, match="Negative distance weight"):
        find_shortest_path(nodes, edges, "N1", "N2")
