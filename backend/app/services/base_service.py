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
    search_fields: list[str] | None = None


class BaseService:
    def __init__(self, table_name: str, model_class: Any) -> None:
        self.db_manager = DatabaseManager()
        self.table_name = table_name
        self.model_class = model_class
        self.default_searchable_fields = [
            field
            for field in self.model_class.__annotations__
            if not field.endswith("_id") and field != "id"
        ]

    def create(self, data: dict[str, Any]) -> Any | None:
        try:
            columns = ", ".join(data.keys())
            placeholders = ", ".join(["?" for _ in data])
            query = f"INSERT INTO {self.table_name} ({columns}) VALUES ({placeholders}) RETURNING *"
            result = self.db_manager.execute_insert_returning(
                query, list(data.values())
            )
            return self.model_class(**result)
        except Exception as e:
            print(f"Error creating {self.table_name}: {e}")
            return None

    def get_by_id(self, item_id: int, user_id: int) -> Any | None:
        try:
            query = f"SELECT * FROM {self.table_name} WHERE id = ? AND user_id = ?"
            result = self.db_manager.execute_select(query, [item_id, user_id])
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
            self.db_manager.execute_delete(query, [item_id, user_id])
            return True
        except Exception as e:
            print(f"Error deleting {self.table_name}: {e}")
            return False

    def _get_valid_fields(self, requested_fields: list[str] | None) -> list[str]:
        if requested_fields:
            return [
                field
                for field in requested_fields
                if field in self.model_class.__annotations__
            ]
        return list(self.model_class.__annotations__.keys())

    def _build_filter_conditions(
        self, query: str, params: list[Any], filters: dict[str, Any]
    ) -> tuple[str, list[Any]]:
        for key, value in filters.items():
            if value is not None:
                if isinstance(value, str) and "," in value:
                    values = [v.strip() for v in value.split(",")]
                    placeholders = ",".join(["?" for _ in values])
                    query += f" AND {key} IN ({placeholders})"
                    params.extend(values)
                else:
                    query += f" AND {key} = ?"
                    params.append(value)
        return query, params

    def _build_search_conditions(
        self,
        query: str,
        params: list[Any],
        search: str | None,
        search_fields: list[str] | None,
    ) -> tuple[str, list[Any]]:
        if not search:
            return query, params

        search_value = f"%{search}%"
        search_conditions = []

        valid_fields = [
            field
            for field in (search_fields or self.default_searchable_fields)
            if field in self.model_class.__annotations__
        ]

        for field in valid_fields:
            search_conditions.append(f"{field} LIKE ?")
            params.append(search_value)

        if search_conditions:
            query += f" AND ({' OR '.join(search_conditions)})"

        return query, params

    def _build_pagination(
        self, query: str, params: list[Any], page: int, per_page: int
    ) -> tuple[str, list[Any]]:
        query += " LIMIT ? OFFSET ?"
        params.extend([per_page, (page - 1) * per_page])
        return query, params

    def get_all(
        self,
        user_id: int,
        query_params: ListQueryParams,
    ) -> dict[str, Any]:
        try:
            fields = self._get_valid_fields(query_params.fields)

            # Build count query
            count_query = (
                f"SELECT COUNT(*) as total FROM {self.table_name} WHERE user_id = ?"
            )
            count_params = [user_id]

            count_query, count_params = self._build_filter_conditions(
                count_query, count_params, query_params.filters
            )
            count_query, count_params = self._build_search_conditions(
                count_query,
                count_params,
                query_params.search,
                query_params.search_fields,
            )

            # Build items query
            query = (
                f"SELECT {', '.join(fields)} FROM {self.table_name} WHERE user_id = ?"
            )
            params: list[Any] = [user_id]

            query, params = self._build_filter_conditions(
                query, params, query_params.filters
            )
            query, params = self._build_search_conditions(
                query, params, query_params.search, query_params.search_fields
            )

            if query_params.sort_by and query_params.sort_order:
                query += f" ORDER BY {query_params.sort_by} {query_params.sort_order}"

            query, params = self._build_pagination(
                query, params, query_params.page, query_params.per_page
            )

            try:
                total_count = self.db_manager.execute_select(count_query, count_params)[
                    0
                ]["total"]
                items = self.db_manager.execute_select(query, params)
                return {
                    "items": items,
                    "total": total_count,
                    "page": query_params.page,
                    "per_page": query_params.per_page,
                }
            except (NoResultFoundError, QueryExecutionError) as e:
                print(f"Database error: {e}")
                return {
                    "items": [],
                    "total": 0,
                    "page": query_params.page,
                    "per_page": query_params.per_page,
                }
        except Exception as e:
            print(f"Unexpected error: {e}")
            return {
                "items": [],
                "total": 0,
                "page": query_params.page,
                "per_page": query_params.per_page,
            }
