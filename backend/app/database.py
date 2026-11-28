import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]
connection_options = {'connect_args': {'connect_timeout': 3}, 'pool_timeout': 5} if DATABASE_URL.startswith('postgresql') else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, **connection_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as session:
        yield session
