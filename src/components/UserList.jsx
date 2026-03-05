import React, { useState } from "react";

export default function UserList({ users, connections = [], currentUserId, onConnect }) {
  const [search, setSearch] = useState("");
  const filtered = users
    .filter(u => u && u.id && u.name && !u.password) // Only valid users without password
    .filter(u => u.id !== currentUserId) // Hide current user
    .filter(u => {
      const nameOrEmail = (u.name || "" ).toLowerCase();
      return nameOrEmail.includes(search.toLowerCase());
    });

  const isConnected = (userId) => connections.some(c => c.id === userId);

  return (
    <div className="user-list card p-3 mb-4">
      <h5 className="mb-3">Users</h5>
      <input
        type="text"
        className="form-control mb-2"
        placeholder="Search users..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <ul className="list-group">
        {filtered.length === 0 ? (
          <li className="list-group-item text-muted">No users found</li>
        ) : (
          filtered.map(user => {
            const connected = isConnected(user.id);
            return (
              <li key={user.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>{user.name || user.email || "(unknown)"}</span>
                {connected ? (
                  <span className="badge bg-success">Connected</span>
                ) : (
                  <button className="btn btn-outline-success btn-sm" onClick={() => onConnect(user)}>
                    Connect
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
