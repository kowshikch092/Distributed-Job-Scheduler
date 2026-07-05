from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class JobExecutionCreate(BaseModel):
    job_id: UUID
    worker_id: UUID
    status: str


class JobExecutionUpdate(BaseModel):
    status: str
    completed_at: datetime
    exit_code: Optional[int] = None
    error_message: Optional[str] = None


class JobExecutionRead(BaseModel):
    id: UUID
    job_id: UUID
    worker_id: Optional[UUID]
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[int]
    exit_code: Optional[int]
    error_message: Optional[str]
    job_name: Optional[str] = None
    worker_name: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True
