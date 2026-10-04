from indexer.mapper import to_search_document


def test_building_maps_own_id_and_code():
    item = {
        "id": "lc3",
        "code": "LC3",
        "GSI0PK": "BUILDING",
        "name": {
            "th": "อาคาร LC3",
            "en": "LC3 Building",
        },
        "description": {
            "th": "อาคารเรียนรวม LC3",
            "en": "LC3 lecture building",
        },
    }

    result = to_search_document(item)

    assert result["id"] == "lc3"
    assert result["building_id"] == "lc3"
    assert result["building_code"] == "LC3"
    assert result["title_th"] == "อาคาร LC3"
    assert result["title_en"] == "LC3 Building"
    assert result["description_th"] == "อาคารเรียนรวม LC3"
    assert result["description_en"] == "LC3 lecture building"


def test_building_lc4_maps_correctly():
    item = {
        "id": "lc4",
        "code": "LC4",
        "GSI0PK": "BUILDING",
        "name": {
            "th": "อาคาร LC4",
            "en": "LC4 Building",
        },
    }

    result = to_search_document(item)

    assert result["id"] == "lc4"
    assert result["building_id"] == "lc4"
    assert result["building_code"] == "LC4"


def test_floor_maps_building_relationship():
    item = {
        "id": "d5fa5502-e9a8-4bad-a463-5563ab8100e1",
        "GSI0PK": "FLOOR",
        "GSI1PK": "BUILDING#lc3",
        "floor_number": 1,
    }

    result = to_search_document(item)

    assert result["id"] == "d5fa5502-e9a8-4bad-a463-5563ab8100e1"


def test_room_maps_building_id_and_code():
    item = {
        "id": "room-101",
        "GSI0PK": "ROOM",
        "room_number": "101",
        "building_id": "lc3",
        "building_code": "LC3",
        "name": {
            "th": "ห้อง 101",
            "en": "Room 101",
        },
        "type": "OFFICE",
    }

    result = to_search_document(item)

    assert result["id"] == "room-101"
    assert result["type"] == "OFFICE"
    assert result["building_id"] == "lc3"
    assert result["building_code"] == "LC3"
    assert result["room_number"] == "101"
    assert result["title_th"] == "ห้อง 101"
    assert result["title_en"] == "Room 101"


def test_room_without_building_info_returns_none():
    item = {
        "id": "room-101",
        "GSI0PK": "ROOM",
        "room_number": "101",
    }

    result = to_search_document(item)

    assert result.get("building_id") is None
    assert result.get("building_code") is None


def test_room_with_null_room_number():
    item = {
        "id": "b03ee151-ed18-4b2d-a674-f2a4577e37d6",
        "GSI0PK": "ROOM",
        "room_number": None,
        "name": {
            "th": "LAB102",
            "en": "Laboratory 102",
        },
        "type": "LAB",
    }

    result = to_search_document(item)

    assert result["id"] == "b03ee151-ed18-4b2d-a674-f2a4577e37d6"
    assert result["type"] == "LAB"
    assert result.get("room_number") is None
    assert result["title_th"] == "LAB102"
    assert result["title_en"] == "Laboratory 102"


def test_room_101_maps_correctly():
    item = {
        "id": "d783648a-ec7d-4f6d-a308-06849426a8f3",
        "GSI0PK": "ROOM",
        "room_number": "101",
        "name": {
            "th": "ห้องพักอาจารย์ (คณิตศาสตร์และสถิติ)",
            "en": "Faculty Offices (Mathematics and Statistics)",
        },
        "type": "OFFICE",
    }

    result = to_search_document(item)

    assert result["id"] == "d783648a-ec7d-4f6d-a308-06849426a8f3"
    assert result["type"] == "OFFICE"
    assert result["room_number"] == "101"
    assert result["title_th"] == "ห้องพักอาจารย์ (คณิตศาสตร์และสถิติ)"
    assert result["title_en"] == "Faculty Offices (Mathematics and Statistics)"


def test_room_supports_camel_case_building_fields():
    item = {
        "id": "room-102",
        "GSI0PK": "ROOM",
        "room_number": "102",
        "buildingId": "lc3",
        "buildingCode": "LC3",
    }

    result = to_search_document(item)

    assert result["building_id"] == "lc3"
    assert result["building_code"] == "LC3"


def test_facility_maps_correctly():
    item = {
        "id": "f000746f-3244-45e7-9d05-449381b58537",
        "GSI0PK": "FACILITY",
        "name": {
            "th": "West Stair",
            "en": "West Stair",
        },
        "description": {
            "th": None,
            "en": None,
        },
        "type": "STAIR",
    }

    result = to_search_document(item)

    assert result["id"] == "f000746f-3244-45e7-9d05-449381b58537"
    assert result["type"] == "STAIR"
    assert result["title_th"] == "West Stair"
    assert result["title_en"] == "West Stair"


