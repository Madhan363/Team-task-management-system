import { useEffect } from 'react';
import { api } from '../api';

const PRESENCE_INTERVAL_MS = 2 * 60_000;
const ACTIVITY_SEND_INTERVAL_MS = 15_000;

function ActivityTracker({ userId }) {
  useEffect(() => {
    if (!userId) return undefined;

    let active = true;
    let sessionReady = false;
    let lastActivitySentAt = 0;
    let lastErrorAt = 0;
    let presenceTimer;

    const reportTrackingError = (error) => {
      const now = Date.now();
      if (now - lastErrorAt >= 60_000) {
        console.error('Activity tracking request failed; it will retry on the next application interaction.', error);
        lastErrorAt = now;
      }
    };

    const sendActivity = async () => {
      const now = Date.now();
      if (!active || !sessionReady || now - lastActivitySentAt < ACTIVITY_SEND_INTERVAL_MS) return;
      lastActivitySentAt = now;
      try {
        await api.recordActivity();
      } catch (error) {
        reportTrackingError(error);
      }
    };

    const sendPresence = async () => {
      if (!active || !sessionReady) return;
      try {
        await api.recordPresence();
      } catch (error) {
        reportTrackingError(error);
      }
    };

    const onInteraction = () => {
      void sendActivity();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void sendPresence();
    };

    let retryTimer;
    const initialize = async () => {
      try {
        await api.startActivitySession();
        if (!active) return;
        sessionReady = true;
        void sendPresence();
        presenceTimer = window.setInterval(() => void sendPresence(), PRESENCE_INTERVAL_MS);
      } catch (error) {
        reportTrackingError(error);
        if (active) retryTimer = window.setTimeout(initialize, 10_000);
      }
    };

    window.addEventListener('pointerdown', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction);
    window.addEventListener('scroll', onInteraction, { passive: true });
    window.addEventListener('touchstart', onInteraction, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    void initialize();

    return () => {
      active = false;
      window.clearTimeout(retryTimer);
      window.clearInterval(presenceTimer);
      window.removeEventListener('pointerdown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
      window.removeEventListener('scroll', onInteraction);
      window.removeEventListener('touchstart', onInteraction);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [userId]);

  return null;
}

export default ActivityTracker;
