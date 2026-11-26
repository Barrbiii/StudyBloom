from calendar import monthrange
from datetime import timedelta


def occurrences(starts_on, ends_on, cadence, first, last):
    """A monthly template keeps its original day, clamped in shorter months."""
    first = max(first, starts_on)
    last = min(last, ends_on) if ends_on else last
    if first > last:
        return []
    days = [first + timedelta(days=n) for n in range((last-first).days+1)]
    return [day for day in days if cadence == 'daily'
            or cadence == 'weekly' and (day-starts_on).days % 7 == 0
            or cadence == 'monthly' and day.day == min(starts_on.day, monthrange(day.year, day.month)[1])]
