import { useState } from 'react';
import { Eye, EyeOff, LogIn, Shield, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

function LoginPage({ onLogin, onNavigateHome, onNavigateToAdminLogin, onNavigateToSignup, error, notice, theme, onToggleTheme }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!identifier.trim() || !password) {
      setFormError('Please enter your username or email and password.');
      return;
    }

    setLoading(true);
    try {
      await onLogin(identifier.trim(), password);
    } catch (err) {
      setFormError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-auth-container tf-auth-split" data-theme={theme}>
      <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
      <button
        type="button"
        className="tf-back-nav-btn tf-login-home-btn"
        onClick={onNavigateHome}
      >
        <ArrowLeft size={15} /> Back to Home
      </button>
      <aside className="tf-auth-showcase">
        <span className="tf-auth-showcase-kicker">TASKFLOW WORKSPACE</span>
        <h1>Make room for what matters.</h1>
        <p>Sign in to your personal task list, or use your Admin account to manage the team workspace.</p>
        <ul>
          <li>Keep tasks and priorities in one place</li>
          <li>Track progress across your work</li>
          <li>Manage users securely with Admin tools</li>
        </ul>
      </aside>
      <div className="tf-auth-card">
        <div className="tf-auth-brand-badge">
          <div className="tf-auth-logo-dot" />
          <span>TASKFLOW SYSTEM</span>
        </div>

        <div className="tf-auth-header">
          <h2>Welcome Back</h2>
          <p>Sign in to your account to access your tasks and workspace.</p>
        </div>

        {(formError || error) && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError || error}</span>
          </div>
        )}

        {notice && (
          <div className="tf-alert tf-alert-success" role="status">
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="tf-form tf-login-form" noValidate>
          <div className="tf-form-group">
            <label htmlFor="login-identifier">Username or Email</label>
            <input
              id="login-identifier"
              type="text"
              className="tf-input"
              placeholder="e.g. member_alex or user@example.com"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="login-password">Password</label>
            <div className="tf-password-wrapper">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="tf-input tf-password-input"
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="tf-eye-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="tf-btn tf-btn-primary tf-btn-block"
            disabled={loading}
          >
            {loading ? (
              'Signing in…'
            ) : (
              <>
                <LogIn size={18} /> Sign In
              </>
            )}
          </button>
        </form>

        <div className="tf-auth-footer">
          <div className="tf-auth-switch">
            <span>Don&apos;t have an account?</span>
            <button
              type="button"
              className="tf-link-btn"
              onClick={onNavigateToSignup}
            >
              Sign up
            </button>
          </div>
          <div className="tf-admin-login-cta">
            <div className="tf-admin-cta-divider">
              <span>ADMINISTRATIVE PORTAL</span>
            </div>
            <div className="tf-admin-cta-box">
              <div className="tf-admin-cta-text">
                <Shield size={18} className="tf-admin-icon" />
                <span>Are you an Admin?</span>
              </div>
              <button
                type="button"
                className="tf-btn tf-btn-outline-admin"
                onClick={onNavigateToAdminLogin}
              >
                Admin Login <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
