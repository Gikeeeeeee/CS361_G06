from indexer.mapper import get_deleted_document_id, get_storage_document_id


def test_storage_id_uses_dynamodb_primary_key():
    item = {"PK": "BUILDING#lc3", "SK": "META", "id": "lc3"}

    assert get_storage_document_id(item) == "BUILDING#lc3#META"


def test_delete_id_matches_storage_id_from_stream_keys():
    keys = {
        "PK": {"S": "BUILDING#lc3"},
        "SK": {"S": "META"},
    }

    assert get_deleted_document_id(keys) == "BUILDING#lc3#META"
