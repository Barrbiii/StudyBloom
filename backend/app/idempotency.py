"""Atomically record an authenticated creation; no response bodies or credentials are retained."""
import hashlib
import json
from typing import Annotated
from fastapi import Header, HTTPException
from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base

RequestKey=Annotated[str | None,Header(alias='Idempotency-Key',min_length=16,max_length=128,pattern=r'^[A-Za-z0-9_-]+$')]

class CreationReceipt(Base):
    __tablename__='creation_receipts'
    __table_args__=(UniqueConstraint('owner_id','request_key'),)
    id: Mapped[int]=mapped_column(Integer,primary_key=True)
    owner_id: Mapped[int]=mapped_column(ForeignKey('users.id'),index=True)
    request_key: Mapped[str]=mapped_column(String(128))
    scope: Mapped[str]=mapped_column(String(200))
    fingerprint: Mapped[str]=mapped_column(String(64))
    resource_id: Mapped[int | None]=mapped_column(Integer,nullable=True)


def save_created(db,item,user,key,scope,payload):
    fingerprint=hashlib.sha256((scope+'\n'+json.dumps(payload.model_dump(mode='json'),sort_keys=True,separators=(',',':'),ensure_ascii=False)).encode()).hexdigest()
    def replay(receipt):
        if receipt.scope!=scope or receipt.fingerprint!=fingerprint:
            raise HTTPException(409,'Ключ запроса уже использован с другими данными')
        existing=db.get(type(item),receipt.resource_id) if receipt.resource_id is not None else None
        if existing is None or (hasattr(existing,'owner_id') and existing.owner_id!=user.id) or (hasattr(item,'task_id') and existing.task_id!=item.task_id):
            raise HTTPException(410,'Запись уже удалена. Повтор не создаёт её заново')
        return existing
    def receipt():
        return db.scalar(select(CreationReceipt).where(CreationReceipt.owner_id==user.id,CreationReceipt.request_key==key))
    if key:
        previous=receipt()
        if previous is not None:return replay(previous)
    try:
        db.add(item);db.flush()
        if key:db.add(CreationReceipt(owner_id=user.id,request_key=key,scope=scope,fingerprint=fingerprint,resource_id=item.id))
        db.commit()
    except IntegrityError:
        db.rollback()
        if key:
            previous=receipt()
            if previous is not None:return replay(previous)
        raise
    db.refresh(item)
    return item


def invalidate_creation(db,scope,resource_id,owner_id):
    for receipt in db.scalars(select(CreationReceipt).where(CreationReceipt.owner_id==owner_id,CreationReceipt.scope==scope,CreationReceipt.resource_id==resource_id)):
        receipt.resource_id=None
