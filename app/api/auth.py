from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.schemas.user import UserCreate, UserLogin
from app.services.auth_service import AuthService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post("/register")
def register(
    user: UserCreate,
    db: Session = Depends(get_db),
):

    service = AuthService(db)

    try:

        created = service.register(user)

        return {
            "message": "User registered successfully",
            "user_id": created.id,
            "user": {
                "id": created.id,
                "username": created.username,
                "email": created.email,
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )


@router.post("/login")
def login(
    user: UserLogin,
    db: Session = Depends(get_db),
):

    service = AuthService(db)

    try:

        token = service.login(user)
        authenticated_user = service.repository.get_by_email(user.email)

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": authenticated_user.id if authenticated_user else None,
                "username": authenticated_user.username if authenticated_user else None,
                "email": authenticated_user.email if authenticated_user else user.email,
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=str(e),
        )