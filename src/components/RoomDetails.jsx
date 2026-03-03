import React, { useState } from "react";
import { formatBytes, formatDateTime } from "@/utils/formatting";

export default function RoomDetails({
  room,
  hasJoined,
  members,
  files,
  loading,
  busyMessage,
  envReady,
  onJoin,
  onUpload,
  onDownload,
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
            disabled={Boolean(busyMessage) || !envReady}
            className="btn btn-warning btn-sm"
          >
            {hasJoined ? "✓ Joined" : "📍 Join Room"}
          </button>
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
                  <input
                    type="file"
                    name="roomFile"
                    className="form-control mb-2"
                    onChange={(e) => {
                      const file = e.currentTarget.files && e.currentTarget.files[0];
                      setSelectedFile(file || null);
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
                <div key={file.id} className="file-item">
                  <div className="flex-grow-1">
                    <div className="file-name">{file.file_name}</div>
                    <div className="file-meta">
                      {file.uploader_name} · {formatBytes(file.file_size)} · {formatDateTime(file.created_at)}
                    </div>
                  </div>
                  <button
                    onClick={() => onDownload(file)}
                    className="btn btn-sm btn-outline-primary"
                  >
                    ⬇️ Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
