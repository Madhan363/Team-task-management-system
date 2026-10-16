import { useState } from 'react';
import {
  Calendar,
  Share2,
  Download,
  Upload,
  Check,
  ExternalLink,
  X,
  Webhook,
  Zap,
} from 'lucide-react';
import { downloadAllTasksIcs } from '../services/calendarExport';

function IntegrationsModal({ isOpen, onClose, tasks = [] }) {
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('tf_webhook_url') || '');
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState('');

  if (!isOpen) return null;

  const handleSaveWebhook = (e) => {
    e.preventDefault();
    localStorage.setItem('tf_webhook_url', webhookUrl.trim());
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 2500);
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setTestingWebhook(true);
    setWebhookStatus('');
    try {
      await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'taskflow.test',
          message: 'TaskFlow Webhook Integration Test Payload',
          timestamp: new Date().toISOString(),
          app: 'TaskFlow Enterprise',
        }),
        mode: 'no-cors',
      });
      setWebhookStatus('Test payload dispatched successfully!');
    } catch (err) {
      setWebhookStatus(`Failed to send webhook: ${err.message}`);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'taskflow-export.json');
    dlAnchor.click();
  };

  return (
    <div className="tf-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tf-modal-container tf-integrations-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div>
            <h2>Integrations & External Sync</h2>
            <p>Connect TaskFlow with your calendar, communication tools, and project management apps.</p>
          </div>
          <button type="button" className="tf-modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="tf-integrations-grid">
          {/* 1. Google Calendar / iCal */}
          <div className="tf-integration-card">
            <div className="tf-integration-icon-box tf-icon-blue">
              <Calendar size={22} />
            </div>
            <div className="tf-integration-body">
              <h3>Google Calendar & iCal (.ics)</h3>
              <p>Sync all task deadlines and milestones directly with Google Calendar, Outlook, or Apple Calendar.</p>
              <div className="tf-integration-actions">
                <button
                  type="button"
                  className="tf-btn tf-btn-sm tf-btn-primary"
                  onClick={() => downloadAllTasksIcs(tasks)}
                >
                  <Download size={14} /> Download .ICS Calendar
                </button>
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tf-btn tf-btn-sm tf-btn-secondary"
                >
                  <ExternalLink size={14} /> Open Google Calendar
                </a>
              </div>
            </div>
          </div>

          {/* 2. Webhooks (Slack / Discord / Custom) */}
          <div className="tf-integration-card">
            <div className="tf-integration-icon-box tf-icon-purple">
              <Webhook size={22} />
            </div>
            <div className="tf-integration-body">
              <h3>Webhook Notifications (Slack / Discord)</h3>
              <p>Receive real-time automated notifications in your team channel whenever tasks are created or reviewed.</p>
              <form onSubmit={handleSaveWebhook} className="tf-integration-webhook-form">
                <input
                  type="url"
                  className="tf-input"
                  placeholder="https://discord.com/api/webhooks/... or Slack URL"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <div className="tf-integration-actions">
                  <button type="submit" className="tf-btn tf-btn-sm tf-btn-primary">
                    {webhookSaved ? <><Check size={14} /> Saved!</> : 'Save Webhook'}
                  </button>
                  <button
                    type="button"
                    className="tf-btn tf-btn-sm tf-btn-secondary"
                    onClick={handleTestWebhook}
                    disabled={testingWebhook || !webhookUrl}
                  >
                    <Zap size={14} /> Test Dispatch
                  </button>
                </div>
              </form>
              {webhookStatus && <p className="tf-webhook-status">{webhookStatus}</p>}
            </div>
          </div>

          {/* 3. Jira / Trello / Asana Import & Export */}
          <div className="tf-integration-card">
            <div className="tf-integration-icon-box tf-icon-emerald">
              <Share2 size={22} />
            </div>
            <div className="tf-integration-body">
              <h3>Data Migration & External Tools</h3>
              <p>Export task backups in JSON/CSV for Jira, Trello, Asana, or spreadsheet analysis.</p>
              <div className="tf-integration-actions">
                <button
                  type="button"
                  className="tf-btn tf-btn-sm tf-btn-secondary"
                  onClick={handleExportJson}
                >
                  <Download size={14} /> Export JSON Data
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="tf-modal-footer">
          <button type="button" className="tf-btn tf-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default IntegrationsModal;
