import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MOCK_CREDENTIALS } from '../data/mockUser';
import { ThemeToggle } from '../components/common/ThemeToggle';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ??
    '/dashboard';

  const [email, setEmail] = useState<string>(MOCK_CREDENTIALS.email);
  const [password, setPassword] = useState<string>(MOCK_CREDENTIALS.password);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
          <span className="brand-mark__glyph brand-mark__glyph--lg" aria-hidden />
          <h1 className="login-title">Mock Market</h1>
          <p className="login-lede">
            Replay the Indian equity market from historical NSE data. Build a book,
            queue orders, then step through the tape.
          </p>
        </div>

        <form className="login-form" onSubmit={(e) => void handleSubmit(e)}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <aside className="login-hint">
          <strong>Mock trader</strong>
          <code>{MOCK_CREDENTIALS.email}</code>
          <code>{MOCK_CREDENTIALS.password}</code>
          <span>IDAM will replace this in a later release.</span>
        </aside>
      </section>
    </div>
  );
}
