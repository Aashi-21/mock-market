from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from app.data.metadata import resolve_csv_path


@dataclass(frozen=True)
class DayBarRecord:
    date: str
    symbol: str
    previous_close: float
    open: float
    high: float
    low: float
    last: float
    close: float
    vwap: float
    volume: float | None = None
    turnover: float | None = None
    trades: float | None = None
    deliverable_volume: float | None = None
    deliverable_pct: float | None = None


REQUIRED_COLUMNS = (
    "Date",
    "PreviousClose",
    "Open",
    "High",
    "Low",
    "Last",
    "Close",
    "VWAP",
)


def is_price_csv(path: Path) -> bool:
    """True for per-symbol OHLC CSVs (not catalog / aggregate dumps)."""
    name = path.name
    if name in {"stock_metadata.csv", "NIFTY50_all.csv"}:
        return False
    return name.lower().endswith(".csv")


def list_stock_csvs(data_dir: Path) -> list[Path]:
    if not data_dir.is_dir():
        return []
    return sorted(p for p in data_dir.iterdir() if p.is_file() and is_price_csv(p))


def _f(row: dict[str, str], key: str) -> float:
    return float(str(row[key]).strip().replace(",", ""))


def _optional_f(row: dict[str, str], key: str | None) -> float | None:
    if key is None:
        return None
    raw = row.get(key)
    if raw is None:
        return None
    text = str(raw).strip().replace(",", "")
    if text == "" or text.lower() in {"nan", "none", "null"}:
        return None
    return float(text)


def _resolve_columns(fieldnames: list[str]) -> dict[str, str]:
    field_map = {name.strip(): name for name in fieldnames}
    lower = {k.lower(): k for k in field_map}

    aliases: dict[str, list[str]] = {
        "Date": ["Date", "date"],
        "Symbol": ["Symbol", "symbol", "Stock ID", "StockID"],
        "PreviousClose": [
            "PreviousClose",
            "Prev Close",
            "PrevClose",
            "Previous day's close price",
            "PreviousDayClose",
        ],
        "Open": ["Open", "Open price of day", "OpenPrice"],
        "High": ["High", "Highest price in day", "HighPrice"],
        "Low": ["Low", "Lowest price in day", "LowPrice"],
        "Last": ["Last", "Last traded price in day", "LTP", "LastTradedPrice"],
        "Close": ["Close", "Close price of day", "ClosePrice"],
        "VWAP": ["VWAP", "Volume Weighted Average Price", "VolumeWeightedAveragePrice"],
        "Volume": ["Volume", "Vol", "TotalVolume"],
        "Turnover": ["Turnover", "Value", "TradedValue"],
        "Trades": ["Trades", "No of Trades", "NumberOfTrades", "TradeCount"],
        "DeliverableVolume": [
            "Deliverable Volume",
            "DeliverableVolume",
            "Deliverable Qty",
            "DeliverableQty",
        ],
        "DeliverablePct": [
            "%Deliverble",
            "%Deliverable",
            "DeliverablePct",
            "PctDeliverable",
            "% Deliverble",
            "% Deliverable",
        ],
    }

    resolved: dict[str, str] = {}
    for canon, options in aliases.items():
        for opt in options:
            if opt in field_map:
                resolved[canon] = field_map[opt]
                break
            if opt.lower() in lower:
                resolved[canon] = lower[opt.lower()]
                break
        if canon in REQUIRED_COLUMNS and canon not in resolved:
            raise ValueError(f"Missing column for {canon}")
    return resolved


def _normalize_deliverable_pct(
    raw: float | None, volume: float | None, deliv_vol: float | None
) -> float | None:
    if raw is not None:
        pct = float(raw)
        if pct > 1.0:
            pct /= 100.0
        return float(min(max(pct, 0.0), 1.0))
    if volume and volume > 0 and deliv_vol is not None:
        return float(min(max(deliv_vol / volume, 0.0), 1.0))
    return None


def _infer_volume(volume: float | None, turnover: float | None, vwap: float) -> float | None:
    if volume is not None and volume > 0:
        return float(volume)
    if turnover is not None and turnover > 0 and vwap > 0:
        inferred = turnover / (vwap * 1e5)
        if inferred > 0:
            return float(inferred)
    return None


def load_stock_csv(path: Path, filename_symbol: str) -> list[DayBarRecord]:
    if not path.exists():
        raise FileNotFoundError(f"CSV not found: {path}")
    if not is_price_csv(path):
        raise ValueError(f"Not a per-symbol price CSV: {path.name}")

    rows: list[DayBarRecord] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if reader.fieldnames is None:
            raise ValueError(f"Empty CSV: {path}")
        resolved = _resolve_columns(list(reader.fieldnames))

        for raw in reader:
            if not any((v or "").strip() for v in raw.values()):
                continue
            volume = _optional_f(raw, resolved.get("Volume"))
            turnover = _optional_f(raw, resolved.get("Turnover"))
            trades = _optional_f(raw, resolved.get("Trades"))
            deliv_vol = _optional_f(raw, resolved.get("DeliverableVolume"))
            deliv_pct_raw = _optional_f(raw, resolved.get("DeliverablePct"))
            vwap = _f(raw, resolved["VWAP"])
            volume = _infer_volume(volume, turnover, vwap)
            deliv_pct = _normalize_deliverable_pct(deliv_pct_raw, volume, deliv_vol)

            rows.append(
                DayBarRecord(
                    date=str(raw[resolved["Date"]]).strip()[:10],
                    symbol=filename_symbol,
                    previous_close=_f(raw, resolved["PreviousClose"]),
                    open=_f(raw, resolved["Open"]),
                    high=_f(raw, resolved["High"]),
                    low=_f(raw, resolved["Low"]),
                    last=_f(raw, resolved["Last"]),
                    close=_f(raw, resolved["Close"]),
                    vwap=vwap,
                    volume=volume,
                    turnover=turnover,
                    trades=trades,
                    deliverable_volume=deliv_vol,
                    deliverable_pct=deliv_pct,
                )
            )

    rows.sort(key=lambda r: r.date)
    return rows


def csv_path_for(data_dir: Path, stock_id: str) -> Path:
    """Resolve symbol → CSV path; raises if missing."""
    found = resolve_csv_path(data_dir, stock_id)
    if found is None:
        raise FileNotFoundError(
            f"No CSV for {stock_id!r} under {data_dir}. Tried common symbol filename variants."
        )
    return found


def merge_liquidity(base: DayBarRecord, donor: DayBarRecord) -> DayBarRecord:
    return DayBarRecord(
        date=base.date,
        symbol=base.symbol,
        previous_close=base.previous_close,
        open=base.open,
        high=base.high,
        low=base.low,
        last=base.last,
        close=base.close,
        vwap=base.vwap,
        volume=base.volume if base.volume is not None else donor.volume,
        turnover=base.turnover if base.turnover is not None else donor.turnover,
        trades=base.trades if base.trades is not None else donor.trades,
        deliverable_volume=(
            base.deliverable_volume if base.deliverable_volume is not None else donor.deliverable_volume
        ),
        deliverable_pct=base.deliverable_pct if base.deliverable_pct is not None else donor.deliverable_pct,
    )
