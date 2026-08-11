from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DayBarIn(BaseModel):
    previous_close: float = Field(..., gt=0)
    open: float = Field(..., gt=0)
    high: float = Field(..., gt=0)
    low: float = Field(..., gt=0)
    last: float | None = Field(default=None, gt=0, description="Ignored on mismatch with path")
    close: float = Field(..., gt=0)
    vwap: float = Field(..., gt=0)
    volume: float | None = Field(default=None, gt=0)
    turnover: float | None = Field(default=None, gt=0)
    trades: float | None = Field(default=None, gt=0)
    deliverable_volume: float | None = Field(default=None, ge=0)
    deliverable_pct: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Fraction in [0,1]; values >1 from feeds are normalized in the loader",
    )

    @model_validator(mode="after")
    def check_ohlc(self) -> DayBarIn:
        top = max(self.open, self.close, self.low)
        bottom = min(self.open, self.close, self.high)
        if self.high < top - 1e-9:
            raise ValueError("high must be >= open, close, and low")
        if self.low > bottom + 1e-9:
            raise ValueError("low must be <= open, close, and high")
        return self


class TradeImpactIn(BaseModel):
    minute_index: int = Field(..., ge=0, lt=375)
    side: Literal["BUY", "SELL"]
    units: float = Field(..., gt=0)
    aggressiveness: float = Field(default=1.0, ge=0)


class SimulateDayRequest(BaseModel):
    stock_id: str = Field(..., min_length=1)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    seed: int | None = None
    day_bar: DayBarIn | None = None
    trade_impacts: list[TradeImpactIn] = Field(default_factory=list)
    total_day_volume: float | None = Field(default=None, gt=0)
    persist_session: bool = True


class MinuteBarOut(BaseModel):
    minute_index: int
    time: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class SimulateDayResponse(BaseModel):
    session_id: str | None = None
    stock_id: str
    date: str
    seed: int
    exchange: str = "NSE"
    currency: str = "INR"
    minutes: int
    day: DayBarIn
    target_vwap: float
    realized_vwap: float
    closes: list[float]
    minute_bars: list[MinuteBarOut]
    liquidity: dict = Field(default_factory=dict)
    model: dict = Field(
        default_factory=lambda: {
            "components": [
                "piecewise_brownian_bridge",
                "stochastic_volatility",
                "hawkes_jumps",
                "empirical_priors",
                "soft_vwap",
                "volume_trades_deliverable",
            ],
            "ohlc_constraint": "hard",
            "vwap_constraint": "soft",
        }
    )


class MinuteQueryResponse(BaseModel):
    session_id: str
    stock_id: str
    date: str
    minute_index: int
    bar: MinuteBarOut
    next_bar: MinuteBarOut | None = None


class TradeImpactPreviewRequest(BaseModel):
    last_price: float = Field(..., gt=0)
    side: Literal["BUY", "SELL"]
    units: float = Field(..., gt=0)
    avg_minute_volume: float = Field(..., gt=0)
    aggressiveness: float = Field(default=1.0, ge=0)


class TradeImpactPreviewResponse(BaseModel):
    estimated_price_delta: float
    note: str = "Temporary impact estimate; permanent residue applied inside day sessions."


class HealthResponse(BaseModel):
    status: str
    version: str
    data_dir: str
    minutes_per_day: int


class StockMetaOut(BaseModel):
    symbol: str
    name: str
    industry: str
    series: str
    isin: str
    has_csv: bool
    exchange: str = "NSE"


class StockListResponse(BaseModel):
    stocks: list[StockMetaOut]
    industries: list[str]
    series_types: list[str]


class CandleRequest(BaseModel):
    stock_id: str = Field(..., min_length=1)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    seed: int | None = None
    day_bar: DayBarIn | None = None
    up_to_minute: int | None = Field(
        default=None,
        ge=0,
        lt=375,
        description="If set, only return candles through this minute index (live progress)",
    )


class CandleResponse(BaseModel):
    stock_id: str
    date: str
    seed: int
    session_id: str | None = None
    candles: list[MinuteBarOut]
    day: DayBarIn
