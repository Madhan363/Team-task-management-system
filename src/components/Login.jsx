import { useState } from 'react';

const AVATAR_COLORS = [
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Rose', value: '#e11d48' },
];

function Login({ users, onLogin, onCreateProfile, onDeleteProfile }) {
  const [isCreatingNew, setIsCreatingNew] = useState(users.length === 0);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].value);
  const [error, setError] = useState('');

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a profile name.');
      return;
    }
    if (users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A profile with this name already exists.');
      return;
    }

    const newUser = {
      id: `user_${Date.now()}`,
      name: trimmed,
      avatarColor: selectedColor,
      createdAt: Date.now(),
    };

    onCreateProfile(newUser);
    setName('');
    setError('');
  };

  const getInitials = (userName) => {
    return userName
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className="header-badge">
          <svg
            className="badge-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Multi-Profile Workspace</span>
        </div>
        <h1 className="login-title">Select Your Profile</h1>
        <p className="login-subtitle">
          Your tasks are 100% private. Only you can view and manage your to-do list.
        </p>
      </div>

      {users.length > 0 && !isCreatingNew && (
        <div className="profile-selector">
          <h2 className="section-label">Available Profiles</h2>
          <div className="profile-grid">
            {users.map((user) => (
              <div
                key={user.id}
                className="profile-card"
                onClick={() => onLogin(user)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onLogin(user);
                  }
                }}
                aria-label={`Log in as ${user.name}`}
              >
                <div
                  className="profile-avatar"
                  style={{ backgroundColor: user.avatarColor || '#7c3aed' }}
                >
                  {getInitials(user.name)}
                </div>
                <div className="profile-info">
                  <span className="profile-name">{user.name}</span>
                  <span className="profile-action">Click to access tasks →</span>
                </div>
                {users.length > 1 && (
                  <button
                    type="button"
                    className="profile-delete-btn"
                    title={`Delete ${user.name}'s profile`}
                    aria-label={`Delete ${user.name}'s profile`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete profile "${user.name}" and all their tasks?`)) {
                        onDeleteProfile(user.id);
                      }
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="create-toggle-btn"
            onClick={() => {
              setIsCreatingNew(true);
              setError('');
            }}
          >
            + Create New Profile
          </button>
        </div>
      )}

      {(isCreatingNew || users.length === 0) && (
        <form className="create-profile-form" onSubmit={handleCreateSubmit}>
          <div className="form-top-row">
            <h2 className="section-label">
              {users.length === 0 ? 'Create Your Profile' : 'New Profile'}
            </h2>
            {users.length > 0 && (
              <button
                type="button"
                className="back-btn"
                onClick={() => {
                  setIsCreatingNew(false);
                  setError('');
                }}
              >
                ← Back to profiles
              </button>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="profile-name-input" className="form-label">
              Profile Name
            </label>
            <input
              id="profile-name-input"
              type="text"
              className="login-input"
              placeholder="e.g. Alex, Sarah, Personal"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Avatar Color Theme</label>
            <div className="color-picker-group">
              {AVATAR_COLORS.map((col) => (
                <button
                  key={col.value}
                  type="button"
                  className={`color-choice ${selectedColor === col.value ? 'selected' : ''}`}
                  style={{ backgroundColor: col.value }}
                  onClick={() => setSelectedColor(col.value)}
                  aria-label={`Theme ${col.name}`}
                />
              ))}
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="login-submit-btn">
            Create Profile & Continue
          </button>
        </form>
      )}
    </div>
  );
}

export default Login;
