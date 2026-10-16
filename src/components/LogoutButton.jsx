import { useState } from 'react';

function LogoutButton({ onLogout, className = 'logout-button' }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setConfirming(true)}>
        Log out
      </button>
      {confirming && (
        <div className="logout-modal-backdrop">
          <section className="logout-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title">
            <h2 id="logout-title">Are you sure you want to log out?</h2>
            <div>
              <button type="button" onClick={async () => {
                await onLogout();
                setConfirming(false);
              }}>
                Yes, Logout
              </button>
              <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default LogoutButton;
