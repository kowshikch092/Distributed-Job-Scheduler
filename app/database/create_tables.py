from sqlalchemy import inspect, text

from app.database.base import Base
from app.database.session import engine

# IMPORTANT: import ALL models so SQLAlchemy registers them
from app.models.workflow import Workflow
from app.models.queue import Queue
from app.models.job import Job
from app.models.job_execution import JobExecution
from app.models.job_dependency import JobDependency
from app.models.job_log import JobLog
from app.models.worker import Worker
from app.models.user import User


def create_tables():
    Base.metadata.create_all(bind=engine)
    repair_legacy_queue_schema()
    repair_workers_schema()
    repair_jobs_schema()


def repair_legacy_queue_schema():
    inspector = inspect(engine)
    queue_columns = {column["name"] for column in inspector.get_columns("queues")}

    if "workflow_id" in queue_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE queues ADD COLUMN workflow_id UUID"))
        connection.execute(
            text(
                "ALTER TABLE queues "
                "ADD CONSTRAINT fk_queues_workflow_id "
                "FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE"
            )
        )

        queue_count = connection.execute(text("SELECT COUNT(*) FROM queues")).scalar_one()
        if queue_count == 0:
            connection.execute(text("ALTER TABLE queues ALTER COLUMN workflow_id SET NOT NULL"))


def repair_workers_schema():
    inspector = inspect(engine)
    worker_columns = {column["name"] for column in inspector.get_columns("workers")}

    if "last_heartbeat" in worker_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE workers ADD COLUMN last_heartbeat TIMESTAMP"))


def repair_jobs_schema():
    inspector = inspect(engine)
    job_columns = {column["name"] for column in inspector.get_columns("jobs")}

    if "worker_id" in job_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE jobs ADD COLUMN worker_id UUID"))
        connection.execute(
            text(
                "ALTER TABLE jobs "
                "ADD CONSTRAINT fk_jobs_worker_id "
                "FOREIGN KEY (worker_id) REFERENCES workers (id) ON DELETE SET NULL"
            )
        )


if __name__ == "__main__":
    create_tables()