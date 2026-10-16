import { useState } from 'react';

function ProfileEditor({ user, onSave, onCancel }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [email, setEmail] = useState(user.email || '');
  const [profileImage, setProfileImage] = useState(user.profileImage || null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectProfileImage = (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPEG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 1_048_576) {
      setError('Profile pictures must be 1 MB or smaller.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Could not read the selected profile picture.');
        return;
      }
      setProfileImage(reader.result);
      setError('');
    };
    reader.onerror = () => setError('Could not read the selected profile picture.');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const submitProfile = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave({ name, username, email, profileImage });
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="profile-form" onSubmit={submitProfile}>
      <div className="profile-form-heading">
        <h2>Profile details</h2>
        <p>Update the account information shown on your task page.</p>
      </div>

      {error && <p className="global-error" role="alert">{error}</p>}

      <div className="profile-picture-field">
        <div className="profile-picture-preview">
          {profileImage ? (
            <img src={profileImage} alt="Profile preview" />
          ) : (
            <span aria-hidden="true">
              {name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          )}
        </div>
        <div className="profile-picture-controls">
          <label className="task-action-button profile-picture-upload">
            <span>{profileImage ? 'Change picture' : 'Add picture'}</span>
            <input
              accept="image/png,image/jpeg,image/webp"
              aria-label="Choose profile picture"
              onChange={selectProfileImage}
              type="file"
            />
          </label>
          {profileImage && (
            <button
              className="task-action-button"
              disabled={saving}
              onClick={() => {
                setProfileImage(null);
                setError('');
              }}
              type="button"
            >
              Remove picture
            </button>
          )}
          <small>PNG, JPEG, or WebP. Maximum 1 MB.</small>
        </div>
      </div>

      <label className="profile-field">
        <span>Full name</span>
        <input
          autoComplete="name"
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>
      <label className="profile-field">
        <span>Username</span>
        <input
          autoComplete="username"
          maxLength={30}
          minLength={3}
          onChange={(event) => setUsername(event.target.value)}
          pattern="[A-Za-z0-9_]{3,30}"
          required
          value={username}
        />
        <small>Use 3–30 letters, numbers, or underscores.</small>
      </label>
      <label className="profile-field">
        <span>Email address</span>
        <input
          autoComplete="email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <div className="profile-form-actions">
        <button className="task-action-button" onClick={onCancel} type="button" disabled={saving}>
          Cancel
        </button>
        <button className="todo-submit-btn" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  );
}

export default ProfileEditor;
