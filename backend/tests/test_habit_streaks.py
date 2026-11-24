from datetime import date, timedelta
from app.habit_streaks import streaks

def test_streak_including_today_and_duplicate_dates():
    today = date(2026, 3, 1)
    days = [today - timedelta(days=n) for n in range(4)]
    assert streaks(days + [today], today) == {'current_streak': 4, 'best_streak': 4, 'completed_days': 4}

def test_unfinished_today_preserves_yesterday_but_gap_breaks_streak():
    today = date(2026, 1, 1)
    assert streaks([today - timedelta(days=1), today - timedelta(days=2)], today)['current_streak'] == 2
    assert streaks([today - timedelta(days=2)], today)['current_streak'] == 0

def test_best_streak_is_historical_and_future_excluded():
    today = date(2026, 11, 24)
    days = [today-timedelta(days=n) for n in [0, 3, 4, 5, 10]] + [today+timedelta(days=1)]
    assert streaks(days, today) == {'current_streak': 1, 'best_streak': 3, 'completed_days': 5}
    assert streaks([], today) == {'current_streak': 0, 'best_streak': 0, 'completed_days': 0}
