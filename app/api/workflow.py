import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate

router = APIRouter(prefix="/workflows", tags=["Workflows"])


@router.post("/")
def create_workflow(
    workflow: WorkflowCreate,
    db: Session = Depends(get_db),
):

    new_workflow = Workflow(
        id=uuid.uuid4(),
        name=workflow.name,
        status="CREATED",
    )

    db.add(new_workflow)
    db.commit()
    db.refresh(new_workflow)

    return {
        "message": "Workflow created successfully",
        "workflow_id": new_workflow.id,
    }