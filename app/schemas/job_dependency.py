from pydantic import BaseModel
from uuid import UUID


class JobDependencyCreate(BaseModel):
    parent_job_id: UUID
    child_job_id: UUID