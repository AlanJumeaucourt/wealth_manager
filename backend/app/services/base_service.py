from dataclasses import dataclass
from typing import Any

from app.database import DatabaseManager
from app.exceptions import NoResultFoundError, QueryExecutionError


@dataclass
class ListQueryParams:
    page: int
    per_page: int
    filters: dict[str, Any]
    sort_by: str | None
    sort_order: str | None
    fields: list[str] | None
    search: str | None = None


class BaseService:
    def __init__(self, table_name: str, model_class: Any) -> None:
        self.db_manager = DatabaseManager()
        self.table_name = table_name
        self.model_class = model_class

    def create(self, data: dict[str, Any]) -> Any | None:
        try:
            columns = ", ".join(data.keys())
            placeholders = ", ".join(["?" for _ in data])
            query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING *"
            result = self.db_manager.execute_insert_returning(
                query, tuple(data.values())
            )
            return self.model_class(**result)
        except Exception as e:
            print(f"Error creating {self.table_name}: {e}")
            return None

    def get_by_id(self, item_id: int, user_id: int) -> Any | None:
        try:
            query = f"SELECT * FROM {self.table_name} WHERE id = ? AND user_id = ?"
            result = self.db_manager.execute_select(query, (item_id, user_id))
            if not result:
                return None
            return self.model_class(**result[0])
        except Exception as e:
            print(f"Error getting {self.table_name}: {e}")
            return None

    def update(self, item_id: int, user_id: int, data: dict[str, Any]) -> Any | None:
        try:
            update_fields = [f"{key} = ?" for key in data]
            query = f"UPDATE {self.table_name} SET {', '.join(update_fields)} WHERE id = ? AND user_id = ? RETURNING *"
            params = [*data.values(), item_id, user_id]
            result = self.db_manager.execute_update_returning(query, params)
            return self.model_class(**result)
        except Exception as e:
            print(f"Error updating {self.table_name}: {e}")
            return None

    def delete(self, item_id: int, user_id: int) -> bool:
        try:
            query = f"DELETE FROM {self.table_name} WHERE id = ? AND user_id = ?"
            self.db_manager.execute_delete(query, (item_id, user_id))
            return True
        except Exception as e:
            print(f"Error deleting {self.table_name}: {e}")
            return False

    def get_all(
        self,
        user_id: int,
        query_params: ListQueryParams,
    ) -> list[dict[str, Any]]:
        try:
            if query_params.fields:
                fields = [
                    field
                    for field in query_params.fields
                    if field in self.model_class.__annotations__
                ]
            else:
                fields = list(self.model_class.__annotations__.keys())

            query = (
                f"SELECT {', '.join(fields)} FROM {self.table_name} WHERE user_id = ?"
            )
            params = [user_id]

            for key, value in query_params.filters.items():
                if value is not None:
                    query += f" AND {key} = ?"
                    params.append(value)

            if query_params.search:
                search = f"%{query_params.search}%"
                query += " AND (description LIKE '" + search + "')"

            if query_params.sort_by and query_params.sort_order:
                query += f" ORDER BY {query_params.sort_by} {query_params.sort_order}"

            query += " LIMIT ? OFFSET ?"
            params.extend(
                [query_params.per_page, (query_params.page - 1) * query_params.per_page]
            )

            try:
                return self.db_manager.execute_select(query, params)
            except NoResultFoundError as e:
                print(f"Error: {e}")
                return []
            except QueryExecutionError as e:
                print(f"Database error: {e}")
                return []
        except Exception as e:
            print(f"Unexpected error: {e}")
            return []
