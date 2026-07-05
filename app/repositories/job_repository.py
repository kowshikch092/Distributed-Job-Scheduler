from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.job_dependency import JobDependency
from app.models.worker import Worker


class JobRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_ready_jobs(self):
        return (
            self.db.query(Job)
            .filter(Job.status == "READY")
            .order_by(Job.priority.asc())
            .all()
        )

    def update_status(self, job: Job, status: str):
        job.status = status
        self.db.commit()
        self.db.refresh(job)

    def increment_retry(self, job: Job):
        job.retry_count += 1
        self.db.commit()
        self.db.refresh(job)

    def assign_worker(self, job: Job, worker: Worker):
        job.worker_id = worker.id
        self.db.commit()
        self.db.refresh(job)

    def clear_worker(self, job: Job):
        job.worker_id = None
        self.db.commit()
        self.db.refresh(job)

    def requeue_jobs_from_workers(self, worker_ids):
        jobs = (
            self.db.query(Job)
            .filter(
                Job.worker_id.in_(worker_ids),
                Job.status == "RUNNING",
            )
            .all()
        )

        for job in jobs:
            job.retry_count += 1
            job.status = "READY"
            job.worker_id = None

        self.db.commit()
        return jobs

    def mark_child_jobs_ready(self, completed_job_id):
        """
        After a job completes, check all of its child jobs.
        A child becomes READY only if ALL of its parent jobs
        are COMPLETED.
        """

        child_jobs = (
            self.db.query(Job)
            .join(JobDependency, Job.id == JobDependency.child_job_id)
            .filter(
                JobDependency.parent_job_id == completed_job_id,
            )
            .all()
        )

        for child in child_jobs:
            parents = (
                self.db.query(Job)
                .join(JobDependency, Job.id == JobDependency.parent_job_id)
                .filter(JobDependency.child_job_id == child.id)
                .all()
            )

            if all(parent.status == "COMPLETED" for parent in parents):
                if child.status == "WAITING":
                    child.status = "READY"
                    print(f"🟢 {child.name} is READY")

        self.db.commit()

    def get_job_status_counts(self):
        from sqlalchemy import func

        rows = (
            self.db.query(Job.status, func.count(Job.id))
            .group_by(Job.status)
            .all()
        )

        return {status: count for status, count in rows}