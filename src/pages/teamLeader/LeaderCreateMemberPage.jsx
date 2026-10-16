import { useState, useEffect } from 'react';
import { UserPlus, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import { api } from '../../api';

function LeaderCreateMemberPage({ onNavigateTab }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    // Load leader's department info
    api.getTeamLeaderDashboard()
      .then((res) => {
        if (res.department) {
          setDepartment(res.department);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!name.trim() || !username.trim() || !email.trim() || !password) {
      setFormError('Please fill in all member fields.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      // Use createTeamMember endpoint (verified on backend for department authorization)
      await api.createTeamMember({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        departmentId: department?.id,
      });

      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setFormSuccess(
        `Team Member account created and assigned to "${department?.name || 'your department'}".`,
      );
    } catch (err) {
      setFormError(err.message || 'Failed to create team member.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tf-page-container">
      <div className="tf-page-header">
        <div>
          <h2>Create Department Member</h2>
          <p>
            Add a new team member directly to <strong>{department?.name || 'your department'}</strong>.
            New members are automatically assigned the Team Member role.
          </p>
        </div>
        <button
          type="button"
          className="tf-btn tf-btn-secondary"
          onClick={() => onNavigateTab?.('team')}
        >
          <ArrowLeft size={16} /> Back to Team
        </button>
      </div>

      <div className="tf-card tf-form-card tf-form-centered">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <UserPlus size={20} className="tf-accent-icon" />
            <h3>Member Registration Form</h3>
          </div>
          <span className="tf-card-subtitle">
            Role will automatically default to Team Member in your department.
          </span>
        </div>

        {formError && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="tf-alert tf-alert-success" role="status">
            <CheckCircle size={18} />
            <span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="tf-grid-form">
          <div className="tf-form-group">
            <label htmlFor="member-name">Full Name *</label>
            <input
              id="member-name"
              type="text"
              className="tf-input"
              placeholder="e.g. David Ross"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="member-username">Username *</label>
            <input
              id="member-username"
              type="text"
              className="tf-input"
              placeholder="e.g. david_ross"
              minLength={3}
              maxLength={30}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <span className="tf-form-help">3–30 letters, numbers, or _</span>
          </div>

          <div className="tf-form-group">
            <label htmlFor="member-email">Email Address *</label>
            <input
              id="member-email"
              type="email"
              className="tf-input"
              placeholder="david@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="member-password">Initial Password *</label>
            <input
              id="member-password"
              type="password"
              className="tf-input"
              placeholder="Min 8 characters"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group tf-full-width">
            <label>Department Assignment</label>
            <input
              type="text"
              className="tf-input"
              value={department?.name || 'Current Department (Authorized)'}
              disabled
              readOnly
            />
            <span className="tf-form-help">Locked to your authorized department jurisdiction.</span>
          </div>

          <div className="tf-form-actions-bottom">
            <button
              type="submit"
              className="tf-btn tf-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating Member…' : 'Register Team Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeaderCreateMemberPage;
