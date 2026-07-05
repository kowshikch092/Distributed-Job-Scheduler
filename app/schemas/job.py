from typing import Optional

from pydantic import BaseModel
from uuid import UUID


class JobCreate(BaseModel):
    workflow_id: Optional[UUID] = None
    queue_id: UUID
    name: str
    priority: int
    job_type: str = 'default'