class SandboxUnavailable(Exception):
    """The code runner can't be used right now (docker down, online provider slow/down/misconfigured).

    The message is shown to students, so it must be friendly and must never contain URLs, keys or tokens.
    Mapped to HTTP 503.
    """


class SandboxRateLimited(Exception):
    """The online provider is rate limiting us. Mapped to HTTP 429 with the same friendly-message rule."""
