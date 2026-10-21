
import { useState } from 'react';

function AuthPanel({
  onLogin,
  onRegister,
  onBack,
  onSwitchMode,
  onAdminLogin,
  initialMode = 'login',
  loginRole,
  error,
  notice,
}) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setFormError('');
  };

  const changeMode = (nextMode) => {
    switchMode(nextMode);

    if (onSwitchMode) {
      onSwitchMode(nextMode);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        await onRegister({
          name,
          username,
          email,
          password,
        });
      } else {
        await onLogin(identifier, password);
      }
    } catch (submitError) {
      setFormError(
        submitError?.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <button
        type="button"
        className="auth-back-button"
        onClick={onBack}
      >
        <span aria-hidden="true">←</span> Back
      </button>

      <header className="auth-header">
        <span className="app-eyebrow">
          {loginRole === 'Admin'
            ? 'SYSTEM MANAGEMENT'
            : loginRole
              ? 'TEAM LOGIN'
              : 'YOUR TASK SPACE'}
        </span>

        <h1 id="auth-title">
          {mode === 'register'
            ? 'Create your account'
            : loginRole
              ? `${loginRole} Login`
              : 'Welcome back'}
        </h1>

        <p>
          {mode === 'register'
            ? 'New accounts start with the Team Member role.'
            : loginRole
              ? 'Sign in with your existing account.'
              : 'Log in to continue to your task dashboard.'}
        </p>
      </header>

      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' ? (
          <>
            <label>
              Full name
              <input
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            <label>
              Username
              <input
                type="text"
                autoComplete="username"
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]+"
                title="Use 3–30 letters, numbers, or underscores."
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
          </>
        ) : (
          <label>
            Username or email
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
            />
          </label>
        )}

        <label>
          Password

          <span className="password-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={
                mode === 'register'
                  ? 'new-password'
                  : 'current-password'
              }
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={100}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            <button
              type="button"
              className="password-visibility-toggle"
              onClick={() =>
                setShowPassword((visible) => !visible)
              }
              aria-label={
                showPassword ? 'Hide password' : 'Show password'
              }
              aria-pressed={showPassword}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                  <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.1 9.5 6.5a10.7 10.7 0 01-3.2 4.3M6.2 6.2A11.3 11.3 0 002.5 12c1 2.4 4.5 7 9.5 7a10 10 0 004.1-.9" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              )}
            </button>
          </span>

          {mode === 'register' && (
            <span className="auth-help">
              Use at least 8 characters.
            </span>
          )}
        </label>

        {mode === 'register' && (
          <label>
            Confirm password
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={100}
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              required
            />
          </label>
        )}

        {(formError || error) && (
          <p className="auth-error" role="alert">
            {formError || error}
          </p>
        )}

        {notice && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}

        <button
          type="submit"
          className="auth-submit"
          disabled={submitting}
        >
          {submitting
            ? 'Please wait…'
            : mode === 'register'
              ? 'Create account'
              : 'Log in'}
        </button>
      </form>

      <div className="auth-alternate-actions">
        {mode === 'login' && (
          <>
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => changeMode('register')}
              >
                Sign Up
              </button>
            </p>

            {!loginRole && (
              <>
                <div className="auth-admin-access">
                  <strong>Are you an Admin?</strong>

                  <button
                    type="button"
                    onClick={onAdminLogin}
                  >
                    Admin Login
                  </button>
                </div>

                <p>
                  Team account?{' '}
                  <button type="button" onClick={onBack}>
                    Choose team role
                  </button>
                </p>
              </>
            )}
          </>
        )}

        {mode === 'register' && (
          <p>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => changeMode('login')}
            >
              Log in
            </button>
          </p>
        )}
      </div>
    </section>
  );
}

export default AuthPanel;
