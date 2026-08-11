from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.data.loader import DayBarRecord
from app.model.brownian_bridge import piecewise_bridge
from app.model.constraints import (
    enforce_hard_ohlc,
    path_to_minute_ohlc,
    round_to_tick,
    soft_vwap_nudge,
)
from app.model.empirical import (
    EmpiricalPriors,
    deliverable_jump_scale,
    deliverable_vwap_boost,
    estimate_priors,
    hawkes_params_from_activity,
)
from app.model.hawkes import hawkes_intensities, hawkes_jumps
from app.model.rng import derive_seed, make_rng
from app.model.session import MINUTES_PER_DAY, SessionClock
from app.model.stochastic_vol import simulate_log_variance
from app.model.trade_impact import TradeImpactEvent, apply_trade_impacts
from app.model.volume_profile import nse_u_shaped_volume_weights


@dataclass(frozen=True)
class SimulationResult:
    stock_id: str
    date: str
    seed: int
    day: DayBarRecord
    realized_vwap: float
    target_vwap: float
    minute_bars: list[dict]
    closes: list[float]
    volumes: list[float]
    time_labels: list[str]
    liquidity: dict


def _validate_day(day: DayBarRecord) -> None:
    if day.high < max(day.open, day.close, day.low):
        raise ValueError("Invalid day bar: high must be >= open, close, and low")
    if day.low > min(day.open, day.close, day.high):
        raise ValueError("Invalid day bar: low must be <= open, close, and high")
    if day.high < day.low:
        raise ValueError("Invalid day bar: high < low")


