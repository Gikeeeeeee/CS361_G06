"""
Alias for ScheduleRepository to preserve backwards compatibility.
"""

from repositories.schedule_repository import ScheduleRepository, ScheduleRepository as DynamoDBScheduleRepository

__all__ = ["DynamoDBScheduleRepository", "ScheduleRepository"]
