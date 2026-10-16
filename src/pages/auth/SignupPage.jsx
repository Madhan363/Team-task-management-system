import { useState } from 'react';
import { UserPlus, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react';
import ThemeToggle from '../../components/ThemeToggle';

function SignupPage({ onSignup, onNavigateToLogin, error, notice, theme, onToggleTheme }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    if (!username.trim() || !/^[a-z0-9_]{3,30}$/i.test(username.trim())) {
      setFormError('Username must be 3–30 characters long using letters, numbers, or underscores.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await onSignup({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
      });
    } catch (err) {
      setFormError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tf-auth-container tf-auth-split" data-theme={theme}>
      <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
      <aside className="tf-auth-showcase">
        <span className="tf-auth-showcase-kicker">TASKFLOW ADMINISTRATION</span>
        <h1>Set up your workspace.</h1>
        <p>Create the first Admin ID to manage users, roles, departments, and tasks.</p>
        <ul>
          <li>Only the configured administrator can complete setup</li>
          <li>Team Leader and Team Member IDs are created in the Admin Dashboard</li>
          <li>Your password is stored securely</li>
        </ul>
      </aside>
      <div className="tf-auth-card">
        <button
          type="button"
          className="tf-back-nav-btn"
          onClick={onNavigateToLogin}
        >
          <ArrowLeft size={16} /> Back to Sign In
        </button>

        <div className="tf-auth-header">
          <h2>Create the First Admin Account</h2>
          <p>
            Sign up creates the first <strong>Administrator</strong> account using the email configured
            by your server administrator. Team Leader and Team Member accounts are created from the Admin Dashboard.
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
            <label htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              className="tf-input"
              placeholder="e.g. Alex Rivera"
              autoComplete="name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-row">
            <div className="tf-form-group">
              <label htmlFor="reg-username">Username</label>
              <input
                id="reg-username"
                type="text"
                className="tf-input"
                placeholder="e.g. alex_rivera"
                autoComplete="username"
                minLength={3}
                maxLength={30}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <span className="tf-form-help">3–30 letters, numbers, _</span>
            </div>

            <div className="tf-form-group">
              <label htmlFor="reg-email">Email Address</label>
              <input
                id="reg-email"
                type="email"
                className="tf-input"
                placeholder="alex@company.com"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="tf-form-row">
            <div className="tf-form-group">
              <label htmlFor="reg-password">Password</label>
              <div className="tf-password-wrapper">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  className="tf-input tf-password-input"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={100}
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

            <div className="tf-form-group">
              <label htmlFor="reg-confirm">Confirm Password</label>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                className="tf-input"
                placeholder="Re-enter password"
                autoComplete="new-password"
                minLength={8}
                maxLength={100}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="tf-btn tf-btn-primary tf-btn-block"
            disabled={loading}
          >
            {loading ? (
              'Creating Account…'
            ) : (
              <>
                <UserPlus size={18} /> Create Admin ID
              </>
            )}
          </button>
        </form>

        <div className="tf-auth-footer">
          <p className="tf-auth-switch-text">
            Already have an account?{' '}
            <button
              type="button"
              className="tf-link-btn"
              onClick={onNavigateToLogin}
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
