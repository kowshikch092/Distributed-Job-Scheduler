import random
import time

from fastapi import HTTPException

from app.repositories.worker_repository import WorkerRepository


class WorkerService:

    def __init__(self, db=None):
        self.repo = WorkerRepository(db) if db is not None else None

    def execute(self, job):

        print(f"🚀 Worker started job: {job.name}")

        time.sleep(2)

        # Simulate random job failures for testing
        if random.randint(1, 10) <= 3:
            raise Exception("Job execution failed")

        print(f"✅ Worker finished job: {job.name}")

    def heartbeat(self, worker_id: str):
        if self.repo is None:
            raise HTTPException(
                status_code=500,
                detail="Worker repository not configured",
            )

        worker = self.repo.get_by_id(worker_id)

        if worker is None:
            raise HTTPException(status_code=404, detail="Worker not found")

        return self.repo.update_heartbeat(worker)
