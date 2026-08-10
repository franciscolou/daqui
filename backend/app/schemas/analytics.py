from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.models.analytics import AnalyticsEventType


class AnalyticsEventIn(BaseModel):
    event_type: AnalyticsEventType
    session_id: str
    screen: Optional[str] = None
    label: Optional[str] = None
    query: Optional[str] = None
    duration_ms: Optional[int] = None
    is_exit: bool = False
    platform: str = "web"


class AnalyticsEventsIn(BaseModel):
    events: list[AnalyticsEventIn]


class DailyActiveUsersOut(BaseModel):
    date: str
    count: int


class ScreenTimeOut(BaseModel):
    screen: str
    avg_duration_seconds: float
    views: int


class ScreenExitOut(BaseModel):
    screen: str
    exits: int


class ClickStatOut(BaseModel):
    label: str
    screen: Optional[str] = None
    count: int


class SearchStatOut(BaseModel):
    query: str
    count: int


class PlatformStatOut(BaseModel):
    platform: str
    active_users: int


class HourlyStatOut(BaseModel):
    hour: str
    count: int


class AnalyticsOverviewOut(BaseModel):
    date_from: date
    date_to: date
    active_users: int
    total_sessions: int
    avg_session_duration_seconds: float
    total_searches: int
    total_clicks: int
    new_users: int
    returning_users: int
    avg_screens_per_session: float
    daily_active_users: list[DailyActiveUsersOut]
    top_screens: list[ScreenTimeOut]
    top_exit_screens: list[ScreenExitOut]
    top_clicks: list[ClickStatOut]
    top_searches: list[SearchStatOut]
    platform_breakdown: list[PlatformStatOut]
    hourly_activity: list[HourlyStatOut]
