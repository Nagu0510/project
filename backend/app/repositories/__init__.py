"""Thin async data-access functions, one module per collection.

Every function goes through `require_db()`, so an unreachable database surfaces as
DatabaseUnavailable (HTTP 503) instead of being swallowed. Returned documents never contain `_id`.
"""
