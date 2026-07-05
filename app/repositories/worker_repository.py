from datetime import datetime, timedelta

from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.worker import Worker


class WorkerRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, worker_id):
        return self.db.query(Worker).filter(Worker.id == worker_id).first()

    def get_by_name(self, name: str):
        return self.db.query(Worker).filter(Worker.name == name).first()

    def get_all(self):
        return self.db.query(Worker).order_by(Worker.created_at.asc()).all()

    def ensure_default_worker(self, name: str = "scheduler-worker-1"):
        worker = self.get_by_name(name)

        if worker is not None:
            return worker

        worker = Worker(
            name=name,
            status="ONLINE",
            last_heartbeat=datetime.utcnow(),
        )

        self.db.add(worker)
        self.db.commit()
        self.db.refresh(worker)
        return worker

    def update_heartbeat(self, worker: Worker):
        worker.last_heartbeat = datetime.utcnow()
        worker.status = "ONLINE"
        self.db.commit()
        self.db.refresh(worker)
        return worker

    def get_available_worker(self):
        """
        Return an ONLINE worker with the fewest RUNNING jobs.
        """
        running_jobs_subquery = (
            self.db.query(
                Job.worker_id.label("worker_id"),
                func.count(Job.id).label("running_jobs"),
            )
            .filter(Job.status == "RUNNING")
            .group_by(Job.worker_id)
            .subquery()
        )

        running_jobs_count = func.coalesce(running_jobs_subquery.c.running_jobs, 0).label("running_jobs")

        row = (
            self.db.query(Worker, running_jobs_count)
            .outerjoin(running_jobs_subquery, Worker.id == running_jobs_subquery.c.worker_id)
            .filter(Worker.status == "ONLINE")
            .order_by(running_jobs_count, Worker.created_at.asc())
            .first()
        )

        return row[0] if row else None

    def mark_dead_workers(self, timeout_seconds: int = 20):
        cutoff = datetime.utcnow() - timedelta(seconds=timeout_seconds)

        workers = (
            self.db.query(Worker)
            .filter(
                or_(
                    Worker.last_heartbeat.is_(None),
                    Worker.last_heartbeat < cutoff,
                ),
                Worker.status != "DEAD",
            )
            .all()
        )

        for worker in workers:
            worker.status = "DEAD"

        self.db.commit()
        return workers