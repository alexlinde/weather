"""Weather Company (Weather Underground) proxy: current obs, forecast, history.

Ported from the original Hono/Cloudflare-Workers backend. Response shapes mirror
the shared TS contract in ``packages/shared``.
"""

from .routes import router as weather_router

__all__ = ["weather_router"]
