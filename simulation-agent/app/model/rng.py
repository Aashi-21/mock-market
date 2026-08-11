from __future__ import annotations

import numpy as np


def make_rng(seed: int) -> np.random.Generator:
    """Deterministic NumPy Generator from an integer seed."""
    return np.random.default_rng(int(seed) & 0xFFFFFFFFFFFFFFFF)


def derive_seed(*parts: int | str) -> int:
    """Stable 32-bit seed from mixed parts (stock id, date, base seed)."""
    h = 2166136261
    for part in parts:
        text = str(part)
        for ch in text:
            h ^= ord(ch)
            h = (h * 16777619) & 0xFFFFFFFF
    return int(h)
