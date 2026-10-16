import { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

function AdminLoginPage({ onAdminLogin, onNavigateToLogin, error, notice, theme, onToggleTheme }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!identifier.trim() || !password) {
      setFormError('Please enter your Administrator username or email and password.');
      return;
    }

    setLoading(true);
    try {
      await onAdminLogin(identifier.trim(), password);
    } catch (err) {
      setFormError(err.message || 'Administrator authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-auth-container tf-admin-auth-bg" data-theme={theme}>
      <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
      <div className="tf-auth-card tf-admin-card">
        <button
          type="button"
          className="tf-back-nav-btn"
          onClick={onNavigateToLogin}
        >
          <ArrowLeft size={16} /> Back to User Login
        </button>

        <div className="tf-admin-badge-header">
          <div className="tf-admin-shield-icon">
            <Shield size={28} />
          </div>
          <h2>Admin Login Portal</h2>
          <p>
            Authenticate with an authorized Administrator account to manage users,
            departments, and system operations.
          </p>
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

        <form onSubmit={handleSubmit} className="tf-form" noValidate>
          <div className="tf-form-group">
            <label htmlFor="admin-identifier">Admin Username or Email</label>
            <input
              id="admin-identifier"
              type="text"
              className="tf-input tf-admin-input"
              placeholder="e.g. admin or admin@taskflow.local"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="admin-password">Administrator Password</label>
            <div className="tf-password-wrapper">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="tf-input tf-password-input tf-admin-input"
                placeholder="Enter admin password"
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
            className="tf-btn tf-btn-admin-submit tf-btn-block"
            disabled={loading}
          >
            {loading ? (
              'Authenticating Admin…'
            ) : (
              <>
                <Lock size={18} /> Authenticate as Admin
              </>
            )}
          </button>
        </form>

        <div className="tf-admin-notice-box">
          <p>
            <strong>Security Notice:</strong> Admin access requires an existing
            authorized Administrator account. Unassigned or regular user credentials
            will be redirected to their respective dashboards.
          </p>
        </div>
      </div>
    </div>
  );
}

export default AdminLoginPage;
