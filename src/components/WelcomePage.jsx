import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';

const TOUR_DURATION = 15;

function WelcomePage({ onLogin, onSignup, theme, onToggleTheme }) {
  const [playing, setPlaying] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const step = Math.min(Math.floor(seconds / 5), 2);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current >= TOUR_DURATION - 1) {
          setPlaying(false);
          return TOUR_DURATION;
        }
        return current + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const replay = () => {
    setSeconds(0);
    setPlaying(true);
  };

  const togglePlayback = () => {
    if (seconds >= TOUR_DURATION) {
      replay();
      return;
    }
    setPlaying((current) => !current);
  };

  return (
    <main className="welcome-page" data-theme={theme}>
      <header className="welcome-nav">
        <a className="welcome-brand" href="/" aria-label="Team Task Management System home">
          <span className="welcome-brand-icon" aria-hidden="true">✓</span>
          <span>Team Task Management System</span>
        </a>
        <nav className="welcome-nav-actions" aria-label="Account">
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
          <button type="button" className="welcome-nav-login" onClick={onLogin}>Log in</button>
          <button type="button" className="welcome-nav-cta" onClick={onSignup}>Sign up</button>
        </nav>
      </header>

      <section className="welcome-hero">
        <div className="welcome-copy">
          <span className="welcome-kicker"><span /> A LITTLE MORE FOCUS, EVERY DAY</span>
          <h1>Team Task Management <span>for your team.</span></h1>
          <p className="welcome-description">
            Assign work, track progress, and keep your team aligned on priorities and deadlines.
            Give every task a clear owner and a visible next step.
          </p>
          <p className="welcome-reassurance">Role-based workspaces for Admins, Team Leaders, and Team Members.</p>
          <div className="welcome-hero-cta">
            <button type="button" className="welcome-cta-primary" onClick={onSignup}>Get Started</button>
            <button type="button" className="welcome-cta-secondary" onClick={onLogin}>Log in</button>
          </div>
        </div>

        <section className="welcome-tour" aria-label="Team task management preview">
          <div className="tour-window">
            <div className="tour-window-top">
              <div className="tour-window-controls" aria-hidden="true"><i /><i /><i /></div>
              <span>YOUR DAY, IN VIEW</span>
              <span className="tour-window-live">OVERVIEW</span>
            </div>
            <div className="tour-window-body">
              <div className="tour-preview-heading">
                <div>
                  <span className="tour-preview-date">MONDAY, YOUR WAY</span>
                  <h2>{step === 0 ? 'A clear place to start.' : step === 1 ? 'One thing at a time.' : 'Look how far you’ve come.'}</h2>
                  <p>
                    {step === 0 && 'Gather everything you want to remember.'}
                    {step === 1 && 'Add details, a priority, or a due date.'}
                    {step === 2 && 'Check off a task and make progress visible.'}
                  </p>
                </div>
                <span className="tour-progress-ring" aria-label="Two of three tasks complete">
                  <strong>{step === 2 ? '67%' : step === 1 ? '33%' : '0%'}</strong>
                  <small>done</small>
                </span>
              </div>

              <div className="tour-task-list" aria-live="polite">
                <div className={`tour-task ${step >= 1 ? 'tour-task-active' : ''}`}>
                  <span className={`tour-check ${step >= 1 ? 'checked' : ''}`}>{step >= 1 ? '✓' : ''}</span>
                  <span className={step >= 1 ? 'tour-task-done' : ''}>Plan the week</span>
                  <small className="tour-priority">HIGH</small>
                </div>
                <div className={`tour-task ${step >= 2 ? 'tour-task-active' : ''}`}>
                  <span className={`tour-check ${step >= 2 ? 'checked' : ''}`}>{step >= 2 ? '✓' : ''}</span>
                  <span className={step >= 2 ? 'tour-task-done' : ''}>Make time for a break</span>
                  <small className="tour-category">PERSONAL</small>
                </div>
                <div className="tour-task">
                  <span className="tour-check" />
                  <span>Finish one small thing</span>
                  <small className="tour-due">TODAY</small>
                </div>
              </div>
              <div className="tour-preview-footer">
                <span><b /> Every task has a place</span>
                <span>01 / 03</span>
              </div>
            </div>
            <div className="tour-controls">
              <button
                type="button"
                className="tour-play-button"
                onClick={togglePlayback}
                aria-label={playing ? 'Pause video' : seconds >= TOUR_DURATION ? 'Replay video' : 'Play video'}
              >
                {playing ? 'Ⅱ' : '▶'}
              </button>
              <div
                className="tour-progress-track"
                role="progressbar"
                aria-label="Video progress"
                aria-valuemin="0"
                aria-valuemax={TOUR_DURATION}
                aria-valuenow={seconds}
              >
                <span style={{ width: `${(seconds / TOUR_DURATION) * 100}%` }} />
              </div>
              <span className="tour-clock">0:{String(seconds).padStart(2, '0')} / 0:15</span>
              {seconds >= TOUR_DURATION && (
                <button type="button" className="tour-replay-button" onClick={replay}>Replay</button>
              )}
            </div>
          </div>
          <p className="tour-caption">A 15-second look at a calmer way to organize your day</p>
        </section>
      </section>
      <section className="welcome-features" aria-label="Team task management features">
        <article>
          <span className="feature-icon feature-icon-purple" aria-hidden="true">✳</span>
          <div><h2>Everything in one place</h2><p>Keep task details, categories, and due dates together.</p></div>
        </article>
        <article>
          <span className="feature-icon feature-icon-blue" aria-hidden="true">↗</span>
          <div><h2>Your priorities, your pace</h2><p>Pick what matters today, then move through it one task at a time.</p></div>
        </article>
        <article>
          <span className="feature-icon feature-icon-green" aria-hidden="true">✓</span>
          <div><h2>Progress you can feel</h2><p>Celebrate completed tasks and keep your next step in sight.</p></div>
        </article>
      </section>
      <footer className="welcome-footer">One shared workspace to plan, manage, and complete team tasks.</footer>
    </main>
  );
}

export default WelcomePage;
