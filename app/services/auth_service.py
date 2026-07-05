from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.repositories.user_repository import UserRepository


class AuthService:

    def __init__(self, db):
        self.repository = UserRepository(db)

    def register(self, user_data):

        username = (getattr(user_data, 'username', None) or '').strip()
        if not username:
            first_name = (getattr(user_data, 'first_name', None) or '').strip().lower()
            last_name = (getattr(user_data, 'last_name', None) or '').strip().lower()

            if first_name or last_name:
                username = '.'.join(part for part in [first_name, last_name] if part)
            else:
                username = str(user_data.email).split('@')[0]

        existing = self.repository.get_by_email(
            user_data.email
        )

        if existing:
            raise Exception("Email already registered.")

        user = User(
            username=username,
            email=user_data.email,
            password=hash_password(
                user_data.password
            ),
        )

        return self.repository.create(user)

    def login(self, user_data):

        user = self.repository.get_by_email(
            user_data.email
        )

        if user is None:
            raise Exception("Invalid credentials")

        if not verify_password(
            user_data.password,
            user.password,
        ):
            raise Exception("Invalid credentials")

        token = create_access_token(
            {
                "sub": user.email,
            }
        )

        return token
