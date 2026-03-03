import React from "react";

export default function RoomForm({ form, onFormChange, onSubmit, busyMessage, envReady }) {
  const handleNameChange = (e) => {
    onFormChange({ ...form, name: e.target.value });
  };

  const handleDescriptionChange = (e) => {
    onFormChange({ ...form, description: e.target.value });
  };

  const handleMaxSharersChange = (e) => {
    onFormChange({ ...form, maxSharers: Number(e.target.value) || 1 });
  };

  const handleMaxFilesPerUserChange = (e) => {
    onFormChange({ ...form, maxFilesPerUser: Number(e.target.value) || 1 });
  };

  const handleMaxFileSizeMbChange = (e) => {
    onFormChange({ ...form, maxFileSizeMb: Number(e.target.value) || 1 });
  };

  return (
    <form onSubmit={onSubmit} className="mt-4 card p-4">
      <h2 className="h5 mb-3">Create Share Room</h2>

      <div className="mb-3">
        <input
          type="text"
          required
          placeholder="Room name"
          value={form.name}
          onChange={handleNameChange}
          className="form-control"
        />
      </div>

      <div className="mb-3">
        <textarea
          placeholder="Purpose, constraints, or onboarding instructions"
          value={form.description}
          onChange={handleDescriptionChange}
          className="form-control"
          rows={3}
        />
      </div>

      <div className="row g-3">
        <div className="col-sm-4">
          <label className="form-label small">Max sharers</label>
          <input
            type="number"
            min={1}
            max={200}
            value={form.maxSharers}
            onChange={handleMaxSharersChange}
            className="form-control"
          />
        </div>
        <div className="col-sm-4">
          <label className="form-label small">Max files/user</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={form.maxFilesPerUser}
            onChange={handleMaxFilesPerUserChange}
            className="form-control"
          />
        </div>
        <div className="col-sm-4">
          <label className="form-label small">Max file size (MB)</label>
          <input
            type="number"
            min={1}
            max={10240}
            value={form.maxFileSizeMb}
            onChange={handleMaxFileSizeMbChange}
            className="form-control"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!envReady || Boolean(busyMessage)}
        className="btn btn-primary w-100 mt-3"
      >
        {busyMessage || "Create room"}
      </button>
    </form>
  );
}
