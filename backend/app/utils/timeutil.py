from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC now, the representation MongoDB round-trips by default."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_epoch(dt: datetime) -> int:
    """Epoch seconds for a naive-UTC (or aware) datetime."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())
