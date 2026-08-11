from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.data.loader import DayBarRecord


@dataclass(frozen=True)
class EmpiricalPriors:
    """Volatility + activity priors estimated from a stock's historical daily bars."""

    daily_return_std: float
    parkinson_vol: float
    typical_range_pct: float
    minute_sigma: float
    median_volume: float | None = None
    median_trades: float | None = None
    median_deliverable_pct: float | None = None


def _parkinson(high: float, low: float) -> float:
    if high <= 0 or low <= 0 or high < low:
        return 0.0
    return float(np.sqrt((1.0 / (4.0 * np.log(2.0))) * (np.log(high / low) ** 2)))


def estimate_priors(history: list[DayBarRecord], fallback_mid: float) -> EmpiricalPriors:
    """
    Build empirical priors from prior daily OHLC (+ liquidity) rows.
    Falls back to a mild equity prior when history is thin.
    """
    if len(history) >= 2:
        closes = np.array([r.close for r in history], dtype=np.float64)
        rets = np.diff(np.log(np.clip(closes, 1e-6, None)))
        daily_std = float(np.std(rets)) if len(rets) else 0.012
        parks = [_parkinson(r.high, r.low) for r in history]
        park = float(np.median(parks)) if parks else daily_std
        ranges = [(r.high - r.low) / max(r.close, 1e-6) for r in history]
        typ_range = float(np.median(ranges)) if ranges else 0.02
    else:
        daily_std = 0.012
        park = 0.012
        typ_range = 0.02

    daily_std = max(daily_std, 0.004)
    park = max(park, 0.004)
    minute_sigma = float(park / np.sqrt(375.0)) * max(fallback_mid, 1.0)
    minute_sigma = max(minute_sigma, fallback_mid * 0.00015)

    vols = [r.volume for r in history if r.volume is not None and r.volume > 0]
    trades = [r.trades for r in history if r.trades is not None and r.trades > 0]
    delivs = [r.deliverable_pct for r in history if r.deliverable_pct is not None]

    return EmpiricalPriors(
        daily_return_std=daily_std,
        parkinson_vol=park,
        typical_range_pct=max(typ_range, 0.005),
        minute_sigma=minute_sigma,
        median_volume=float(np.median(vols)) if vols else None,
        median_trades=float(np.median(trades)) if trades else None,
        median_deliverable_pct=float(np.median(delivs)) if delivs else None,
    )


def hawkes_params_from_activity(
    *,
    trades: float | None,
    volume: float | None,
    priors: EmpiricalPriors,
) -> tuple[float, float, float]:
    """
    Map day trade/volume activity → Hawkes (mu, alpha, jump_scale).
    Higher trades → more bursty intensity. Returns (mu, alpha, relative_activity).
    """
    t = trades if trades and trades > 0 else None
    if t is None and volume and volume > 0:
        # Rough fallback: ~1 trade per 40–80 shares for mid-caps
        t = volume / 50.0

    if t is None:
        return 0.08, 0.55, 1.0

    baseline = priors.median_trades if priors.median_trades and priors.median_trades > 0 else t
    rel = float(np.clip(t / baseline, 0.35, 3.0))
    tpm = t / 375.0
    mu = float(np.clip(0.045 + 0.035 * np.log1p(tpm) * rel, 0.04, 0.28))
    alpha = float(np.clip(0.38 + 0.12 * np.log1p(tpm) * np.sqrt(rel), 0.3, 0.8))
    return mu, alpha, rel


def deliverable_jump_scale(deliverable_pct: float | None, prior_pct: float | None) -> float:
    """
    High deliverable share → quieter jumps / more investment-like flow.
    Low deliverable → more speculative / jumpy.
    """
    pct = deliverable_pct if deliverable_pct is not None else prior_pct
    if pct is None:
        return 1.0
    pct = float(np.clip(pct, 0.0, 1.0))
    # 0% deliv → 1.25x jumps; 100% deliv → 0.65x jumps
    return float(1.25 - 0.60 * pct)


def deliverable_vwap_boost(deliverable_pct: float | None) -> float:
    """High deliverable → slightly stronger soft VWAP adherence."""
    if deliverable_pct is None:
        return 1.0
    pct = float(np.clip(deliverable_pct, 0.0, 1.0))
    return float(0.85 + 0.40 * pct)
