import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import * as authService from '../services/authService';
import { ThemeToggle } from '../components/common/ThemeToggle';

export function AdminLoginPage() {
  const stored = authService.getStoredAdmin();
  const navigate = useNavigate();
  const [username, setUsername] = useState('rootadmin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (stored) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await authService.adminLogin(username, password);
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden />
      <ThemeToggle className="login-theme-toggle" />
      <section className="login-card">
        <div className="login-card__brand">
          <h1 className="login-title">Admin</h1>
          <p className="login-lede">
            Control the global market clock. Admins cannot trade or view live charts.
          </p>
        </div>
        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Admin sign in'}
          </button>
        </form>
      </section>
    </div>
  );
}