def _choose_extreme_times(
    rng: np.random.Generator,
    n: int,
    open_: float,
    high: float,
    low: float,
    close: float,
) -> tuple[int, int]:
    """Pick distinct interior indices for day high and day low."""
    candidates = list(range(1, n - 1))
    rng.shuffle(candidates)

    if close >= open_:
        high_bias = [i for i in candidates if i >= n // 3]
        low_bias = [i for i in candidates if i <= 2 * n // 3]
    else:
        high_bias = [i for i in candidates if i <= 2 * n // 3]
        low_bias = [i for i in candidates if i >= n // 3]

    high_idx = int(rng.choice(high_bias or candidates))
    low_pool = [i for i in (low_bias or candidates) if i != high_idx]
    if not low_pool:
        low_pool = [i for i in candidates if i != high_idx]
    low_idx = int(rng.choice(low_pool))
    return high_idx, low_idx


def _build_anchors(
    n: int,
    open_: float,
    high: float,
    low: float,
    close: float,
    high_idx: int,
    low_idx: int,
) -> list[tuple[int, float]]:
    points = {
        0: open_,
        high_idx: high,
        low_idx: low,
        n - 1: close,
    }
    return sorted(points.items(), key=lambda x: x[0])


def simulate_day(
    day: DayBarRecord,
    *,
    history: list[DayBarRecord] | None = None,
    seed: int = 42,
    vwap_softness: float = 0.35,
    trade_impacts: list[TradeImpactEvent] | None = None,
    total_day_volume: float | None = None,
) -> SimulationResult:
    """
    Full-day minute simulation with:
    - piecewise Brownian bridges through OHLC anchors (HARD open/high/low/close)
    - stochastic volatility diffusion scales
    - Hawkes-clustered jumps (calibrated from Trades / Volume)
    - soft VWAP targeting via U-shaped volume weights scaled to day Volume
    - %Deliverable modulates jump size and VWAP softness
    - optional trade-impact overlays for future user-flow modelling
    """
    _validate_day(day)
    clock = SessionClock()
    n = clock.minutes_per_day
    assert n == MINUTES_PER_DAY

    stock_seed = derive_seed(seed, day.symbol, day.date)
    rng = make_rng(stock_seed)

    mid = float(np.mean([day.open, day.close, day.high, day.low]))
    priors: EmpiricalPriors = estimate_priors(history or [], mid)

    # Stochastic vol → per-step sigma in price units
    mean_var = (priors.minute_sigma / max(mid, 1.0)) ** 2
    var_path = simulate_log_variance(n - 1, rng, mean_var=max(mean_var, 1e-12))
    sigma_path = mid * np.sqrt(var_path)

    target_range = max(day.high - day.low, mid * 0.005)
    expected = float(np.median(sigma_path) * np.sqrt(n) * 1.8)
    if expected > 1e-9:
        sigma_path = sigma_path * (target_range / expected)

    mu, alpha, activity_rel = hawkes_params_from_activity(
        trades=day.trades,
        volume=day.volume,
        priors=priors,
    )
    jump_scale = deliverable_jump_scale(day.deliverable_pct, priors.median_deliverable_pct)
    soft = float(np.clip(vwap_softness * deliverable_vwap_boost(day.deliverable_pct), 0.05, 0.85))

    intensities = hawkes_intensities(n, rng, mu=mu, alpha=alpha)
    jumps = hawkes_jumps(n, rng, intensities, price_scale=mid) * jump_scale

    high_idx, low_idx = _choose_extreme_times(rng, n, day.open, day.high, day.low, day.close)
    anchors = _build_anchors(n, day.open, day.high, day.low, day.close, high_idx, low_idx)

    path = piecewise_bridge(anchors, n, rng, sigma_path, jumps)
    path = enforce_hard_ohlc(
        path,
        open_=day.open,
        high=day.high,
        low=day.low,
        close=day.close,
        high_idx=high_idx,
        low_idx=low_idx,
    )

    vol_weights = nse_u_shaped_volume_weights(n, rng)
    if total_day_volume and total_day_volume > 0:
        day_vol = float(total_day_volume)
    elif day.volume and day.volume > 0:
        day_vol = float(day.volume)
    elif priors.median_volume and priors.median_volume > 0:
        day_vol = float(priors.median_volume)
    else:
        day_vol = 1_000_000.0
    volumes = vol_weights * day_vol

    path = soft_vwap_nudge(
        path,
        volumes,
        day.vwap,
        softness=soft,
        low=day.low,
        high=day.high,
        open_=day.open,
        close=day.close,
        high_idx=high_idx,
        low_idx=low_idx,
    )

    if trade_impacts:
        path = apply_trade_impacts(
            path,
            trade_impacts,
            low=day.low,
            high=day.high,
            open_=day.open,
            close=day.close,
            avg_volume=float(np.mean(volumes)),
        )
        path = enforce_hard_ohlc(
            path,
            open_=day.open,
            high=day.high,
            low=day.low,
            close=day.close,
            high_idx=high_idx,
            low_idx=low_idx,
        )
        path = soft_vwap_nudge(
            path,
            volumes,
            day.vwap,
            softness=soft * 0.5,
            low=day.low,
            high=day.high,
            open_=day.open,
            close=day.close,
            high_idx=high_idx,
            low_idx=low_idx,
        )

    path = np.array([round_to_tick(float(x)) for x in path], dtype=np.float64)
    path = enforce_hard_ohlc(
        path,
        open_=round_to_tick(day.open),
        high=round_to_tick(day.high),
        low=round_to_tick(day.low),
        close=round_to_tick(day.close),
        high_idx=high_idx,
        low_idx=low_idx,
    )

    labels = clock.time_labels()
    minute_bars = path_to_minute_ohlc(
        path,
        volumes,
        day_open=round_to_tick(day.open),
        day_high=round_to_tick(day.high),
        day_low=round_to_tick(day.low),
        day_close=round_to_tick(day.close),
    )
    for i, bar in enumerate(minute_bars):
        bar["time"] = labels[i]

    realized = float(np.dot(path, volumes) / volumes.sum())
    liquidity = {
        "volume": day.volume,
        "turnover": day.turnover,
        "trades": day.trades,
        "deliverable_volume": day.deliverable_volume,
        "deliverable_pct": day.deliverable_pct,
        "scaled_day_volume": day_vol,
        "hawkes_mu": mu,
        "hawkes_alpha": alpha,
        "activity_rel": activity_rel,
        "jump_scale": jump_scale,
        "vwap_softness": soft,
    }

    return SimulationResult(
        stock_id=day.symbol,
        date=day.date,
        seed=seed,
        day=day,
        realized_vwap=round_to_tick(realized),
        target_vwap=round_to_tick(day.vwap),
        minute_bars=minute_bars,
        closes=[round_to_tick(float(x)) for x in path],
        volumes=[float(x) for x in volumes],
        time_labels=labels,
        liquidity=liquidity,
    )
