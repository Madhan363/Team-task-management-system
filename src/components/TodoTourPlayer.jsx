import { useEffect, useState } from 'react';

function TodoTourPlayer({ autoPlay = false }) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((currentSeconds) => {
        if (currentSeconds >= 12) {
          setIsPlaying(false);
          return 12;
        }
        return currentSeconds + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const replay = () => {
    setSeconds(0);
    setIsPlaying(true);
  };

  return (
    <div className="tour-player" aria-label="Animated introduction to the to-do list">
      <div className="tour-player-topbar">
        <span className="tour-player-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>YOUR PRIVATE TASK SPACE</span>
        <span className="tour-live-dot" aria-hidden="true" />
      </div>
      <div className="tour-demo-content">
        <div className="tour-demo-copy" key={Math.floor(seconds / 4)}>
          <span className="tour-step-number">0{Math.min(Math.floor(seconds / 4) + 1, 3)} / 03</span>
          <h2>
            {seconds < 4 && 'Capture what’s on your mind.'}
            {seconds >= 4 && seconds < 8 && 'Celebrate each little win.'}
            {seconds >= 8 && 'See your progress add up.'}
          </h2>
          <p>
            {seconds < 4 && 'Add a task in seconds and give your plans a home.'}
            {seconds >= 4 && seconds < 8 && 'Check things off and keep moving at your own pace.'}
            {seconds >= 8 && 'Your personal dashboard keeps the day in perspective.'}
          </p>
        </div>
        <div className="tour-task-card" aria-hidden="true">
          <div className="tour-task-card-heading">
            <span>Today</span>
            <span className="tour-task-count">
              {seconds >= 8 ? '2 of 3 done' : seconds >= 4 ? '1 of 3 done' : '3 tasks'}
            </span>
          </div>
          <div className={`tour-task-row ${seconds >= 4 ? 'is-done' : ''}`}>
            <span className="tour-task-check">{seconds >= 4 ? '✓' : ''}</span>
            <span>Plan the week</span>
          </div>
          <div className={`tour-task-row ${seconds >= 8 ? 'is-done' : ''}`}>
            <span className="tour-task-check">{seconds >= 8 ? '✓' : ''}</span>
            <span>Make time for a break</span>
          </div>
          <div className="tour-task-row">
            <span className="tour-task-check" />
            <span>Finish one small thing</span>
          </div>
        </div>
      </div>
      <div className="tour-player-controls">
        <button
          type="button"
          className="tour-control-btn"
          onClick={() => {
            if (seconds >= 12) {
              replay();
            } else {
              setIsPlaying((playing) => !playing);
            }
          }}
          aria-label={isPlaying ? 'Pause tour' : seconds >= 12 ? 'Replay tour' : 'Play tour'}
        >
          {isPlaying ? 'Ⅱ' : '▶'}
        </button>
        <div
          className="tour-progress-track"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin="0"
          aria-valuemax="12"
          aria-valuenow={seconds}
        >
          <span style={{ width: `${(seconds / 12) * 100}%` }} />
        </div>
        <span className="tour-time">{`0:${String(seconds).padStart(2, '0')} / 0:12`}</span>
      </div>
    </div>
  );
}

export default TodoTourPlayer;
