function TeamLogin({ onBack, onSelectRole }) {
  return (
    <main className="app-shell">
      <section className="auth-card" aria-labelledby="team-login-title">
        <button type="button" className="auth-back-button" onClick={onBack}>
          <span aria-hidden="true">←</span> Back
        </button>
        <header className="auth-header">
          <span className="app-eyebrow">ACCOUNT ACCESS</span>
          <h1 id="team-login-title">Team Login</h1>
          <p>Choose a sign-in option to continue with your existing account.</p>
        </header>
        <div className="team-login-options">
          <button type="button" onClick={() => onSelectRole('leader-login')}>
            <strong>Team Leader</strong>
            <span>Continue to leader sign-in</span>
          </button>
          <button type="button" onClick={() => onSelectRole('member-login')}>
            <strong>Team Member</strong>
            <span>Continue to member sign-in</span>
          </button>
        </div>
        <p className="team-login-notice" role="note">
          Team leaders assign tasks to individual members. Members can only access tasks assigned to their account.
        </p>
      </section>
    </main>
  );
}

export default TeamLogin;
