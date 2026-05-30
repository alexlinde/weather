"""Weather Company / Weather Underground upstream client + reshaping.

Port of the original ``weather.service.ts``. Flattens TWC's unit-specific
sub-objects (imperial/metric) into the flat shapes defined in ``schemas.py``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from .schemas import CurrentObservation, ForecastDay, HistoryDay, Units

BASE_URL = "https://api.weather.com"

_UNIT_KEY_MAP: dict[str, str] = {"e": "imperial", "m": "metric"}

# Shared client (connection pooling). gzip is requested for the large payloads.
_client = httpx.AsyncClient(
    timeout=httpx.Timeout(15.0),
    headers={"Accept-Encoding": "gzip"},
)


class WeatherAPIError(Exception):
    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.status_code = status_code


async def _weather_fetch(url: str, params: dict[str, str]) -> Any:
    try:
        res = await _client.get(url, params=params)
    except httpx.HTTPError as exc:  # network/timeout
        raise WeatherAPIError(f"Upstream request failed: {exc}", 502) from exc

    if res.status_code >= 400:
        body = res.text[:200] if res.text else ""
        raise WeatherAPIError(
            f"HTTP {res.status_code} from Weather API: {body}", res.status_code
        )
    return res.json()


# ── Current PWS observations ─────────────────────────────────────────────────


async def fetch_current_pws(
    station_id: str, units: Units, api_key: str
) -> CurrentObservation:
    data = await _weather_fetch(
        f"{BASE_URL}/v2/pws/observations/current",
        {"stationId": station_id, "format": "json", "units": units, "apiKey": api_key},
    )

    observations = data.get("observations") if isinstance(data, dict) else None
    if not observations:
        raise WeatherAPIError(
            f"No current observations for PWS {station_id}.", 404
        )

    obs: dict[str, Any] = dict(observations[0])
    unit_key = _UNIT_KEY_MAP[units]
    unit_data = obs.get(unit_key) or {}

    # Drop all unit sub-objects, then merge the relevant one flat.
    for key in _UNIT_KEY_MAP.values():
        obs.pop(key, None)
    flat: dict[str, Any] = {**obs, **unit_data}

    feels_like = flat.get("heatIndex")
    if feels_like is None:
        feels_like = flat.get("windChill")

    return CurrentObservation(
        stationId=flat.get("stationID") or station_id,
        neighborhood=flat.get("neighborhood"),
        observationTime=flat.get("obsTimeLocal")
        or datetime.now(timezone.utc).isoformat(),
        lat=flat.get("lat"),
        lon=flat.get("lon"),
        temp=flat.get("temp"),
        feelsLike=feels_like,
        dewPoint=flat.get("dewpt"),
        humidity=flat.get("humidity"),
        pressure=flat.get("pressure"),
        precipRate=flat.get("precipRate"),
        precipTotal=flat.get("precipTotal"),
        windSpeed=flat.get("windSpeed"),
        windDir=flat.get("winddir"),
        windGust=flat.get("windGust"),
        uv=flat.get("uv"),
        solarRadiation=flat.get("solarRadiation"),
        units=units,
    )


# ── 5-day forecast ───────────────────────────────────────────────────────────


async def fetch_forecast(
    lat: float, lon: float, units: Units, api_key: str
) -> list[ForecastDay]:
    raw = await _weather_fetch(
        f"{BASE_URL}/v3/wx/forecast/daily/5day",
        {
            "geocode": f"{lat},{lon}",
            "format": "json",
            "units": units,
            "language": "en-US",
            "apiKey": api_key,
        },
    )
    return _reshape_forecast(raw if isinstance(raw, dict) else {})


def _reshape_forecast(raw: dict[str, Any]) -> list[ForecastDay]:
    day_of_week = raw.get("dayOfWeek") or []
    num_days = len(day_of_week)
    if num_days == 0:
        return []

    # daypart is a single-element array in the TWC response.
    daypart_raw = raw.get("daypart")
    if isinstance(daypart_raw, list):
        daypart = daypart_raw[0] if daypart_raw else {}
    else:
        daypart = daypart_raw or {}

    def get(field: str, i: int) -> Any:
        arr = raw.get(field)
        return arr[i] if isinstance(arr, list) and i < len(arr) else None

    def get_dp(field: str, offset: int) -> Any:
        arr = daypart.get(field) if isinstance(daypart, dict) else None
        return arr[offset] if isinstance(arr, list) and offset < len(arr) else None

    days: list[ForecastDay] = []
    for i in range(num_days):
        day_idx = 2 * i
        night_idx = 2 * i + 1
        valid = get("validTimeLocal", i) or ""
        days.append(
            ForecastDay(
                dayOfWeek=get("dayOfWeek", i) or "",
                validDate=valid[:10],
                dayIcon=get_dp("iconCode", day_idx),
                dayPhrase=get_dp("wxPhraseLong", day_idx),
                dayPrecipChance=get_dp("precipChance", day_idx),
                dayTemp=get_dp("temperature", day_idx),
                dayHumidity=get_dp("relativeHumidity", day_idx),
                dayWindSpeed=get_dp("windSpeed", day_idx),
                dayWindDir=get_dp("windDirectionCardinal", day_idx),
                nightIcon=get_dp("iconCode", night_idx),
                nightPhrase=get_dp("wxPhraseLong", night_idx),
                nightPrecipChance=get_dp("precipChance", night_idx),
                nightTemp=get_dp("temperature", night_idx),
                nightHumidity=get_dp("relativeHumidity", night_idx),
                nightWindSpeed=get_dp("windSpeed", night_idx),
                nightWindDir=get_dp("windDirectionCardinal", night_idx),
                tempHigh=get("calendarDayTemperatureMax", i),
                tempLow=get("calendarDayTemperatureMin", i),
                sunrise=get("sunriseTimeLocal", i),
                sunset=get("sunsetTimeLocal", i),
                moonPhase=get("moonPhase", i),
            )
        )
    return days


# ── 7-day PWS history ────────────────────────────────────────────────────────


async def fetch_history(
    station_id: str, units: Units, api_key: str
) -> list[HistoryDay]:
    data = await _weather_fetch(
        f"{BASE_URL}/v2/pws/dailysummary/7day",
        {"stationId": station_id, "format": "json", "units": units, "apiKey": api_key},
    )

    summaries = data.get("summaries") or [] if isinstance(data, dict) else []
    unit_key = _UNIT_KEY_MAP[units]

    out: list[HistoryDay] = []
    for s in summaries:
        obs: dict[str, Any] = dict(s)
        unit_data = obs.get(unit_key) or {}
        for key in _UNIT_KEY_MAP.values():
            obs.pop(key, None)
        flat: dict[str, Any] = {**obs, **unit_data}

        date = ""
        obs_local = flat.get("obsTimeLocal")
        if isinstance(obs_local, str) and obs_local:
            date = obs_local[:10]
        elif flat.get("epoch"):
            date = (
                datetime.fromtimestamp(flat["epoch"], tz=timezone.utc)
                .isoformat()[:10]
            )

        out.append(
            HistoryDay(
                date=date,
                tempHigh=flat.get("tempHigh"),
                tempLow=flat.get("tempLow"),
                tempAvg=flat.get("tempAvg"),
                precipTotal=flat.get("precipTotal"),
                humidityHigh=flat.get("humidityHigh"),
                humidityLow=flat.get("humidityLow"),
                windSpeedAvg=flat.get("windspeedAvg"),
                windSpeedHigh=flat.get("windspeedHigh"),
                pressureMax=flat.get("pressureMax"),
                pressureMin=flat.get("pressureMin"),
            )
        )
    return out
