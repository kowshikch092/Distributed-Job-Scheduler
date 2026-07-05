from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.services.workflow_service import WorkflowService
from app.core.auth import get_current_user

router = APIRouter(
    prefix="/workflow",
    tags=["Workflow Engine"]
)


@router.post("/pdf")
def create_pdf_workflow(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    service = WorkflowService(db)
    workflow_id = service.create_pdf_workflow()

    return {
        "message": "PDF Workflow created successfully",
        "workflow_id": workflow_id
    }