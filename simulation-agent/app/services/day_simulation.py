from __future__ import annotations

from pathlib import Path

from app.api.schemas import DayBarIn, SimulateDayRequest, TradeImpactIn
from app.config import Settings
from app.data.loader import DayBarRecord, csv_path_for, load_stock_csv, merge_liquidity
from app.model.simulator import SimulationResult, simulate_day
from app.model.trade_impact import TradeImpactEvent


def day_bar_from_in(stock_id: str, date: str, bar: DayBarIn) -> DayBarRecord:
    return DayBarRecord(
        date=date,
        symbol=stock_id,
        previous_close=bar.previous_close,
        open=bar.open,
        high=bar.high,
        low=bar.low,
        last=bar.last if bar.last is not None else bar.close,
        close=bar.close,
        vwap=bar.vwap,
        volume=bar.volume,
        turnover=bar.turnover,
        trades=bar.trades,
        deliverable_volume=bar.deliverable_volume,
        deliverable_pct=bar.deliverable_pct,
    )


def day_bar_to_out(day: DayBarRecord) -> DayBarIn:
    return DayBarIn(
        previous_close=day.previous_close,
        open=day.open,
        high=day.high,
        low=day.low,
        last=day.last,
        close=day.close,
        vwap=day.vwap,
        volume=day.volume,
        turnover=day.turnover,
        trades=day.trades,
        deliverable_volume=day.deliverable_volume,
        deliverable_pct=day.deliverable_pct,
    )


def resolve_day(
    settings: Settings,
    stock_id: str,
    date: str,
    override: DayBarIn | None,
) -> tuple[DayBarRecord, list[DayBarRecord]]:
    data_dir = Path(settings.data_dir)
    history: list[DayBarRecord] = []
    try:
        path = csv_path_for(data_dir, stock_id)
        history = load_stock_csv(path, stock_id)
    except FileNotFoundError:
        if override is None:
            raise
    except ValueError:
        # Malformed / unexpected headers — still allow explicit day_bar overrides
        if override is None:
            raise

    if override is not None:
        day = day_bar_from_in(stock_id, date, override)
        same = next((r for r in history if r.date == date), None)
        if same is not None:
            day = merge_liquidity(day, same)
        prior = [r for r in history if r.date < date]
        return day, prior

    matches = [r for r in history if r.date == date]
    if not matches:
        raise FileNotFoundError(
            f"No day bar for {stock_id} on {date}. Provide day_bar in the request or add a DATA CSV for this symbol."
        )
    day = matches[0]
    prior = [r for r in history if r.date < date]
    return day, prior


def impacts_from_in(items: list[TradeImpactIn]) -> list[TradeImpactEvent]:
    return [
        TradeImpactEvent(
            minute_index=i.minute_index,
            side=i.side,
            units=i.units,
            aggressiveness=i.aggressiveness,
        )
        for i in items
    ]


def run_simulation(settings: Settings, req: SimulateDayRequest) -> SimulationResult:
    day, history = resolve_day(settings, req.stock_id, req.date, req.day_bar)
    seed = settings.default_seed if req.seed is None else req.seed
    return simulate_day(
        day,
        history=history,
        seed=seed,
        vwap_softness=settings.vwap_softness,
        trade_impacts=impacts_from_in(req.trade_impacts),
        total_day_volume=req.total_day_volume,
    )
