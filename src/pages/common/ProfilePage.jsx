import { useState } from 'react';
import { User, Upload, CheckCircle, AlertCircle, Shield, Building2, ArrowLeft } from 'lucide-react';
import { api } from '../../api';

function ProfilePage({ user, onUserUpdated, onBack }) {
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Please choose a PNG, JPEG, or WebP image file.');
      return;
    }
    if (file.size > 1_048_576) {
      setError('Profile picture must be 1 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(reader.result);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setProfileImage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditing || saving) return;
    setError('');
    setNotice('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!username.trim() || !/^[a-z0-9_]{3,30}$/i.test(username.trim())) {
      setError('Username must be 3–30 characters using letters, numbers, or underscores.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (phoneNumber.trim() && !/^\+?[0-9().\-\s]{7,20}$/.test(phoneNumber.trim())) {
      setError('Enter a valid phone number, or leave the field blank.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.updateProfile({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim(),
        profileImage: profileImage || null,
      });

      if (res.user) {
        setName(res.user.name || '');
        setUsername(res.user.username || '');
        setEmail(res.user.email || '');
        setPhoneNumber(res.user.phoneNumber || '');
        setProfileImage(res.user.profileImage || '');
        setIsEditing(false);
        onUserUpdated?.(res.user);
        setNotice('Profile updated successfully!');
      }
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    setName(user?.name || '');
    setUsername(user?.username || '');
    setEmail(user?.email || '');
    setPhoneNumber(user?.phoneNumber || '');
    setProfileImage(user?.profileImage || '');
    setIsEditing(false);
    setError('');
    setNotice('');
  };

  return (
    <div className="tf-page-container tf-profile-page">
      <div className="tf-page-header">
        <div>
          <h2>Account Profile & Settings</h2>
          <p>Manage your account credentials, avatar, and personal details.</p>
        </div>
        <button type="button" className="tf-btn tf-btn-secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>

      <div className="tf-card tf-form-card tf-profile-page-card">
        <div className="tf-card-header">
          <div className="tf-card-title-row">
            <User size={20} className="tf-accent-icon" />
            <h3>{isEditing ? 'Edit Profile' : 'Personal Profile Details'}</h3>
          </div>
        </div>

        {error && (
          <div className="tf-alert tf-alert-error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {!isEditing && notice && (
          <div className="tf-alert tf-alert-success" role="status">
            <CheckCircle size={18} />
            <span>{notice}</span>
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="tf-grid-form">
          {/* Avatar Upload Preview */}
          <div className="tf-profile-avatar-row tf-full-width">
            <div className="tf-avatar tf-avatar-xl">
              {profileImage ? (
                <img src={profileImage} alt={name} />
              ) : (
                <span>{name.slice(0, 2).toUpperCase() || 'U'}</span>
              )}
            </div>
            <div className="tf-avatar-controls">
              <label htmlFor="avatar-file" className="tf-btn tf-btn-secondary tf-btn-sm tf-cursor-pointer">
                <Upload size={14} /> Upload Picture
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  disabled={!isEditing}
                  style={{ display: 'none' }}
                />
              </label>
              {isEditing && profileImage && (
                <button
                  type="button"
                  className="tf-btn tf-btn-sm tf-btn-danger"
                  onClick={handleRemoveImage}
                >
                  Remove Avatar
                </button>
              )}
              <span className="tf-form-help">PNG, JPEG, or WebP up to 1 MB.</span>
            </div>
          </div>

          <div className="tf-form-group">
            <label htmlFor="profile-name">Full Name</label>
            <input
              id="profile-name"
              type="text"
              className="tf-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="profile-username">Username</label>
            <input
              id="profile-username"
              type="text"
              className="tf-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="profile-email">Email Address</label>
            <input
              id="profile-email"
              type="email"
              className="tf-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="tf-form-group">
            <label htmlFor="profile-phone">Phone Number</label>
            <input
              id="profile-phone"
              type="tel"
              className="tf-input"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              maxLength={20}
              placeholder="Optional"
            />
          </div>

          <div className="tf-form-group">
            <label>Assigned Role</label>
            <div className="tf-read-only-field">
              <Shield size={16} />
              <span className="tf-capitalize">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>

          {user?.department?.name && (
            <div className="tf-form-group tf-full-width">
              <label>Assigned Department</label>
              <div className="tf-read-only-field">
                <Building2 size={16} />
                <span>{user.department.name}</span>
              </div>
            </div>
          )}

          <div className="tf-form-actions-bottom tf-full-width">
            <button type="submit" className="tf-btn tf-btn-primary" disabled={saving}>
              {saving ? 'Saving Changes…' : 'Save Changes'}
            </button>
            <button type="button" className="tf-btn tf-btn-secondary" onClick={cancelEditing} disabled={saving}>
              Cancel
            </button>
          </div>
          </form>
        ) : (
          <div className="tf-grid-form">
            <div className="tf-profile-avatar-row tf-full-width">
              <div className="tf-avatar tf-avatar-xl">
                {profileImage ? <img src={profileImage} alt={name} /> : <span>{name.slice(0, 2).toUpperCase() || 'U'}</span>}
              </div>
            </div>
            <div className="tf-form-group">
              <label>Full Name</label>
              <div className="tf-read-only-field">{user?.name || name}</div>
            </div>
            <div className="tf-form-group">
              <label>Username</label>
              <div className="tf-read-only-field">{user?.username || username}</div>
            </div>
            <div className="tf-form-group">
              <label>Email Address</label>
              <div className="tf-read-only-field">{user?.email || email}</div>
            </div>
            <div className="tf-form-group">
              <label>Phone Number</label>
              <div className="tf-read-only-field">{user?.phoneNumber || phoneNumber || 'Not provided'}</div>
            </div>
            <div className="tf-form-group">
              <label>Assigned Role</label>
              <div className="tf-read-only-field">
                <Shield size={16} />
                <span className="tf-capitalize">{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>
            {user?.department?.name && (
              <div className="tf-form-group tf-full-width">
                <label>Assigned Department</label>
                <div className="tf-read-only-field">
                  <Building2 size={16} />
                  <span>{user.department.name}</span>
                </div>
              </div>
            )}
            <div className="tf-form-actions-bottom tf-full-width">
              <button
                type="button"
                className="tf-btn tf-btn-primary"
                onClick={() => {
                  setError('');
                  setNotice('');
                  setIsEditing(true);
                }}
              >
                Update Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfilePage;
