from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# NSE cash equity continuous session
SESSION_OPEN_MINUTES = 9 * 60 + 15  # 09:15
SESSION_CLOSE_MINUTES = 15 * 60 + 30  # 15:30
MINUTES_PER_DAY = SESSION_CLOSE_MINUTES - SESSION_OPEN_MINUTES  # 375


@dataclass(frozen=True)
class SessionClock:
    """Maps minute indices to wall-clock labels within an NSE day."""

    minutes_per_day: int = MINUTES_PER_DAY

    def time_labels(self) -> list[str]:
        labels: list[str] = []
        for i in range(self.minutes_per_day):
            total = SESSION_OPEN_MINUTES + i
            hh, mm = divmod(total, 60)
            labels.append(f"{hh:02d}:{mm:02d}")
        return labels

    def progress(self) -> np.ndarray:
        n = self.minutes_per_day
        return np.linspace(0.0, 1.0, n, dtype=np.float64)
