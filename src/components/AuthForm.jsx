import React, { useState } from "react";

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password required");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Name required for signup");
      return;
    }
    setError("");
    onAuth({ name, email, password, mode });
  };

  return (
    <div className="auth-form card p-4 mb-4">
      <h5 className="mb-3">{mode === "signup" ? "Sign Up" : "Login"}</h5>
      <form onSubmit={handleSubmit}>
        {mode === "signup" && (
          <div className="mb-2">
            <input
              type="text"
              className="form-control"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={60}
              required={mode === "signup"}
            />
          </div>
        )}
        <div className="mb-2">
          <input
            type="email"
            className="form-control"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            maxLength={100}
            required
          />
        </div>
        <div className="mb-2">
          <input
            type="password"
            className="form-control"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <div className="text-danger small mb-2">{error}</div>}
        <button type="submit" className="btn btn-primary w-100 mb-2">
          {mode === "signup" ? "Sign Up" : "Login"}
        </button>
      </form>
      <button
        className="btn btn-link btn-sm"
        onClick={() => setMode(mode === "signup" ? "login" : "signup")}
      >
        {mode === "signup" ? "Already have an account? Login" : "New user? Sign Up"}
      </button>
    </div>
  );
}
