"""Errors the API may show a person. Anything else becomes a generic 500."""


class AppError(Exception):
    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


class NotFound(AppError):
    def __init__(self, message: str = "Not found."):
        super().__init__("not_found", message, 404)


class Conflict(AppError):
    def __init__(self, code: str, message: str):
        super().__init__(code, message, 409)


class ProviderUnavailable(AppError):
    """The provider has no key, timed out, or returned something unusable."""

    def __init__(self, code: str, message: str):
        super().__init__(code, message, 503)
