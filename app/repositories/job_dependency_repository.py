from sqlalchemy.orm import Session

from app.models.job_dependency import JobDependency
from app.models.job import Job


class JobDependencyRepository:

    def __init__(self, db: Session):
        self.db = db

    def dependencies_completed(self, job_id):

        dependencies = (
            self.db.query(JobDependency)
            .filter(JobDependency.child_job_id == job_id)
            .all()
        )

        for dependency in dependencies:

            parent = (
                self.db.query(Job)
                .filter(Job.id == dependency.parent_job_id)
                .first()
            )

            if parent.status != "COMPLETED":
                return False

        return True