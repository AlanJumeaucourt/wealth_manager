from typing import Any


class DatabaseError(Exception):
    """Base class for database-related exceptions."""


class QueryExecutionError(DatabaseError):
    """Raised when a query execution fails."""

    def __init__(self, message: str, query: str, params: list[Any]) -> None:
        super().__init__(message)
        self.message = message
        self.query = query
        self.params = params

    def __str__(self) -> str:
        return f"{self.message}\nQuery: {self.query}\nParams: {self.params}"


class NoResultFoundError(DatabaseError):
    """Raised when a query returns no results."""

    def __init__(self, message: str, query: str, params: list[Any]) -> None:
        super().__init__(message)
        self.message = message
        self.query = query
        self.params = params

    def __str__(self) -> str:
        return f"{self.message}\nQuery: {self.query}\nParams: {self.params}"


class DuplicateUserError(Exception):
    pass


class TransactionValidationError(Exception):
    """Raised when a transaction fails validation."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

    def __str__(self) -> str:
        return self.message
