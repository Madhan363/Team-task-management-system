import TodoTourPlayer from './TodoTourPlayer';

function TodoTour() {
  return (
    <main className="tour-page">
      <div className="ambient-orb orb-1" aria-hidden="true" />
      <div className="ambient-orb orb-2" aria-hidden="true" />
      <a className="tour-back-link" href="/">← Back to sign in</a>
      <section className="tour-page-content">
        <span className="tour-eyebrow">A QUICK LOOK</span>
        <h1 className="tour-page-title">A little more focus, every day.</h1>
        <p className="tour-page-subtitle">
          See how a few simple tasks can make room for what matters.
        </p>
        <TodoTourPlayer autoPlay />
        <p className="tour-note">Your plans stay yours. Sign in or create an account to get started.</p>
      </section>
    </main>
  );
}

export default TodoTour;