def test_facility_with_description():
    item = {
        "id": "facility-001",
        "GSI0PK": "FACILITY",
        "name": {
            "th": "บันได 1",
            "en": "Stair 1",
        },
        "description": {
            "th": "บันไดฝั่งตะวันตก",
            "en": "West stair",
        },
        "type": "STAIR",
    }

    result = to_search_document(item)

    assert result["title_th"] == "บันได 1"
    assert result["title_en"] == "Stair 1"
    assert result["description_th"] == "บันไดฝั่งตะวันตก"
    assert result["description_en"] == "West stair"


def test_course_schedule_maps_correctly():
    item = {
        "id": "80f634e5-c206-46ac-bc5d-47b688a46883",
        "GSI0PK": "SCHEDULE",
        "type": "COURSE",
        "title": "Distributed Systems",
        "description": "Lecture and project coordination for CS361",
        "course_code": "CS364",
        "organizer": "Aj. Example",
        "start_at": "2026-10-07T13:00:00+07:00",
        "end_at": "2026-10-07T16:00:00+07:00",
        "time_zone": "Asia/Bangkok",
        "room_id": "b03ee151-ed18-4b2d-a674-f2a4577e37d6",
        "status": "CONFIRM",
    }

    result = to_search_document(item)

    assert result["id"] == "80f634e5-c206-46ac-bc5d-47b688a46883"
    assert result["type"] == "COURSE"
    assert result["title"] == "Distributed Systems"
    assert result["description"] == "Lecture and project coordination for CS361"
    assert result["course_code"] == "CS364"
    assert result["organizer"] == "Aj. Example"
    assert result["room_id"] == "b03ee151-ed18-4b2d-a674-f2a4577e37d6"
    assert result["status"] == "CONFIRM"


def test_exam_schedule_maps_correctly():
    item = {
        "id": "5e42c33b-817f-4546-89f3-346d6bae5d47",
        "GSI0PK": "SCHEDULE",
        "type": "EXAM",
        "title": "Distributed Systems Midterm Exam",
        "description": "Midterm examination for CS361",
        "course_code": "CS364",
        "organizer": "Aj. Example",
        "start_at": "2026-11-18T09:00:00+07:00",
        "end_at": "2026-11-18T12:00:00+07:00",
        "room_id": "b03ee151-ed18-4b2d-a674-f2a4577e37d6",
        "status": "CONFIRM",
    }

    result = to_search_document(item)

    assert result["id"] == "5e42c33b-817f-4546-89f3-346d6bae5d47"
    assert result["type"] == "EXAM"
    assert result["title"] == "Distributed Systems Midterm Exam"
    assert result["course_code"] == "CS364"


def test_activity_schedule_maps_correctly():
    item = {
        "id": "7e1fc2b1-9020-45a7-8d3c-0b402488bdd2",
        "GSI0PK": "SCHEDULE",
        "type": "ACTIVITY",
        "title": "Cybersecurity & CTF Workshop",
        "description": "Hands-on security training session",
        "organizer": "CSTU Cyber Club",
        "start_at": "2026-10-09T17:00:00+07:00",
        "end_at": "2026-10-09T20:00:00+07:00",
        "time_zone": "Asia/Bangkok",
        "room_id": "b03ee151-ed18-4b2d-a674-f2a4577e37d6",
        "status": "CONFIRM",
    }

    result = to_search_document(item)

    assert result["id"] == "7e1fc2b1-9020-45a7-8d3c-0b402488bdd2"
    assert result["type"] == "ACTIVITY"
    assert result["title"] == "Cybersecurity & CTF Workshop"
    assert result["organizer"] == "CSTU Cyber Club"


def test_schedule_maps_recurrence_rule():
    item = {
        "id": "schedule-001",
        "GSI0PK": "SCHEDULE",
        "type": "COURSE",
        "title": "Distributed Systems",
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=WE;COUNT=8",
    }

    result = to_search_document(item)

    assert result["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=WE;COUNT=8"


def test_missing_name_does_not_crash():
    item = {
        "id": "room-no-name",
        "GSI0PK": "ROOM",
        "room_number": "999",
    }

    result = to_search_document(item)

    assert result["id"] == "room-no-name"


def test_missing_description_does_not_crash():
    item = {
        "id": "building-no-description",
        "GSI0PK": "BUILDING",
        "code": "TEST",
        "name": {
            "th": "อาคารทดสอบ",
            "en": "Test Building",
        },
    }

    result = to_search_document(item)

    assert result["id"] == "building-no-description"
    assert result["building_code"] == "TEST"
    assert result["title_th"] == "อาคารทดสอบ"
    assert result["title_en"] == "Test Building"


def test_unknown_entity_type_does_not_crash():
    item = {
        "id": "unknown-001",
        "GSI0PK": "UNKNOWN",
        "name": {
            "th": "Unknown",
            "en": "Unknown",
        },
    }

    result = to_search_document(item)

    assert result["id"] == "unknown-001"