import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAppData } from '../../context/AppDataContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { formatDate } from '../../utils/format';

export function AppHeader() {
  const { user, logout } = useAuth();
  const { marketDate, phase, endSimulation, session } = useAppData();
  const navigate = useNavigate();

  async function handleLogout() {
    if (phase === 'TRADING' || phase === 'ANALYSIS') {
      try {
        await endSimulation();
      } catch {
        /* still log out */
      }
    }
    await logout();
    navigate('/login', { replace: true });
  }

  const phaseLabel =
    phase === 'TRADING'
      ? `Simulation live · day ${session?.cycle ?? 1}`
      : phase === 'ANALYSIS'
        ? 'Analysis window'
        : 'Pre-simulation';

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Link to="/dashboard" className="brand-mark">
          <span className="brand-mark__glyph" aria-hidden />
          <span className="brand-mark__text">Mock Market</span>
        </Link>
        <span className="brand-tag">NSE · Historical Replay</span>
      </div>

      <div className="app-header__meta">
        {marketDate && (
          <div className="meta-pill" title="Simulation market date">
            <span className="meta-pill__label">Market date</span>
            <span className="meta-pill__value">{formatDate(marketDate)}</span>
          </div>
        )}
        <div className={`phase-chip phase-chip--${phase.toLowerCase()}`}>
          {phaseLabel}
        </div>
        <ThemeToggle />
        <div className="user-chip">
          <span className="user-chip__name">{user?.displayName}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void handleLogout()}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
