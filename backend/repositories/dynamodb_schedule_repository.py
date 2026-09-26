"""
Alias for ScheduleRepository to preserve backwards compatibility.
"""

from repositories.ScheduleRepo import ScheduleRepository, ScheduleRepository as DynamoDBScheduleRepository

__all__ = ["DynamoDBScheduleRepository", "ScheduleRepository"]
