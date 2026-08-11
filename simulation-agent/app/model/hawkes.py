from __future__ import annotations

import numpy as np


def hawkes_intensities(
    n: int,
    rng: np.random.Generator,
    *,
    mu: float = 0.08,
    alpha: float = 0.55,
    beta: float = 0.25,
) -> np.ndarray:
    """
    Discrete-time Hawkes intensity for jump clustering.
    Higher intensity → larger chance / size of a jump at that minute.
    """
    lam = mu
    out = np.empty(n, dtype=np.float64)
    for i in range(n):
        out[i] = lam
        # Thinning-style event draw
        event = 1.0 if rng.random() < min(0.85, lam) else 0.0
        lam = mu + (lam - mu) * np.exp(-beta) + alpha * event
    return out


def hawkes_jumps(
    n: int,
    rng: np.random.Generator,
    intensities: np.ndarray,
    price_scale: float,
) -> np.ndarray:
    """Signed jump increments scaled by local Hawkes intensity."""
    jumps = np.zeros(n, dtype=np.float64)
    for i in range(n):
        p = min(0.45, float(intensities[i]) * 0.35)
        if rng.random() < p:
            mag = abs(rng.normal(0.0, price_scale * (0.0015 + 0.004 * intensities[i])))
            sign = -1.0 if rng.random() < 0.5 else 1.0
            jumps[i] = sign * mag
    return jumps
