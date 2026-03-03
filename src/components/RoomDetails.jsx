import React, { useState } from "react";
import { formatBytes, formatDateTime } from "@/utils/formatting";

export default function RoomDetails({
  room,
  hasJoined,
  hasPending,
  members,
  pendingMembers = [],
  files,
  loading,
  busyMessage,
  envReady,
  onJoin,
  onUpload,
  onDownload,
  onApproveMember,
  onDenyMember,
}) {
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h4 className="card-title mb-1">{room.name}</h4>
            <small className="text-muted">ID: {room.id}</small>
          </div>
          <button
            onClick={onJoin}
            disabled={Boolean(busyMessage) || !envReady || hasJoined || hasPending}
            className="btn btn-warning btn-sm"
          >
            {hasJoined ? "✓ Joined" : "📍 Join Room"}
          </button>
          {!hasJoined && hasPending && (
            <small className="text-muted ms-2">
              ⏳ Request pending
            </small>
          )}
        </div>

        {room.description && (
          <p className="text-muted small mb-3">{room.description}</p>
        )}

        <div className="row g-3 mb-4">
          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-subtitle mb-3">👥 Members ({members.length}/{room.max_sharers})</h6>
                {loading ? (
                  <p className="text-muted small">Loading...</p>
                ) : members.length === 0 ? (
                  <p className="text-muted small">No one joined yet</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {members.map((member) => (
                      <li key={member.id} className="list-group-item px-0 py-2">
                        {member.sharer_name}
                      </li>
                    ))}
                  </ul>
                )}
                {room.creator_name === members.find(m=>m.sharer_name===room.creator_name)?.sharer_name && pendingMembers.length>0 && (
                  <div className="mt-3">
                    <h6>Pending Requests</h6>
                    <ul className="list-group">
                      {pendingMembers.map(p => (
                        <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center">
                          {p.sharer_name}
                          <div>
                            <button className="btn btn-sm btn-success me-2" onClick={() => onApproveMember(p.id)}>Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => onDenyMember(p.id)}>Deny</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-subtitle mb-3">📤 Upload File</h6>
                <p className="text-muted small mb-3">
                  No compression. Files stored in original format.
                </p>
                <form onSubmit={onUpload}>
                  <div className="mb-2">
                    <label className="form-label small">Retention (days)</label>
                    <select name="retention" className="form-select form-select-sm" defaultValue={7}>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="file"
                    name="roomFile"
                    className="form-control mb-2"
                    multiple
                    onChange={(e) => {
                      const files = e.currentTarget.files;
                      setSelectedFile(files && files.length > 0 ? files : null);
                    }}
                  />
                  <button
                    type="submit"
                    disabled={
                      !selectedFile ||
                      Boolean(busyMessage) ||
                      !hasJoined ||
                      !envReady
                    }
                    className="btn btn-dark w-100 btn-sm"
                  >
                    {busyMessage || "Upload"}
                  </button>
                </form>
                {!hasJoined && (
                  <small className="text-danger d-block mt-1">
                    You must join the room before uploading.
                  </small>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h6 className="card-subtitle mb-3">📁 Shared Files ({files.length})</h6>
          {files.length === 0 ? (
            <p className="text-muted small">No files shared yet</p>
          ) : (
            <div>
              {files.map((file) => (
                <div key={file.id} className="file-item d-flex align-items-center mb-2">
                  <input type="checkbox" className="form-check-input me-2" value={file.id} onChange={e => {
                    // Track selected files for batch download
                    if (e.target.checked) {
                      setSelectedFile(prev => Array.isArray(prev) ? [...prev, file] : [file]);
                    } else {
                      setSelectedFile(prev => Array.isArray(prev) ? prev.filter(f => f.id !== file.id) : []);
                    }
                  }} />
                  <div className="flex-grow-1">
                    <div className="file-name">{file.file_name}</div>
                    <div className="file-meta">
                      {file.uploader_name} · {formatBytes(file.file_size)} · {formatDateTime(file.created_at)}
                      {file.expires_at && (
                        <> · expires {formatDateTime(file.expires_at)}</>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDownload([file])}
                    className="btn btn-sm btn-outline-primary"
                  >
                    ⬇️ Download
                  </button>
                </div>
              ))}
              {selectedFile && Array.isArray(selectedFile) && selectedFile.length > 1 && (
                <button
                  className="btn btn-primary mt-2"
                  onClick={() => onDownload(selectedFile)}
                >
                  ⬇️ Download Selected ({selectedFile.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
