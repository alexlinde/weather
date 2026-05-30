"""Pydantic models for the weather proxy.

These mirror ``packages/shared/schemas/weather.schema.ts`` (the shared TS/Zod
contract). They drive FastAPI's OpenAPI document, from which the frontend's TS
types are generated (``pnpm gen:types``).
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Units = Literal["e", "m"]


# ── Current PWS observation ──────────────────────────────────────────────────


class CurrentObservation(BaseModel):
    stationId: str
    neighborhood: Optional[str] = None
    observationTime: str
    lat: float
    lon: float
    # Temperature
    temp: Optional[float] = None
    feelsLike: Optional[float] = None
    dewPoint: Optional[float] = None
    # Humidity & pressure
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    # Precipitation
    precipRate: Optional[float] = None
    precipTotal: Optional[float] = None
    # Wind
    windSpeed: Optional[float] = None
    windDir: Optional[float] = None
    windGust: Optional[float] = None
    # Solar / UV
    uv: Optional[float] = None
    solarRadiation: Optional[float] = None
    units: Units


class CurrentObservationResponse(BaseModel):
    data: CurrentObservation


# ── 5-day forecast ───────────────────────────────────────────────────────────


class ForecastDay(BaseModel):
    dayOfWeek: str
    validDate: str
    # Day period
    dayIcon: Optional[int] = None
    dayPhrase: Optional[str] = None
    dayPrecipChance: Optional[float] = None
    dayTemp: Optional[float] = None
    dayHumidity: Optional[float] = None
    dayWindSpeed: Optional[float] = None
    dayWindDir: Optional[str] = None
    # Night period
    nightIcon: Optional[int] = None
    nightPhrase: Optional[str] = None
    nightPrecipChance: Optional[float] = None
    nightTemp: Optional[float] = None
    nightHumidity: Optional[float] = None
    nightWindSpeed: Optional[float] = None
    nightWindDir: Optional[str] = None
    # Day-level
    tempHigh: Optional[float] = None
    tempLow: Optional[float] = None
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    moonPhase: Optional[str] = None


class ForecastResponse(BaseModel):
    data: list[ForecastDay]


# ── 7-day PWS history ────────────────────────────────────────────────────────


class HistoryDay(BaseModel):
    date: str
    tempHigh: Optional[float] = None
    tempLow: Optional[float] = None
    tempAvg: Optional[float] = None
    precipTotal: Optional[float] = None
    humidityHigh: Optional[float] = None
    humidityLow: Optional[float] = None
    windSpeedAvg: Optional[float] = None
    windSpeedHigh: Optional[float] = None
    pressureMax: Optional[float] = None
    pressureMin: Optional[float] = None


class HistoryResponse(BaseModel):
    data: list[HistoryDay]
