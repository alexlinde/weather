#!/usr/bin/env python3
"""Dump the FastAPI OpenAPI schema without starting a server.

Imports the app and serialises ``app.openapi()`` to ``openapi.json`` at the repo
root. The mobile app's TS types are generated from this file via
``openapi-typescript`` (see ``packages/shared`` ``gen:types``).

Usage:
    python scripts/gen_openapi.py [output_path]
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Don't trigger S3 seeding on import; we only want the schema.
os.environ.setdefault("DEV_MODE", "1")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from backend.main import app  # noqa: E402

out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "openapi.json"
out.write_text(json.dumps(app.openapi(), indent=2))
print(f"Wrote {out}")
