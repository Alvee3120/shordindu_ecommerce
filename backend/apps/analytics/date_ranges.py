"""Reusable, timezone-aware date-range resolution.

All boundaries are computed in ``settings.TIME_ZONE`` (Asia/Dhaka) and returned
as tz-aware datetimes with an *exclusive* ``end`` so callers can uniformly use
``placed_at__gte=start, placed_at__lt=end``.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError

PRESET_KEYS = [
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month",
    "this_year",
    "last_year",
    "custom",
]

DEFAULT_PRESET = "this_month"

_PRESET_LABELS = {
    "today": "Today",
    "yesterday": "Yesterday",
    "this_week": "This Week",
    "last_week": "Last Week",
    "this_month": "This Month",
    "last_month": "Last Month",
    "this_year": "This Year",
    "last_year": "Last Year",
    "custom": "Custom Range",
}

ALLOWED_GRANULARITIES = ("auto", "daily", "weekly", "monthly", "yearly")


def _tz():
    return ZoneInfo(settings.TIME_ZONE)


def _day_start(value):
    return datetime(value.year, value.month, value.day, tzinfo=_tz())


def _month_start(value):
    return value.replace(day=1)


def _add_months(value, months):
    year = value.year + (value.month - 1 + months) // 12
    month = (value.month - 1 + months) % 12 + 1
    return date(year, month, 1)


@dataclass
class ResolvedRange:
    key: str
    label: str
    start: datetime  # inclusive
    end: datetime  # exclusive
    start_date: date
    end_date: date  # inclusive last day
    prev_start: datetime
    prev_end: datetime

    @property
    def days(self):
        return (self.end - self.start).days

    def granularity(self, requested="auto"):
        if requested not in ALLOWED_GRANULARITIES:
            raise ValidationError(
                {"granularity": [f"Allowed: {', '.join(ALLOWED_GRANULARITIES)}."]}
            )
        if requested != "auto":
            return requested
        if self.days <= 62:
            return "daily"
        if self.days <= 730:
            return "weekly"
        if self.days <= 1095:
            return "monthly"
        return "yearly"

    def as_dict(self):
        return {
            "key": self.key,
            "label": self.label,
            "start": self.start_date.isoformat(),
            "end": self.end_date.isoformat(),
            "days": self.days,
        }


def _parse_date(value, field):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ValidationError({field: ["Use ISO format YYYY-MM-DD."]})


def _parse_custom(start, end, today):
    if not start or not end:
        raise ValidationError({"range": ["Custom range requires both start and end dates."]})
    first = _parse_date(start, "start")
    last = _parse_date(end, "end")
    if first > last:
        raise ValidationError({"end": ["End date must be on or after the start date."]})
    if last > today:
        raise ValidationError({"end": ["End date cannot be in the future."]})
    return first, last


def resolve_range(range_key=None, start=None, end=None, today=None):
    """Resolve a preset key or explicit ``start``/``end`` into a ``ResolvedRange``."""
    key = (range_key or DEFAULT_PRESET).lower()
    if key not in PRESET_KEYS:
        raise ValidationError(
            {"range": [f"Invalid range. Allowed: {', '.join(PRESET_KEYS)}."]}
        )

    today = today or timezone.localdate()

    if key == "today":
        first = last = today
    elif key == "yesterday":
        first = last = today - timedelta(days=1)
    elif key == "this_week":
        first = today - timedelta(days=today.weekday())
        last = today
    elif key == "last_week":
        monday = today - timedelta(days=today.weekday())
        first = monday - timedelta(days=7)
        last = monday - timedelta(days=1)
    elif key == "this_month":
        first = _month_start(today)
        last = today
    elif key == "last_month":
        first = _add_months(_month_start(today), -1)
        last = _month_start(today) - timedelta(days=1)
    elif key == "this_year":
        first = date(today.year, 1, 1)
        last = today
    elif key == "last_year":
        first = date(today.year - 1, 1, 1)
        last = date(today.year - 1, 12, 31)
    else:  # custom
        first, last = _parse_custom(start, end, today)

    start_dt = _day_start(first)
    end_dt = _day_start(last + timedelta(days=1))
    span = end_dt - start_dt
    prev_end = start_dt
    prev_start = start_dt - span

    label = _PRESET_LABELS[key]
    if key == "custom":
        label = f"{first.isoformat()} \u2192 {last.isoformat()}"

    return ResolvedRange(
        key=key,
        label=label,
        start=start_dt,
        end=end_dt,
        start_date=first,
        end_date=last,
        prev_start=prev_start,
        prev_end=prev_end,
    )


def bucket_dates(start_date, end_date, granularity):
    """Ordered list of bucket-start dates covering ``[start_date, end_date]``."""
    dates = []
    if granularity == "daily":
        current = start_date
        while current <= end_date:
            dates.append(current)
            current += timedelta(days=1)
    elif granularity == "weekly":
        current = start_date - timedelta(days=start_date.weekday())
        while current <= end_date:
            dates.append(current)
            current += timedelta(days=7)
    elif granularity == "monthly":
        current = _month_start(start_date)
        while current <= end_date:
            dates.append(current)
            current = _add_months(current, 1)
    else:  # yearly
        current = date(start_date.year, 1, 1)
        while current <= end_date:
            dates.append(current)
            current = date(current.year + 1, 1, 1)
    return dates
