import uuid

from app.models.workflow import Workflow
from app.models.queue import Queue
from app.models.job import Job
from app.models.job_dependency import JobDependency


class WorkflowService:

    def __init__(self, db):
        self.db = db

    def create_pdf_workflow(self):

        workflow = Workflow(
            id=uuid.uuid4(),
            name="PDF Workflow",
            status="CREATED",
        )

        self.db.add(workflow)
        self.db.flush()

        queue = Queue(
            id=uuid.uuid4(),
            workflow_id=workflow.id,
            name="PDF Queue",
            priority=1,
        )

        self.db.add(queue)
        self.db.flush()

        extract = Job(
            id=uuid.uuid4(),
            workflow_id=workflow.id,
            queue_id=queue.id,
            name="Extract Text",
            job_type="TEXT_EXTRACTION",
            priority=1,
            status="READY",
        )

        metadata = Job(
            id=uuid.uuid4(),
            workflow_id=workflow.id,
            queue_id=queue.id,
            name="Generate Metadata",
            job_type="METADATA",
            priority=2,
            status="WAITING",
        )

        embeddings = Job(
            id=uuid.uuid4(),
            workflow_id=workflow.id,
            queue_id=queue.id,
            name="Generate Embeddings",
            job_type="EMBEDDINGS",
            priority=2,
            status="WAITING",
        )

        summary = Job(
            id=uuid.uuid4(),
            workflow_id=workflow.id,
            queue_id=queue.id,
            name="Generate Summary",
            job_type="SUMMARY",
            priority=3,
            status="WAITING",
        )

        self.db.add_all([
            extract,
            metadata,
            embeddings,
            summary,
        ])

        self.db.flush()

        dependencies = [

            JobDependency(
                id=uuid.uuid4(),
                parent_job_id=extract.id,
                child_job_id=metadata.id,
            ),

            JobDependency(
                id=uuid.uuid4(),
                parent_job_id=extract.id,
                child_job_id=embeddings.id,
            ),

            JobDependency(
                id=uuid.uuid4(),
                parent_job_id=metadata.id,
                child_job_id=summary.id,
            ),

            JobDependency(
                id=uuid.uuid4(),
                parent_job_id=embeddings.id,
                child_job_id=summary.id,
            ),
        ]

        self.db.add_all(dependencies)

        self.db.commit()

        return workflow.id