from __future__ import annotations

import uuid
from dataclasses import dataclass, field

from app.model.simulator import SimulationResult


@dataclass
class SessionStore:
    sessions: dict[str, SimulationResult] = field(default_factory=dict)

    def put(self, result: SimulationResult) -> str:
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = result
        return session_id

    def get(self, session_id: str) -> SimulationResult | None:
        return self.sessions.get(session_id)


store = SessionStore()
