import React, { useState } from "react";

export default function AuthForm({ onAuth }) {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password required");
      return;
    }
    setError("");
    onAuth({ email, password, mode });
  };

  return (
    <div className="auth-form card p-4 mb-4">
      <h5 className="mb-3">{mode === "signup" ? "Sign Up" : "Login"}</h5>
      <form onSubmit={handleSubmit}>
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
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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
