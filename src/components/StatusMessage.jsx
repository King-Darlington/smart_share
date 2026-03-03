import React from "react";

export default function StatusMessage({ message }) {
  return (
    <div className="mt-4">
      <div className="alert alert-info py-2 px-3 small mb-0">
        {message}
      </div>
    </div>
  );
}
