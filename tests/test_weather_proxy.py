"""Tests for the ported Weather Company proxy (reshaping + cache)."""

import asyncio

from backend.weather import cache
from backend.weather.service import _reshape_forecast
from backend.weather.schemas import ForecastDay


def test_reshape_forecast_basic():
    raw = {
        "dayOfWeek": ["Monday", "Tuesday"],
        "validTimeLocal": ["2026-05-30T07:00:00-0700", "2026-05-31T07:00:00-0700"],
        "calendarDayTemperatureMax": [80, 82],
        "calendarDayTemperatureMin": [55, 57],
        "sunriseTimeLocal": ["2026-05-30T05:40:00-0700", "2026-05-31T05:39:00-0700"],
        "sunsetTimeLocal": ["2026-05-30T20:10:00-0700", "2026-05-31T20:11:00-0700"],
        "moonPhase": ["Waxing", "Full"],
        "daypart": [
            {
                "iconCode": [30, 31, 32, 33],
                "wxPhraseLong": ["Sunny", "Clear", "Partly Cloudy", "Cloudy"],
                "precipChance": [10, 0, 20, 30],
                "temperature": [80, 55, 82, 57],
                "relativeHumidity": [40, 60, 42, 58],
                "windSpeed": [5, 3, 6, 4],
                "windDirectionCardinal": ["NW", "N", "W", "SW"],
            }
        ],
    }
    days = _reshape_forecast(raw)
    assert len(days) == 2
    assert all(isinstance(d, ForecastDay) for d in days)
    d0 = days[0]
    assert d0.dayOfWeek == "Monday"
    assert d0.validDate == "2026-05-30"
    assert d0.dayIcon == 30
    assert d0.nightIcon == 31
    assert d0.dayTemp == 80
    assert d0.nightTemp == 55
    assert d0.tempHigh == 80
    assert d0.tempLow == 55
    assert d0.dayWindDir == "NW"
    # Second day reads daypart offsets 2 (day) and 3 (night).
    assert days[1].dayIcon == 32
    assert days[1].nightIcon == 33


def test_reshape_forecast_empty():
    assert _reshape_forecast({}) == []


def test_with_cache_dedups_and_expires():
    cache.clear()
    calls = {"n": 0}

    async def fetcher():
        calls["n"] += 1
        return calls["n"]

    async def run():
        # Same key within TTL → fetched once (deduped).
        a = await cache.with_cache("k", 60, fetcher)
        b = await cache.with_cache("k", 60, fetcher)
        assert a == b == 1
        assert calls["n"] == 1
        # A key cached with an already-expired TTL refetches every time.
        c = await cache.with_cache("k2", -1, fetcher)
        d = await cache.with_cache("k2", -1, fetcher)
        assert c == 2 and d == 3

    asyncio.run(run())
    cache.clear()
