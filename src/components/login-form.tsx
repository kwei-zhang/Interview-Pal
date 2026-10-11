"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, AudioLines, LockKeyhole } from "lucide-react";
export function LoginForm({configured}: {configured: boolean}) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const login = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email, password})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to sign in.");
      window.location.assign("/");
    } catch (e) {setError(e instanceof Error ? e.message : "Unable to sign in."); setLoading(false);}
  };
  return <div className="setup-page"><div className="setup-card"><Link className="brand" href="/"><span className="brand-symbol"><AudioLines size={22}/></span><span>interview<span className="brand-light">pal</span><span className="brand-dot">.</span></span></Link><span className="eyebrow">YOUR PRIVATE PRACTICE SPACE</span><h1>Ready for your next step?</h1><p>Sign in to your provisioned account to continue your preparation.</p>{configured ? <form onSubmit={event => void login(event)}><label htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} maxLength={254}/><label htmlFor="login-password">Password</label><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} maxLength={200}/>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary login-button" disabled={loading} type="submit">{loading ? "Signing in…" : "Sign in"}<ArrowRight size={14}/></button></form> : <div className="info-box"><LockKeyhole size={17}/><span>Private login is not configured yet. Follow the README to connect Supabase and provision your account. The local development preview is available from the overview.</span></div>}<p className="field-hint" style={{marginBottom: 0}}>Personal workspace · public signup is disabled.</p></div></div>;
}
