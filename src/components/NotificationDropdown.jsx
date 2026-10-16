import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, Clock, Trash2 } from 'lucide-react';
import { api } from '../api';

function NotificationDropdown({ onSelectTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState('');
  const [clearingNotifications, setClearingNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setNotificationError('');
    } catch (err) {
      setNotificationError(err.message || 'Failed to load notifications.');
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAsRead = async (id, event) => {
    event?.stopPropagation();
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearNotifications = async () => {
    setClearingNotifications(true);
    setNotificationError('');
    try {
      await api.clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      setNotificationError(err.message || 'Failed to clear notifications.');
    } finally {
      setClearingNotifications(false);
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="tf-notification-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className="tf-icon-btn tf-bell-btn"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="tf-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="tf-notification-dropdown">
          <div className="tf-notification-header">
            <div className="tf-notification-title">
              <h4>Notifications</h4>
              {unreadCount > 0 && (
                <span className="tf-pill-badge">{unreadCount} unread</span>
              )}
            </div>
            <div className="tf-notification-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="tf-btn-link"
                  onClick={handleMarkAllAsRead}
                >
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
              <button
                type="button"
                className="tf-btn-link"
                onClick={handleClearNotifications}
                disabled={clearingNotifications || notifications.length === 0}
                aria-label="Clear all your notifications"
              >
                <Trash2 size={14} /> {clearingNotifications ? 'Clearing…' : 'Clear'}
              </button>
            </div>
          </div>

          {notificationError && (
            <p className="tf-notification-error" role="alert">{notificationError}</p>
          )}

          <div className="tf-notification-list">
            {notifications.length === 0 ? (
              <div className="tf-notification-empty">
                <Bell size={32} className="tf-empty-icon" />
                <p>No notifications yet</p>
                <span>Updates about story and task assignments and progress will appear here.</span>
              </div>
            ) : (
              notifications.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className={`tf-notification-item ${!item.isRead ? 'tf-unread' : ''} ${item.meetingId || item.roomId ? 'tf-notification-meeting' : ''}`}
                  onClick={(event) => {
                    if (!item.isRead) handleMarkAsRead(item.id, event);
                    if (item.meetingId || item.roomId) {
                      setIsOpen(false);
                      onSelectTab?.('meetings');
                    }
                  }}
                  role={item.meetingId || item.roomId ? 'button' : undefined}
                  tabIndex={item.meetingId || item.roomId ? 0 : undefined}
                  onKeyDown={(event) => {
                    if ((event.key === 'Enter' || event.key === ' ')
                      && (item.meetingId || item.roomId)) {
                      event.preventDefault();
                      if (!item.isRead) handleMarkAsRead(item.id, event);
                      setIsOpen(false);
                      onSelectTab?.('meetings');
                    }
                  }}
                >
                  <div className="tf-notif-indicator">
                    {!item.isRead && <span className="tf-dot-unread" />}
                  </div>
                  <div className="tf-notif-content">
                    <div className="tf-notif-title-row">
                      <strong>{item.title}</strong>
                      <span className="tf-notif-time">
                        <Clock size={11} /> {formatTime(item.createdAt)}
                      </span>
                    </div>
                    <p>{item.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationDropdown;
