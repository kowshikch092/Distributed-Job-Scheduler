from pydantic import BaseModel


class WorkerHeartbeat(BaseModel):
    worker_id: str