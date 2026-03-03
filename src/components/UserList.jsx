import React, { useState } from "react";

export default function UserList({ users, onConnect }) {
  const [search, setSearch] = useState("");
  const filtered = users.filter(u => {
    const nameOrEmail = (u.name || "" ).toLowerCase();
    return nameOrEmail.includes(search.toLowerCase());
  });

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
          filtered.map(user => (
            <li key={user.id} className="list-group-item d-flex justify-content-between align-items-center">
              <span>{user.name || user.email || "(unknown)"}</span>
              <button className="btn btn-outline-success btn-sm" onClick={() => onConnect(user)}>
                Connect
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
