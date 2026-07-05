import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.job_dependency import JobDependency
from app.schemas.job_dependency import JobDependencyCreate

router = APIRouter(
    prefix="/job-dependencies",
    tags=["Job Dependencies"]
)


@router.post("/")
def create_dependency(
    dependency: JobDependencyCreate,
    db: Session = Depends(get_db),
):

    new_dependency = JobDependency(
        id=uuid.uuid4(),
        parent_job_id=dependency.parent_job_id,
        child_job_id=dependency.child_job_id,
    )

    db.add(new_dependency)
    db.commit()
    db.refresh(new_dependency)

    return {
        "message": "Dependency created successfully",
        "dependency_id": new_dependency.id,
    }