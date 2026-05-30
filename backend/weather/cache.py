"""Tiny in-memory TTL cache for weather proxy responses.

Mirrors the original Workers ``withCache`` middleware. Process-local; cleared on
restart. Async-aware so the upstream fetch runs at most once per (key, TTL).
"""

from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")

_store: dict[str, tuple[object, float]] = {}
_locks: dict[str, asyncio.Lock] = {}


def _lock_for(key: str) -> asyncio.Lock:
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    return lock


async def with_cache(
    key: str,
    ttl_seconds: float,
    fetcher: Callable[[], Awaitable[T]],
) -> T:
    """Return a cached value for *key* or call *fetcher* and cache the result."""
    now = time.monotonic()
    entry = _store.get(key)
    if entry is not None and entry[1] > now:
        return entry[0]  # type: ignore[return-value]

    async with _lock_for(key):
        # Re-check after acquiring the lock (another task may have filled it).
        entry = _store.get(key)
        now = time.monotonic()
        if entry is not None and entry[1] > now:
            return entry[0]  # type: ignore[return-value]

        data = await fetcher()
        _store[key] = (data, time.monotonic() + ttl_seconds)
        return data


def clear() -> None:
    _store.clear()
