from __future__ import annotations

import numpy as np


def brownian_bridge_segment(
    start: float,
    end: float,
    steps: int,
    rng: np.random.Generator,
    sigma: np.ndarray | float,
) -> np.ndarray:
    """
    Brownian bridge from start → end over `steps` points (inclusive).
    `sigma` is per-step diffusion scale (scalar or length steps-1).
    """
    if steps < 2:
        return np.array([start], dtype=np.float64)

    if np.isscalar(sigma):
        sig = np.full(steps - 1, float(sigma), dtype=np.float64)
    else:
        sig = np.asarray(sigma, dtype=np.float64)
        if sig.size != steps - 1:
            sig = np.resize(sig, steps - 1)

    noise = rng.standard_normal(steps - 1) * sig
    raw = np.empty(steps, dtype=np.float64)
    raw[0] = start
    for i in range(1, steps):
        raw[i] = raw[i - 1] + noise[i - 1]

    # Bridge correction to hit `end`
    drift = end - raw[-1]
    t = np.linspace(0.0, 1.0, steps, dtype=np.float64)
    path = raw + drift * t
    path[0] = start
    path[-1] = end
    return path


def piecewise_bridge(
    anchors: list[tuple[int, float]],
    n: int,
    rng: np.random.Generator,
    sigma_path: np.ndarray,
    jumps: np.ndarray,
) -> np.ndarray:
    """
    Build a path through ordered (index, price) anchors with local bridges,
    then overlay precomputed jumps with a secondary bridge so endpoints hold.
    """
    anchors = sorted(anchors, key=lambda x: x[0])
    if anchors[0][0] != 0:
        raise ValueError("anchors must include index 0")
    if anchors[-1][0] != n - 1:
        raise ValueError("anchors must include final index")

    path = np.empty(n, dtype=np.float64)
    for (i0, p0), (i1, p1) in zip(anchors, anchors[1:]):
        length = i1 - i0 + 1
        seg_sigma = sigma_path[i0:i1] if i1 > i0 else np.array([0.0])
        seg = brownian_bridge_segment(p0, p1, length, rng, seg_sigma)
        path[i0 : i1 + 1] = seg

    # Overlay jumps then re-bridge to preserve first/last
    jumped = path + jumps
    jumped[0] = path[0]
    correction = path[-1] - jumped[-1]
    t = np.linspace(0.0, 1.0, n, dtype=np.float64)
    jumped = jumped + correction * t
    jumped[0] = path[0]
    jumped[-1] = path[-1]
    return jumped
