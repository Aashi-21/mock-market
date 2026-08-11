from __future__ import annotations

import numpy as np


def simulate_log_variance(
    n: int,
    rng: np.random.Generator,
    *,
    mean_var: float,
    kappa: float = 4.0,
    vol_of_vol: float = 0.55,
) -> np.ndarray:
    """
    Mean-reverting log-variance path (OU on log σ²), similar spirit to Heston/SV.
    Returns per-step instantaneous variance levels (positive).
    """
    mean_var = max(mean_var, 1e-12)
    log_v = np.log(mean_var)
    path = np.empty(n, dtype=np.float64)
    for i in range(n):
        shock = vol_of_vol * rng.standard_normal()
        log_v += kappa * (np.log(mean_var) - log_v) / n + shock / np.sqrt(n)
        path[i] = float(np.exp(log_v))
    return path
