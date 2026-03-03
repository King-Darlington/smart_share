import React from "react";

export default function RoomList({ rooms, selectedRoomId, onSelectRoom, loading }) {
  return (
    <div className="mt-3" style={{ maxHeight: "50vh", overflowY: "auto" }}>
      {loading && <p className="text-muted small">⏳ Loading rooms...</p>}

      {!loading && rooms.length === 0 && (
        <div className="alert alert-secondary text-center mb-3">
          <p className="mb-0">No rooms yet. Create one to start! 🚀</p>
        </div>
      )}

      {rooms.map((room) => {
        const isActive = selectedRoomId === room.id;
        return (
          <div
            key={room.id}
            className={`room-item ${isActive ? "active" : ""}`}
            onClick={() => onSelectRoom(room.id)}
          >
            <h5 className="room-title mb-2">{room.name}</h5>
            <p className="room-desc mb-2">
              {room.description || "No description provided"}
            </p>
            <div>
              <span className="room-badge">Creator: {room.creator_name}</span>
              <span className="room-badge">Sharers: {room.max_sharers}</span>
              <span className="room-badge">Files: {room.max_files_per_user}/user</span>
              <span className="room-badge">Max: {room.max_file_size_mb}MB</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
