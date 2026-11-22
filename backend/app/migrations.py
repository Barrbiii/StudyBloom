"""Аддитивная миграция: прежние строки остаются без владельца и скрыты API."""
from sqlalchemy import inspect, text

TABLES = ("tasks", "subjects", "deadlines", "calendar_events")


def migrate_owners(engine):
    with engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(7349201)"))
        inspector = inspect(connection)
        for table in TABLES:
            if table not in inspector.get_table_names():
                continue
            if "owner_id" not in {c["name"] for c in inspector.get_columns(table)}:
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN owner_id INTEGER REFERENCES users(id)"))
            connection.execute(text(f"CREATE INDEX IF NOT EXISTS ix_{table}_owner_id ON {table} (owner_id)"))
