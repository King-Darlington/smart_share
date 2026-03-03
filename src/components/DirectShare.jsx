import React, { useState } from "react";

export default function DirectShare({ user, onSend }) {
  const [files, setFiles] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => {
    setFiles(e.target.files);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!files || files.length === 0) return;
    setBusy(true);
    onSend(user, files, () => setBusy(false));
  };

  return (
    <div className="direct-share card p-3 mb-3">
      <h6 className="mb-2">Send files to {user.name}</h6>
      <form onSubmit={handleSubmit}>
        <input type="file" multiple className="form-control mb-2" onChange={handleChange} />
        <button type="submit" className="btn btn-primary w-100" disabled={busy || !files}>
          {busy ? "Sending..." : "Send Files"}
        </button>
      </form>
    </div>
  );
}
