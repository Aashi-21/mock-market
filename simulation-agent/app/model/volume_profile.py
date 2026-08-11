from __future__ import annotations

import numpy as np


def nse_u_shaped_volume_weights(n: int, rng: np.random.Generator) -> np.ndarray:
    """
    NSE-like intraday volume profile: heavy open/close, quieter mid-session,
    with mild stochastic perturbation. Weights sum to 1.
    """
    t = np.linspace(0.0, 1.0, n, dtype=np.float64)
    # Classic U-shape + slight post-open and pre-close bumps
    base = (
        0.55 * np.exp(-((t - 0.02) ** 2) / (2 * 0.018**2))
        + 0.35 * np.exp(-((t - 0.98) ** 2) / (2 * 0.022**2))
        + 0.22
        + 0.08 * np.sin(np.pi * t) ** 2
    )
    noise = 1.0 + 0.08 * rng.standard_normal(n)
    weights = np.clip(base * np.clip(noise, 0.7, 1.3), 1e-6, None)
    weights /= weights.sum()
    return weights
