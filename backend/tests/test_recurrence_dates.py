from datetime import date
from app.recurrence_dates import occurrences


def test_monthly_keeps_anchor_after_short_and_leap_months():
    assert occurrences(date(2026,1,31), None, 'monthly', date(2026,1,1), date(2026,4,30)) == [date(2026,1,31), date(2026,2,28), date(2026,3,31), date(2026,4,30)]
    assert occurrences(date(2024,1,31), None, 'monthly', date(2024,2,1), date(2024,2,29)) == [date(2024,2,29)]


def test_weekly_and_daily_include_boundaries_across_year():
    start = date(2026,12,28)
    assert occurrences(start, date(2027,1,4), 'weekly', start, date(2027,2,1)) == [start, date(2027,1,4)]
    assert len(occurrences(start, date(2026,12,30), 'daily', start, date(2027,1,4))) == 3
    assert occurrences(start, None, 'weekly', date(2026,12,1), date(2026,12,27)) == []
