import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as authService from '../services/authService';
import { formatINR } from '../utils/format';
import type { Holding, LedgerEntry, SimulationSession } from '../types';

interface MonitorUser {
  userId: string;
  displayName: string;
  cashBalance: number;
  holdings: Holding[];
  pendingOrders: { id: string; symbol: string; side: string; units: number }[];
  recentLedger: LedgerEntry[];
  latestBuyDate: string | null;
  nextSimulationDate: string;
}

interface Overview {
  config: { secondsPerMarketMinute: number };
  users: MonitorUser[];
  session: SimulationSession | null;
}

export function AdminPage() {
  const stored = authService.getStoredAdmin();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [seconds, setSeconds] = useState(5);
  const [marketDate, setMarketDate] = useState('2008-01-01');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const data = await authService.adminFetch<Overview>('/admin/overview');
    setOverview(data);
    setSeconds(data.config.secondsPerMarketMinute);
  }, []);

  useEffect(() => {
    if (!stored) return;
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load admin overview'),
    );
    const t = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [stored, refresh]);

  if (!stored) {
    return <Navigate to="/admin/login" replace />;
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    setLoading(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  const session = overview?.session ?? null;

  return (
    <div className="page admin-page">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Admin console</p>
          <h1 className="page-title">Market control</h1>
          <p className="page-lede">
            Signed in as <strong>{stored.username}</strong>. Traders cannot start or stop the
            clock — only this console can.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            void authService.adminLogout().then(() => navigate('/admin/login'));
          }}
        >
          Sign out
        </button>
      </header>

      {error && <p className="form-error">{error}</p>}

      <div className="admin-grid">
        <section className="panel admin-grid__clock">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Simulation clock</h2>
              <p className="panel__subtitle">
                Status:{' '}
                <strong className="mono">{session?.status ?? 'IDLE'}</strong>
                {session
                  ? ` · ${session.currentMarketDate} · day ${session.cycle}/${session.maxCycles}`
                  : ''}
              </p>
            </div>
          </div>

          <label className="field">
            <span>Seconds per market minute</span>
            <input
              type="number"
              min={0.5}
              max={60}
              step={0.5}
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value))}
            />
            <span className="muted">Default 5 → 5 wall seconds = 1 market minute</span>
          </label>

          <label className="field">
            <span>Start market date</span>
            <input
              type="date"
              value={marketDate}
              onChange={(e) => setMarketDate(e.target.value)}
            />
          </label>

          <div className="hero-actions" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={loading}
              onClick={() =>
                void run(async () => {
                  await authService.adminFetch('/admin/simulation/config', {
                    method: 'POST',
                    body: JSON.stringify({ secondsPerMarketMinute: seconds }),
                  });
                })
              }
            >
              Save timing
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={loading || session?.status === 'TRADING' || session?.status === 'ANALYSIS'}
              onClick={() =>
                void run(async () => {
                  await authService.adminFetch('/admin/simulation/start', {
                    method: 'POST',
                    body: JSON.stringify({
                      marketDate,
                      secondsPerMarketMinute: seconds,
                    }),
                  });
                })
              }
            >
              Begin simulation
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={loading || session?.status !== 'ANALYSIS'}
              onClick={() =>
                void run(async () => {
                  await authService.adminFetch('/admin/simulation/continue', {
                    method: 'POST',
                    body: '{}',
                  });
                })
              }
            >
              Continue next day
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={loading || !session || session.status === 'ENDED'}
              onClick={() =>
                void run(async () => {
                  await authService.adminFetch('/admin/simulation/stop', {
                    method: 'POST',
                    body: '{}',
                  });
                })
              }
            >
              End simulation
            </button>
          </div>
        </section>

        <section className="panel admin-grid__accounts">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Accounts</h2>
              <p className="panel__subtitle">{overview?.users.length ?? 0} traders</p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={loading}
            onClick={() => {
              if (!window.confirm('Reset ALL trader accounts to ₹0 with empty books?')) return;
              void run(async () => {
                await authService.adminFetch('/admin/users/reset-all', {
                  method: 'POST',
                  body: '{}',
                });
              });
            }}
          >
            Reset all accounts
          </button>
        </section>
      </div>

      <section className="panel admin-monitor" style={{ marginTop: '1rem' }}>
        <div className="panel__head">
          <div>
            <h2 className="panel__title">Holdings & purchases</h2>
            <p className="panel__subtitle">Live monitor of every local trader</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th className="num">Cash</th>
                <th>Holdings</th>
                <th>Recent fills</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(overview?.users ?? []).map((u) => (
                <tr key={u.userId}>
                  <td>
                    <strong>{u.userId}</strong>
                    <div className="muted">{u.displayName}</div>
                  </td>
                  <td className="num mono">{formatINR(u.cashBalance)}</td>
                  <td className="mono">
                    {u.holdings.length === 0
                      ? '—'
                      : u.holdings.map((h) => `${h.symbol}×${h.units}`).join(', ')}
                  </td>
                  <td className="mono">
                    {u.recentLedger.slice(0, 3).map((e) => (
                      <div key={e.id}>
                        {e.side} {e.units} {e.symbol} @ {e.price}
                      </div>
                    ))}
                    {u.recentLedger.length === 0 ? '—' : null}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={loading}
                      onClick={() => {
                        if (!window.confirm(`Reset ${u.userId}?`)) return;
                        void run(async () => {
                          await authService.adminFetch(
                            `/admin/users/${encodeURIComponent(u.userId)}/reset`,
                            { method: 'POST', body: '{}' },
                          );
                        });
                      }}
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
