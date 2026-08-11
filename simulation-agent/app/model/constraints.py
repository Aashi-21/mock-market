from __future__ import annotations

import numpy as np


def nse_tick_size(price: float) -> float:
    """Approximate NSE equity tick size by price band."""
    if price < 100:
        return 0.05
    if price < 1000:
        return 0.05
    return 0.10


def round_to_tick(price: float) -> float:
    tick = nse_tick_size(price)
    return round(round(price / tick) * tick, 2)


def enforce_hard_ohlc(
    path: np.ndarray,
    *,
    open_: float,
    high: float,
    low: float,
    close: float,
    high_idx: int,
    low_idx: int,
) -> np.ndarray:
    """
    Hard-enforce day OHLC on a minute close path:
    - pin open/close
    - force exact high/low at designated indices
    - clamp all prints into [low, high]
    """
    out = path.astype(np.float64).copy()
    n = out.size
    out[0] = open_
    out[-1] = close
    out[high_idx] = high
    out[low_idx] = low

    # Clamp interior, then restore anchors
    out = np.clip(out, low, high)
    out[0] = open_
    out[-1] = close
    out[high_idx] = high
    out[low_idx] = low

    # Smooth tiny violations from clamp by local linear blends near anchors
    for idx, target in ((0, open_), (n - 1, close), (high_idx, high), (low_idx, low)):
        out[idx] = target

    return out


def soft_vwap_nudge(
    path: np.ndarray,
    volumes: np.ndarray,
    target_vwap: float,
    *,
    softness: float,
    low: float,
    high: float,
    open_: float,
    close: float,
    high_idx: int,
    low_idx: int,
) -> np.ndarray:
    """
    Gently shift the path so volume-weighted average moves toward target VWAP.
    Softness in [0,1]: 0 = ignore VWAP, 1 = full correction (still respects OHLC pins).
    """
    softness = float(np.clip(softness, 0.0, 1.0))
    if softness <= 0 or target_vwap <= 0:
        return path

    vols = np.asarray(volumes, dtype=np.float64)
    vols = vols / vols.sum()
    current = float(np.dot(path, vols))
    gap = target_vwap - current
    nudged = path + softness * gap

    # Re-apply hard pins / bounds
    return enforce_hard_ohlc(
        nudged,
        open_=open_,
        high=high,
        low=low,
        close=close,
        high_idx=high_idx,
        low_idx=low_idx,
    )


def path_to_minute_ohlc(
    closes: np.ndarray,
    volumes: np.ndarray,
    *,
    day_open: float,
    day_high: float,
    day_low: float,
    day_close: float,
) -> list[dict[str, float | int]]:
    """
    Expand a minute-close path into minute OHLC bars.
    Minute open = previous close (first = day open). High/low span the step.
    """
    bars: list[dict[str, float | int]] = []
    prev = day_open
    n = closes.size
    for i in range(n):
        c = float(closes[i])
        o = float(prev) if i > 0 else day_open
        # Intrabar excursion: small fraction of day range, deterministic from step
        step = abs(c - o)
        pad = max(step * 0.15, (day_high - day_low) * 0.0008)
        hi = max(o, c) + pad * 0.5
        lo = min(o, c) - pad * 0.5
        hi = min(hi, day_high)
        lo = max(lo, day_low)
        if i == 0:
            o = day_open
        if i == n - 1:
            c = day_close
        # Ensure high/low of day appear in some minute bar
        bars.append(
            {
                "minute_index": i,
                "open": round_to_tick(o),
                "high": round_to_tick(hi),
                "low": round_to_tick(lo),
                "close": round_to_tick(c),
                "volume": float(volumes[i]),
            }
        )
        prev = c

    # Guarantee day high/low are attained in minute highs/lows
    close_arr = np.array([b["close"] for b in bars], dtype=np.float64)
    high_i = int(np.argmax(close_arr))
    low_i = int(np.argmin(close_arr))
    bars[high_i]["high"] = round_to_tick(day_high)
    bars[low_i]["low"] = round_to_tick(day_low)
    bars[0]["open"] = round_to_tick(day_open)
    bars[-1]["close"] = round_to_tick(day_close)
    return bars
