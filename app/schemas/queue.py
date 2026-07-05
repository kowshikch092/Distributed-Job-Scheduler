from typing import Optional

from pydantic import BaseModel
from uuid import UUID


class QueueCreate(BaseModel):
    workflow_id: Optional[UUID] = None
    name: str
    priority: int
    concurrency: int = 3