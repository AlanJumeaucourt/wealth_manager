from datetime import UTC, datetime

from app.database import DatabaseManager
from app.exceptions import DuplicateUserError, NoResultFoundError, QueryExecutionError
from app.models import User

db_manager = DatabaseManager()


def create_user(name: str, email: str, password: str) -> User | None:
    try:
        user = db_manager.execute_insert_returning(
            query="INSERT INTO users (name, email, password, last_login) VALUES (?, ?, ?, ?) RETURNING *",
            params=(name, email, password, datetime.now(UTC)),
        )
        return User(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            password=user["password"],
            last_login=user["last_login"],
        )
    except QueryExecutionError as e:
        if "UNIQUE constraint failed: users.email" in str(e):
            raise DuplicateUserError("A user with this email already exists.")
        print(f"Database error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None


def get_user_by_id(user_id: int) -> User | None:
    try:
        result = db_manager.execute_select(
            query="SELECT * FROM users WHERE id = ?",
            params=[user_id],
        )
        if not result:
            raise NoResultFoundError(
                message="No user found with the given ID.",
                query="SELECT * FROM users WHERE id = ?",
                params=[user_id],
            )

        user_data = result[0]
        return User(
            id=user_data["id"],
            name=user_data["name"],
            email=user_data["email"],
            password=user_data["password"],
            last_login=user_data["last_login"],
        )
    except NoResultFoundError as e:
        print(f"Error: {e}")
        return None
    except QueryExecutionError as e:
        print(f"Database error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None


def update_user(
    user_id: int,
    name: str | None = None,
    email: str | None = None,
    password: str | None = None,
) -> User | None:
    try:
        update_fields: list[str] = []
        params: list[str | int] = []

        if name:
            update_fields.append("name = ?")
            params.append(name)
        if email:
            update_fields.append("email = ?")
            params.append(email)
        if password:
            update_fields.append("password = ?")
            params.append(password)

        if not update_fields:
            return None

        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ? RETURNING *"
        params.extend([user_id])
        user = db_manager.execute_update_returning(query=query, params=params)
        return User(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            password=user["password"],
            last_login=user["last_login"],
        )
    except Exception as e:
        print(f"Error updating user: {e}")
        return None


def delete_user(user_id: int) -> bool:
    try:
        db_manager.execute_delete("DELETE FROM users WHERE id = ?", [user_id])
        return True
    except Exception as e:
        print(f"Error deleting user: {e}")
        return False


def authenticate_user(email: str, password: str) -> User | None:
    try:
        result = db_manager.execute_select(
            query="SELECT * FROM users WHERE email = ? AND password = ?",
            params=[email, password],
        )
        if not result:
            raise NoResultFoundError(
                message="No user found with the given email and password.",
                query="SELECT * FROM users WHERE email = ? AND password = ?",
                params=[email, password],
            )

        user_data = result[0]
        return User(
            id=user_data["id"],
            name=user_data["name"],
            email=user_data["email"],
            password=user_data["password"],
            last_login=user_data["last_login"],
        )
    except NoResultFoundError as e:
        print(f"Error: {e}")
        return None
    except QueryExecutionError as e:
        print(f"Database error: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error: {e}")
        return None


def update_last_login(user_id: int, login_time: datetime) -> bool:
    try:
        user = db_manager.execute_update(
            query="UPDATE users SET last_login = ? WHERE id = ?",
            params=[login_time, user_id],
        )
        if user:
            return True
        return False
    except Exception as e:
        print(f"Error updating last login: {e}")
        return False
