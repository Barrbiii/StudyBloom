from datetime import timedelta


def streaks(completed, today):
    """An unfinished today keeps yesterday's streak alive until midnight."""
    days = sorted(set(day for day in completed if day <= today))
    best = run = 0
    previous = None
    for day in days:
        run = run + 1 if previous is not None and day == previous + timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    cursor = today if today in days else today - timedelta(days=1)
    done = set(days)
    current = 0
    while cursor in done:
        current += 1
        cursor -= timedelta(days=1)
    return {'current_streak': current, 'best_streak': best, 'completed_days': len(days)}
