from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class StockMeta:
    symbol: str
    name: str
    industry: str
    series: str  # EQ, MOCK, …
    isin: str
    csv_path: Path | None


def _candidate_filenames(symbol: str) -> list[str]:
    """Map metadata symbols to on-disk CSV names (e.g. M&M → MM.csv)."""
    variants = [
        symbol,
        symbol.replace("&", ""),
        symbol.replace("-", ""),
        symbol.replace("&", "").replace("-", ""),
        symbol.replace("&", "AND"),
    ]
    seen: set[str] = set()
    out: list[str] = []
    for v in variants:
        name = f"{v}.csv"
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


def resolve_csv_path(data_dir: Path, symbol: str) -> Path | None:
    for name in _candidate_filenames(symbol):
        path = data_dir / name
        if path.is_file():
            return path
    return None


def load_stock_metadata(data_dir: Path) -> list[StockMeta]:
    path = data_dir / "stock_metadata.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing catalog: {path}")

    rows: list[StockMeta] = []
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        if not reader.fieldnames:
            return []
        # Flexible headers
        field_map = {n.strip(): n for n in reader.fieldnames}
        lower = {k.lower(): v for k, v in field_map.items()}

        def col(*names: str) -> str:
            for n in names:
                if n in field_map:
                    return field_map[n]
                if n.lower() in lower:
                    return lower[n.lower()]
            raise ValueError(f"stock_metadata.csv missing column among {names}")

        c_name = col("Company Name", "Name", "company_name")
        c_ind = col("Industry", "Sector", "industry")
        c_sym = col("Symbol", "symbol")
        c_series = col("Series", "Type", "series")
        c_isin = col("ISIN Code", "ISIN", "isin")

        for raw in reader:
            symbol = str(raw[c_sym]).strip()
            if not symbol:
                continue
            rows.append(
                StockMeta(
                    symbol=symbol,
                    name=str(raw[c_name]).strip(),
                    industry=str(raw[c_ind]).strip(),
                    series=str(raw[c_series]).strip() or "EQ",
                    isin=str(raw[c_isin]).strip(),
                    csv_path=resolve_csv_path(data_dir, symbol),
                )
            )
    rows.sort(key=lambda r: r.symbol)
    return rows


@lru_cache(maxsize=4)
def cached_metadata(data_dir: str) -> tuple[StockMeta, ...]:
    return tuple(load_stock_metadata(Path(data_dir)))


def get_meta(data_dir: Path, symbol: str) -> StockMeta | None:
    for row in cached_metadata(str(data_dir.resolve())):
        if row.symbol == symbol:
            return row
    return None


def list_by_series(data_dir: Path, series: str | None = None) -> list[StockMeta]:
    rows = list(cached_metadata(str(data_dir.resolve())))
    if series:
        return [r for r in rows if r.series.upper() == series.upper()]
    return rows


def clear_metadata_cache() -> None:
    cached_metadata.cache_clear()
