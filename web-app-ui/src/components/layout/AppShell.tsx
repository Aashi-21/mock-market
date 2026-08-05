import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader';
import { useAppData } from '../../context/AppDataContext';

export function AppShell() {
  const { error, clearError } = useAppData();

  return (
    <div className="app-shell">
      <AppHeader />
      {error && (
        <div className="banner banner--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
