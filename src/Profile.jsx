import { useState } from "react";

export default function Profile({ user }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="profile">
      <img
        src={user.photoURL}
        onClick={() => setOpen(!open)}
        className="avatar"
      />

      {open && (
        <div className="dropdown">
          <img src={user.photoURL} className="bigAvatar" />
          <p>{user.displayName}</p>
          <p>{user.email}</p>
        </div>
      )}
    </div>
  );
}