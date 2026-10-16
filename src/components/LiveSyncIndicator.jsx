import { useState, useEffect } from 'react';
import { RefreshCw, Radio, CheckCircle, Bell } from 'lucide-react';
import { api } from '../api';

function LiveSyncIndicator({ onSyncComplete }) {
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => new Date());
  const [timeAgo, setTimeAgo] = useState('just now');
  const [toasts, setToasts] = useState([]);
  const [previousNotificationCount, setPreviousNotificationCount] = useState(null);

  const performSync = async (manual = false) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const data = await api.getNotifications();
      const currentUnread = data.unreadCount || 0;

      // Detect incoming real-time notifications
      if (previousNotificationCount !== null && currentUnread > previousNotificationCount) {
        const latest = data.notifications?.[0];
        if (latest) {
          triggerToast(latest.title || 'New Notification', latest.message);
        }
      }
      setPreviousNotificationCount(currentUnread);
      setLastSynced(new Date());
      setTimeAgo('just now');
      onSyncComplete?.();
    } catch (err) {
      console.warn('Live sync poll warning:', err.message);
    } finally {
      setSyncing(false);
    }
  };

  const triggerToast = (title, message) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Poll every 10 seconds for real-time live sync
  useEffect(() => {
    performSync();
    const interval = setInterval(() => {
      performSync();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Update "time ago" string every 15s
  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = Math.floor((new Date() - lastSynced) / 1000);
      if (seconds < 20) setTimeAgo('just now');
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
    }, 15000);
    return () => clearInterval(timer);
  }, [lastSynced]);

  return (
    <>
      <div
        className="tf-live-sync-pill"
        onClick={() => performSync(true)}
        title="Real-time live sync is active. Click to refresh immediately."
        role="button"
        tabIndex={0}
      >
        <span className="tf-live-sync-dot">
          <span className="tf-live-sync-pulse" />
        </span>
        <span className="tf-live-sync-text">Live Sync</span>
        <span className="tf-live-sync-time">{syncing ? 'Syncing…' : timeAgo}</span>
        <RefreshCw size={11} className={`tf-live-sync-icon ${syncing ? 'tf-spin' : ''}`} />
      </div>

      {/* Real-time floating toast notifications */}
      {toasts.length > 0 && (
        <div className="tf-live-toast-container" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="tf-live-toast">
              <div className="tf-live-toast-icon">
                <Bell size={16} />
              </div>
              <div className="tf-live-toast-content">
                <strong>{toast.title}</strong>
                <p>{toast.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default LiveSyncIndicator;
