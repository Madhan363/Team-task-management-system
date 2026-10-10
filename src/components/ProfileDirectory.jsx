import { useState } from 'react';
import TodoTourPlayer from './TodoTourPlayer';

const AVATAR_THEMES = [
  { id: 'aurora', name: 'Aurora', gradient: 'linear-gradient(135deg, #8b5cf6, #06b6d4)' },
  { id: 'cyber', name: 'Cyberpunk', gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6)' },
  { id: 'emerald', name: 'Matrix', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
  { id: 'amber', name: 'Solar', gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)' },
  { id: 'sapphire', name: 'Ocean', gradient: 'linear-gradient(135deg, #3b82f6, #6366f1)' },
];

function ProfileDirectory({
  onLogin,
  onRegister,
  globalError,
}) {
  const [activeModal, setActiveModal] = useState(null); // null | 'login' | 'register'

  // Form states
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form states
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regTheme, setRegTheme] = useState(AVATAR_THEMES[0].id);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openLoginModal = () => {
    setUsernameInput('');
    setPasswordInput('');
    setShowPassword(false);
    setFormError('');
    setActiveModal('login');
  };

  const openRegisterModal = () => {
    setRegName('');
    setRegUsername('');
    setRegPassword('');
    setRegConfirmPassword('');
    setRegTheme(AVATAR_THEMES[0].id);
    setShowRegPassword(false);
    setFormError('');
    setActiveModal('register');
  };

  const closeModal = () => {
    setActiveModal(null);
    setFormError('');
  };

  const handleDirectLoginSubmit = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput) {
      setFormError('Please provide both username and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await onLogin(usernameInput.trim(), passwordInput);
      if (!success) setFormError('Invalid username or password.');
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const cleanName = regName.trim();
    const cleanUsername = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanName) {
      setFormError('Display name is required.');
      return;
    }
    if (!cleanUsername || cleanUsername.length < 3) {
      setFormError('Username must be at least 3 alphanumeric characters.');
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setFormError('Password must be at least 4 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    const newUser = {
      name: cleanName,
      username: cleanUsername,
      password: regPassword,
      theme: regTheme,
    };

    setIsSubmitting(true);
    try {
      await onRegister(newUser);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="directory-container">
      {/* Aurora Ambient Orbs */}
      <div className="ambient-orb orb-1" aria-hidden="true" />
      <div className="ambient-orb orb-2" aria-hidden="true" />
      <div className="ambient-orb orb-3" aria-hidden="true" />

      {/* Main Header */}
      <header className="directory-header">
        <div className="auth-buttons">
          <button
            type="button"
            className="btn btn-primary create-account"
            onClick={openRegisterModal}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Create Account</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary sign-in"
            onClick={openLoginModal}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span>Sign In</span>
          </button>
        </div>
        <div className="directory-intro">
          {globalError && <div className="form-error-alert" role="alert">{globalError}</div>}
          <div className="brand-pill">
            <span className="pulse-dot" />
            <span>A CALMER WAY TO GET THINGS DONE</span>
          </div>
          <h1 className="directory-title">
            <span className="todo-logo" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6h11" />
                <path d="M9 12h11" />
                <path d="M9 18h11" />
                <path d="m3 6 1.5 1.5L7 5" />
                <path d="m3 12 1.5 1.5L7 11" />
                <path d="m3 18 1.5 1.5L7 17" />
              </svg>
            </span>
            Make room for <span className="gradient-text">what matters.</span>
          </h1>
          <p className="directory-subtitle">
            Pick up where you left off, or create a space for fresh plans, focused days, and little wins.
          </p>
          <svg
            className="directory-illustration"
            viewBox="0 0 420 240"
            role="img"
            aria-label="Illustration of a to-do list with completed tasks and a small plant"
          >
            <defs>
              <linearGradient id="list-card-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#111827" />
              </linearGradient>
              <linearGradient id="list-accent-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
              <filter id="list-card-shadow" x="-30%" y="-30%" width="160%" height="170%">
                <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#020617" floodOpacity=".45" />
              </filter>
            </defs>
            <circle cx="210" cy="120" r="94" fill="#6366f1" opacity=".1" />
            <path d="M88 208h244" stroke="#64748b" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
            <g filter="url(#list-card-shadow)" transform="rotate(-4 210 118)">
              <rect x="119" y="27" width="188" height="166" rx="20" fill="url(#list-card-gradient)" stroke="#94a3b8" strokeOpacity=".3" />
              <rect x="139" y="47" width="42" height="6" rx="3" fill="url(#list-accent-gradient)" />
              <circle cx="282" cy="50" r="4" fill="#64748b" />
              <circle cx="267" cy="50" r="4" fill="#64748b" opacity=".65" />
              <rect x="139" y="72" width="148" height="1" fill="#94a3b8" opacity=".2" />
              <circle cx="151" cy="94" r="8" fill="#10b981" opacity=".2" stroke="#34d399" />
              <path d="m147 94 3 3 5-6" fill="none" stroke="#6ee7b7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="168" y="91" width="89" height="5" rx="2.5" fill="#cbd5e1" opacity=".75" />
              <rect x="168" y="101" width="57" height="3" rx="1.5" fill="#64748b" opacity=".7" />
              <circle cx="151" cy="127" r="8" fill="#10b981" opacity=".2" stroke="#34d399" />
              <path d="m147 127 3 3 5-6" fill="none" stroke="#6ee7b7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="168" y="124" width="104" height="5" rx="2.5" fill="#cbd5e1" opacity=".75" />
              <rect x="168" y="134" width="70" height="3" rx="1.5" fill="#64748b" opacity=".7" />
              <circle cx="151" cy="160" r="8" fill="#8b5cf6" opacity=".15" stroke="#a78bfa" />
              <rect x="168" y="157" width="78" height="5" rx="2.5" fill="#cbd5e1" opacity=".75" />
            </g>
            <g transform="translate(303 126)">
              <path d="M16 79V42" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
              <path d="M16 58C-4 57-8 43 1 37c10-6 17 9 15 21Z" fill="#10b981" />
              <path d="M16 49c1-17 14-21 20-14 6 8-5 18-20 19Z" fill="#34d399" />
              <path d="M5 79h25l-3 16H8Z" fill="#8b5cf6" />
              <path d="M4 79h27" stroke="#c4b5fd" strokeWidth="3" strokeLinecap="round" />
            </g>
            <path d="m91 61 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" fill="#fbbf24" />
            <path d="m332 48 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" fill="#67e8f9" />
            <circle cx="79" cy="144" r="3" fill="#c4b5fd" />
            <circle cx="347" cy="100" r="3" fill="#f9a8d4" />
          </svg>
        </div>
      </header>

      <section className="directory-tour-section" aria-labelledby="directory-tour-title">
        <span className="tour-eyebrow">A QUICK LOOK</span>
        <h2 className="directory-tour-title" id="directory-tour-title">See your day come together.</h2>
        <p className="directory-tour-subtitle">
          Take a short tour of your personal task space.
        </p>
        <TodoTourPlayer />
      </section>

      {/* --- MODAL: DIRECT LOGIN (USERNAME + PASSWORD) --- */}
      {activeModal === 'login' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 className="modal-title">Sign In to Your Workspace</h2>
              <p className="modal-subtitle">Provide your credentials to access your private to-do list.</p>
            </div>

            <form onSubmit={handleDirectLoginSubmit} className="modal-form">
              <div className="form-field">
                <label htmlFor="direct-username">Username</label>
                <input
                  id="direct-username"
                  type="text"
                  className="form-input"
                  placeholder="e.g. alex or sarah"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (formError) setFormError('');
                  }}
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label htmlFor="direct-password">Password</label>
                <div className="password-input-group">
                  <input
                    id="direct-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter password..."
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (formError) setFormError('');
                    }}
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {formError && <div className="form-error-alert">{formError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing In…' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: REGISTER NEW PROFILE --- */}
      {activeModal === 'register' && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-icon-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="22" y1="11" x2="16" y2="11" />
                </svg>
              </div>
              <h2 className="modal-title">Create Account</h2>
              <p className="modal-subtitle">Register a new profile with independent task storage.</p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="modal-form">
              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="reg-name">Display Name</label>
                  <input
                    id="reg-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. John Doe"
                    value={regName}
                    onChange={(e) => {
                      setRegName(e.target.value);
                      if (formError) setFormError('');
                    }}
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="reg-username">Username</label>
                  <input
                    id="reg-username"
                    type="text"
                    className="form-input"
                    placeholder="e.g. jdoe (alphanumeric)"
                    value={regUsername}
                    onChange={(e) => {
                      setRegUsername(e.target.value);
                      if (formError) setFormError('');
                    }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="reg-password">Password</label>
                  <div className="password-input-group">
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Min. 4 characters"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (formError) setFormError('');
                      }}
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showRegPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="reg-confirm">Confirm Password</label>
                  <input
                    id="reg-confirm"
                    type={showRegPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Re-enter password"
                    value={regConfirmPassword}
                    onChange={(e) => {
                      setRegConfirmPassword(e.target.value);
                      if (formError) setFormError('');
                    }}
                  />
                </div>
              </div>

              {/* Theme Picker */}
              <div className="form-field">
                <label>Avatar Visual Theme</label>
                <div className="theme-options-grid">
                  {AVATAR_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      className={`theme-badge-btn ${regTheme === theme.id ? 'active' : ''}`}
                      onClick={() => setRegTheme(theme.id)}
                    >
                      <span
                        className="theme-sample-dot"
                        style={{ background: theme.gradient }}
                      />
                      <span>{theme.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {formError && <div className="form-error-alert">{formError}</div>}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating Account…' : 'Create Account & Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileDirectory;
