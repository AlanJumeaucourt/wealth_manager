from dataclasses import dataclass
from typing import Any, Generic, TypeVar, cast

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


T = TypeVar("T")


class BaseService(Generic[T]):
    def __init__(self, table_name: str, model_class: type[T]) -> None:
        self.db_manager = DatabaseManager()
        self.table_name = table_name
        self.model_class = model_class
        self.default_searchable_fields = [
            field
            for field in self.model_class.__annotations__
            if not field.endswith("_id") and field != "id"
        ]

    def create(self, data: dict[str, Any]) -> T | None:
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

    def get_by_id(self, item_id: int, user_id: int) -> T | None:
        try:
            query = f"SELECT * FROM {self.table_name} WHERE id = ? AND user_id = ?"
            result = self.db_manager.execute_select(query, [item_id, user_id])
            if not result:
                return None
            return self.model_class(**result[0])
        except Exception as e:
            print(f"Error getting {self.table_name}: {e}")
            return None

    def update(self, item_id: int, user_id: int, data: dict[str, Any]) -> T | None:
        try:
            update_fields = [f"{key} = ?" for key in data]
            query = f"UPDATE {self.table_name} SET {', '.join(update_fields)} WHERE id = ? AND user_id = ? RETURNING *"  # noqa: S608
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

    def batch_update(self, user_id: int, items: list[dict[str, Any]]) -> dict[str, Any]:
        """Update multiple items in a batch operation using a single SQL query.

        Args:
            user_id: The user ID
            items: List of dictionaries containing item ID and update data
                  Each dict must have an 'id' key and update fields

        Returns:
            Dictionary containing successful and failed updates

        """
        if not items:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        # Extract all fields that need to be updated
        update_fields: set[str] = set()
        for item in items:
            update_fields.update(str(k) for k in item.keys() if k != "id")

        if not update_fields:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        # Build the CASE statements for each field and collect parameters
        case_statements: list[str] = []
        params: list[Any] = []

        for field in update_fields:
            when_clauses: list[str] = []
            for item in items:
                if field in item and "id" in item:
                    when_clauses.append("WHEN id = ? THEN ?")
                    params.extend([item["id"], item[field]])
            if when_clauses:
                case_statements.append(
                    f"{field} = CASE {' '.join(when_clauses)} ELSE {field} END"
                )

        # Get list of item IDs for the IN clause
        item_ids = [item["id"] for item in items if "id" in item]
        if not item_ids:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        # Build the final query with parameterized values
        query = f"""
            WITH updated AS (
                UPDATE {self.table_name}
                SET {", ".join(case_statements)}
                WHERE id IN ({",".join("?" for _ in item_ids)})
                AND user_id = ?
                RETURNING *
            )
            SELECT * FROM updated;
        """

        # Add parameters for IN clause and user_id
        params.extend(item_ids)
        params.append(user_id)

        try:
            results = self.db_manager.execute_select(query, params)
            successful = [self.model_class(**result) for result in results]
            updated_ids = {cast(int, result["id"]) for result in results}

            # Identify failed updates
            failed = [
                {"id": item["id"], "error": "Update failed", "data": item}
                for item in items
                if "id" in item and item["id"] not in updated_ids
            ]

            return {
                "successful": successful,
                "failed": failed,
                "total_successful": len(successful),
                "total_failed": len(failed),
            }
        except Exception as e:
            return {
                "successful": [],
                "failed": [
                    {"id": item.get("id"), "error": str(e), "data": item}
                    for item in items
                ],
                "total_successful": 0,
                "total_failed": len(items),
            }

    def batch_delete(self, user_id: int, item_ids: list[int]) -> dict[str, Any]:
        """Delete multiple items in a batch operation using a single SQL query.

        Args:
            user_id: The user ID
            item_ids: List of item IDs to delete

        Returns:
            Dictionary containing successful and failed deletions

        """
        if not item_ids:
            return {
                "successful": [],
                "failed": [],
                "total_successful": 0,
                "total_failed": 0,
            }

        try:
            # First, verify which IDs exist and belong to the user
            placeholders = ",".join("?" for _ in item_ids)
            verify_query = f"""
                SELECT id
                FROM {self.table_name}
                WHERE id IN ({placeholders})
                AND user_id = ?
            """
            verify_params: list[Any] = [*item_ids, user_id]

            # Get the IDs that exist and belong to the user
            results = self.db_manager.execute_select(verify_query, verify_params)
            existing_ids = [cast(int, result["id"]) for result in results]

            if not existing_ids:
                return {
                    "successful": [],
                    "failed": [
                        {"id": id_, "error": "Not found or unauthorized"}
                        for id_ in item_ids
                    ],
                    "total_successful": 0,
                    "total_failed": len(item_ids),
                }

            # Now delete the verified IDs
            delete_placeholders = ",".join("?" for _ in existing_ids)
            delete_query = f"""
                DELETE FROM {self.table_name}
                WHERE id IN ({delete_placeholders})
                AND user_id = ?
            """
            delete_params: list[Any] = [*existing_ids, user_id]

            self.db_manager.execute_delete(delete_query, delete_params)

            # Calculate failed deletions (IDs that weren't found or weren't owned by the user)
            failed_ids = [id_ for id_ in item_ids if id_ not in existing_ids]

            return {
                "successful": existing_ids,
                "failed": [
                    {"id": id_, "error": "Not found or unauthorized"}
                    for id_ in failed_ids
                ],
                "total_successful": len(existing_ids),
                "total_failed": len(failed_ids),
            }
        except Exception as e:
            return {
                "successful": [],
                "failed": [{"id": id_, "error": str(e)} for id_ in item_ids],
                "total_successful": 0,
                "total_failed": len(item_ids),
            }

    def _get_valid_fields(self, requested_fields: list[str] | None) -> list[str]:
        valid_fields = [
            field
            for field in self.model_class.__annotations__.keys()
            if field != "user_id"
        ]
        if requested_fields:
            invalid_fields = [
                field for field in requested_fields if field not in valid_fields
            ]
            if invalid_fields:
                raise ValueError(
                    f"Invalid fields requested: {', '.join(invalid_fields)}"
                )
            return [field for field in requested_fields if field in valid_fields]
        return valid_fields

    def _validate_sort_field(self, sort_by: str | None) -> None:
        if sort_by and sort_by not in self.model_class.__annotations__:
            raise ValueError(f"Invalid sort field: {sort_by}")

    def _validate_filter_fields(self, filters: dict[str, Any]) -> None:
        # Get valid fields from the model
        valid_fields = self.model_class.__annotations__.keys()

        # Get custom allowed filters for specific services
        custom_allowed_filters = getattr(self, "custom_allowed_filters", [])

        # Combine model fields and custom allowed filters
        all_valid_fields = set(valid_fields) | set(custom_allowed_filters)

        # Check for invalid fields
        invalid_fields = [key for key in filters if key not in all_valid_fields]
        if invalid_fields:
            print(f"Invalid filter fields: {', '.join(invalid_fields)}")
            raise ValueError(f"Invalid filter fields: {', '.join(invalid_fields)}")

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
            # Validate fields before proceeding
            fields = self._get_valid_fields(query_params.fields)
            self._validate_sort_field(query_params.sort_by)
            self._validate_filter_fields(query_params.filters)

            # Build count query
            count_query = (
                f"SELECT COUNT(*) as total FROM {self.table_name} WHERE user_id = ?"  # noqa: S608
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
                f"SELECT {', '.join(fields)} FROM {self.table_name} WHERE user_id = ?"  # noqa: S608
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

            total_count = self.db_manager.execute_select(count_query, count_params)[0][
                "total"
            ]
            items = self.db_manager.execute_select(query, params)
            return {
                "items": items,
                "total": total_count,
                "page": query_params.page,
                "per_page": query_params.per_page,
            }
        except ValueError as e:
            raise ValueError(str(e)) from e
        except NoResultFoundError:
            return {
                "items": [],
                "total": 0,
                "page": query_params.page,
                "per_page": query_params.per_page,
            }
        except Exception as e:
            raise QueryExecutionError(
                f"Database error: {e!s}", query=query, params=params
            ) from e
