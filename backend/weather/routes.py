"""FastAPI routes for the weather proxy: /api/weather/{current,forecast,history}."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Query

from . import cache, service
from .schemas import (
    CurrentObservationResponse,
    ForecastResponse,
    HistoryResponse,
    Units,
)

router = APIRouter(prefix="/api/weather", tags=["weather"])


def _api_key() -> str:
    key = os.getenv("WU_API_KEY", "")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="WU_API_KEY is not configured on the server.",
        )
    return key


@router.get("/current", response_model=CurrentObservationResponse)
async def current(
    stationId: str = Query(..., min_length=1),
    units: Units = "e",
) -> CurrentObservationResponse:
    api_key = _api_key()
    key = f"current:{stationId}:{units}"
    try:
        data = await cache.with_cache(
            key, 300, lambda: service.fetch_current_pws(stationId, units, api_key)
        )
    except service.WeatherAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return CurrentObservationResponse(data=data)


@router.get("/forecast", response_model=ForecastResponse)
async def forecast(
    lat: float = Query(...),
    lon: float = Query(...),
    units: Units = "e",
) -> ForecastResponse:
    api_key = _api_key()
    key = f"forecast:{lat:.2f}:{lon:.2f}:{units}"
    try:
        data = await cache.with_cache(
            key, 1800, lambda: service.fetch_forecast(lat, lon, units, api_key)
        )
    except service.WeatherAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return ForecastResponse(data=data)


@router.get("/history", response_model=HistoryResponse)
async def history(
    stationId: str = Query(..., min_length=1),
    units: Units = "e",
) -> HistoryResponse:
    api_key = _api_key()
    key = f"history:{stationId}:{units}"
    try:
        data = await cache.with_cache(
            key, 1800, lambda: service.fetch_history(stationId, units, api_key)
        )
    except service.WeatherAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return HistoryResponse(data=data)
