from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8090
    data_dir: Path = Path(__file__).resolve().parents[2] / "DATA"
    default_seed: int = 42
    cors_origins: str = "http://localhost:8080,http://localhost:5173"
    simulation_agent_api_key: str = ""

    # NSE continuous session (no lunch break in modern equity cash)
    session_open: str = "09:15"
    session_close: str = "15:30"
    minutes_per_day: int = 375  # 09:15 inclusive → 15:29 last full minute; close at 15:30

    # Soft VWAP blend weight in [0, 1]
    vwap_softness: float = 0.35

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
