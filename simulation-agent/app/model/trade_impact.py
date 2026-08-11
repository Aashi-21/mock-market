from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.model.constraints import nse_tick_size, round_to_tick


@dataclass(frozen=True)
class TradeImpactEvent:
    """Future hook: user trade temporarily displaces the remaining path."""

    minute_index: int
    side: str  # BUY | SELL
    units: float
    aggressiveness: float = 1.0  # scales temporary impact


def apply_trade_impacts(
    closes: np.ndarray,
    events: list[TradeImpactEvent],
    *,
    low: float,
    high: float,
    open_: float,
    close: float,
    avg_volume: float,
) -> np.ndarray:
    """
    Temporary price impact with exponential decay and mild permanent residue.
    BUY pushes price up; SELL pushes down. Remaining path is shifted, then
    re-pinned to day close and clamped to [low, high].
    """
    if not events:
        return closes

    out = closes.astype(np.float64).copy()
    n = out.size
    mid = max(abs(float(np.median(out))), 1.0)
    base_liquidity = max(avg_volume, 1.0)

    for ev in events:
        i = int(np.clip(ev.minute_index, 0, n - 1))
        direction = 1.0 if ev.side.upper() == "BUY" else -1.0
        # Square-root impact inspired by Almgren / market impact literature
        notional_frac = (ev.units / base_liquidity) * max(ev.aggressiveness, 0.0)
        impact = direction * mid * 0.0015 * np.sqrt(max(notional_frac, 0.0))
        permanent = 0.25 * impact

        for j in range(i, n):
            decay = np.exp(-(j - i) / 12.0)
            out[j] += impact * decay + permanent * ((j - i) / max(n - i, 1))

    out[0] = open_
    # Soft pull last print toward official close (hard pin applied later)
    out[-1] = 0.7 * out[-1] + 0.3 * close
    out = np.clip(out, low, high)
    out[0] = open_
    return out


def estimate_impact_preview(
    last_price: float,
    side: str,
    units: float,
    avg_volume: float,
    aggressiveness: float = 1.0,
) -> float:
    """Stateless helper for API clients exploring impact sizing."""
    direction = 1.0 if side.upper() == "BUY" else -1.0
    notional_frac = (units / max(avg_volume, 1.0)) * aggressiveness
    tick = nse_tick_size(last_price)
    raw = direction * last_price * 0.0015 * np.sqrt(max(notional_frac, 0.0))
    return round_to_tick(last_price + raw) - round_to_tick(last_price)
