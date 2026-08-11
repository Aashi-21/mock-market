from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException, Query, Request

from app import __version__
from app.api.schemas import (
    CandleRequest,
    CandleResponse,
    HealthResponse,
    MinuteBarOut,
    MinuteQueryResponse,
    SimulateDayRequest,
    SimulateDayResponse,
    StockListResponse,
    StockMetaOut,
    TradeImpactPreviewRequest,
    TradeImpactPreviewResponse,
)
from app.config import Settings, get_settings
from app.data.metadata import clear_metadata_cache, list_by_series
from app.model.trade_impact import estimate_impact_preview
from app.services.day_simulation import day_bar_to_out, run_simulation
from app.services.session_store import store

router = APIRouter()


def _check_key(settings: Settings, api_key: str | None) -> None:
    expected = settings.simulation_agent_api_key
    if not expected:
        return
    if api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _to_minute_bar(raw: dict) -> MinuteBarOut:
    return MinuteBarOut(
        minute_index=int(raw["minute_index"]),
        time=str(raw["time"]),
        open=float(raw["open"]),
        high=float(raw["high"]),
        low=float(raw["low"]),
        close=float(raw["close"]),
        volume=float(raw["volume"]),
    )


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        version=__version__,
        data_dir=str(settings.data_dir),
        minutes_per_day=settings.minutes_per_day,
    )


@router.get("/v1/stocks", response_model=StockListResponse)
def list_stocks(
    request: Request,
    series: str | None = Query(default=None, description="Filter by Series/Type e.g. EQ, MOCK"),
    industry: str | None = Query(default=None),
    x_api_key: str | None = Header(default=None),
) -> StockListResponse:
    settings: Settings = request.app.state.settings
    _check_key(settings, x_api_key)
    clear_metadata_cache()
    rows = list_by_series(settings.data_dir, series)
    if industry:
        rows = [r for r in rows if r.industry.upper() == industry.upper()]
    stocks = [
        StockMetaOut(
            symbol=r.symbol,
            name=r.name,
            industry=r.industry,
            series=r.series,
            isin=r.isin,
            has_csv=r.csv_path is not None,
        )
        for r in rows
    ]
    industries = sorted({s.industry for s in stocks})
    series_types = sorted({s.series for s in stocks})
    return StockListResponse(stocks=stocks, industries=industries, series_types=series_types)


@router.post("/v1/simulate/day", response_model=SimulateDayResponse)
def simulate_day_endpoint(
    req: SimulateDayRequest,
    request: Request,
    x_api_key: str | None = Header(default=None),
) -> SimulateDayResponse:
    settings: Settings = request.app.state.settings
    _check_key(settings, x_api_key)
    try:
        result = run_simulation(settings, req)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    session_id = store.put(result) if req.persist_session else None
    return SimulateDayResponse(
        session_id=session_id,
        stock_id=result.stock_id,
        date=result.date,
        seed=result.seed,
        minutes=len(result.minute_bars),
        day=day_bar_to_out(result.day),
        target_vwap=result.target_vwap,
        realized_vwap=result.realized_vwap,
        closes=result.closes,
        minute_bars=[_to_minute_bar(b) for b in result.minute_bars],
        liquidity=result.liquidity,
    )


@router.post("/v1/candles", response_model=CandleResponse)
def candles_endpoint(
    req: CandleRequest,
    request: Request,
    x_api_key: str | None = Header(default=None),
) -> CandleResponse:
    """Minute OHLC candles for charting (same engine as /v1/simulate/day)."""
    settings: Settings = request.app.state.settings
    _check_key(settings, x_api_key)
    sim_req = SimulateDayRequest(
        stock_id=req.stock_id,
        date=req.date,
        seed=req.seed,
        day_bar=req.day_bar,
        persist_session=True,
    )
    try:
        result = run_simulation(settings, sim_req)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    session_id = store.put(result)
    candles = [_to_minute_bar(b) for b in result.minute_bars]
    if req.up_to_minute is not None:
        candles = candles[: req.up_to_minute + 1]

    return CandleResponse(
        stock_id=result.stock_id,
        date=result.date,
        seed=result.seed,
        session_id=session_id,
        candles=candles,
        day=day_bar_to_out(result.day),
    )


@router.get("/v1/sessions/{session_id}/minute/{minute_index}", response_model=MinuteQueryResponse)
def get_minute(
    session_id: str,
    minute_index: int,
    request: Request,
    x_api_key: str | None = Header(default=None),
) -> MinuteQueryResponse:
    settings: Settings = request.app.state.settings
    _check_key(settings, x_api_key)
    result = store.get(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Unknown session_id")
    if minute_index < 0 or minute_index >= len(result.minute_bars):
        raise HTTPException(status_code=422, detail="minute_index out of range")

    bar = _to_minute_bar(result.minute_bars[minute_index])
    nxt = None
    if minute_index + 1 < len(result.minute_bars):
        nxt = _to_minute_bar(result.minute_bars[minute_index + 1])

    return MinuteQueryResponse(
        session_id=session_id,
        stock_id=result.stock_id,
        date=result.date,
        minute_index=minute_index,
        bar=bar,
        next_bar=nxt,
    )


@router.post("/v1/trade-impact/preview", response_model=TradeImpactPreviewResponse)
def trade_impact_preview(
    body: TradeImpactPreviewRequest,
    request: Request,
    x_api_key: str | None = Header(default=None),
) -> TradeImpactPreviewResponse:
    settings: Settings = request.app.state.settings
    _check_key(settings, x_api_key)
    delta = estimate_impact_preview(
        body.last_price,
        body.side,
        body.units,
        body.avg_minute_volume,
        body.aggressiveness,
    )
    return TradeImpactPreviewResponse(estimated_price_delta=delta)
