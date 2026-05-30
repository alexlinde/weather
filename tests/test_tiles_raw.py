"""Tests for the raw single-channel atlas tile rendering (native DataTexture path)."""

import numpy as np
import scipy.sparse as sp

from backend.tiles import (
    ATLAS_BAND_SIZE,
    ATLAS_NUM_BANDS,
    _compute_atlas_array,
    render_atlas_raw,
)

RAW_LEN = ATLAS_BAND_SIZE * ATLAS_BAND_SIZE * ATLAS_NUM_BANDS  # 256 * 2048


def _conus_grid(dbz: float = 30.0):
    """A small constant-dBZ CONUS grid + metadata for one tilt."""
    ni, nj = 700, 350
    meta = {
        "north": 55.0,
        "south": 20.0,
        "west": -130.0,
        "east": -60.0,
        "Di": 0.1,
        "Dj": 0.1,
        "Ni": ni,
        "Nj": nj,
    }
    dense = np.full((nj, ni), dbz, dtype=np.float32)
    grids = {"00.50": sp.csr_matrix(dense)}
    return grids, meta


def test_raw_length_in_bounds():
    grids, meta = _conus_grid()
    # Tile (z=4, x=3, y=6) overlaps the central CONUS grid.
    raw = render_atlas_raw(grids, meta, 4, 3, 6)
    assert isinstance(raw, (bytes, bytearray))
    assert len(raw) == RAW_LEN
    assert sum(raw) > 0  # constant dBZ → non-empty


def test_raw_length_out_of_bounds_is_empty():
    grids, meta = _conus_grid()
    # Tile (z=4, x=0, y=0) is far NW of the grid → empty.
    raw = render_atlas_raw(grids, meta, 4, 0, 0)
    assert len(raw) == RAW_LEN
    assert sum(raw) == 0


def test_raw_matches_compute_array():
    grids, meta = _conus_grid()
    arr = _compute_atlas_array(grids, meta, 4, 3, 6)
    assert arr is not None
    assert render_atlas_raw(grids, meta, 4, 3, 6) == arr.tobytes()
    # Out-of-bounds tile yields no array and an all-zero raw buffer.
    assert _compute_atlas_array(grids, meta, 4, 0, 0) is None
    assert sum(render_atlas_raw(grids, meta, 4, 0, 0)) == 0
