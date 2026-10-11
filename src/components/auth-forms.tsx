"use client";

import { appFetch, appPath } from "@/lib/paths";

import Link from "next/link";
import { useState } from "react";
import { AudioLines, ArrowRight, Check, LogOut } from "lucide-react";
import { announceAuthChange } from "@/lib/auth";

export function AuthCard({title, description, children}: {title: string; description: string; children: React.ReactNode}) {
  return <div className="setup-page"><div className="setup-card">
    <Link className="brand" href="/"><span className="brand-symbol"><AudioLines size={22}/></span><span>interview<span className="brand-light">pal</span><span className="brand-dot">.</span></span></Link>
    <span className="eyebrow">YOUR PRIVATE PRACTICE SPACE</span><h1>{title}</h1><p>{description}</p>{children}
  </div></div>;
}

type FormMode = "signup" | "resend" | "forgot-password" | "reset-password";
const copy: Record<FormMode, {title: string; description: string; button: string}> = {
  signup: {title: "Your next chapter starts here.", description: "Create your private workspace with the invitation sent to you. Use the email your invitation was issued for.", button: "Create account"},
  resend: {title: "Verify your email.", description: "Enter the email you used to register. We’ll send a fresh confirmation link if your account is awaiting verification.", button: "Resend confirmation"},
  "forgot-password": {title: "Let’s get you back in.", description: "Enter your account email to request a password reset link.", button: "Send reset link"},
  "reset-password": {title: "Choose a new password.", description: "Use at least 12 characters. You’ll sign in again after updating it.", button: "Update password"},
};
export function AuthForm({mode, configured, userId, accountEmail}: {mode: FormMode; configured: boolean; userId?: string; accountEmail?: string}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const details = copy[mode];
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if ((mode === "signup" || mode === "reset-password") && password !== confirmPassword) {setError("The passwords do not match."); return;}
    setLoading(true);
    try {
      const payload = mode === "signup" ? {email, password, displayName: name, inviteCode: code} : mode === "reset-password" ? {password} : {email};
      const response = await appFetch(`/api/auth/${mode}`, {method: "POST", headers: {"Content-Type": "application/json", ...(userId ? {"x-workspace-user-id": userId} : {})}, body: JSON.stringify(payload)});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Please retry shortly.");
      setPassword(""); setConfirmPassword(""); setCode(""); setSent(true); setResendAfter(Date.now() + 60000);
      if (mode === "reset-password") {announceAuthChange(); window.location.assign(appPath("/login?notice=password-updated"));}
    } catch (e) {setError(e instanceof Error ? e.message : "Please retry shortly.");}
    finally {setLoading(false);}
  };
  const resend = async () => {
    setError("");
    if (Date.now() < resendAfter) {setError("Wait one minute before requesting another email."); return;}
    setLoading(true);
    try {
      const response = await appFetch(`/api/auth/${mode === "forgot-password" ? "forgot-password" : "resend"}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({email})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to resend. Please retry.");
      setResendAfter(Date.now() + 60000);
    } catch (e) {setError(e instanceof Error ? e.message : "Unable to resend.");}
    finally {setLoading(false);}
  };
  return <AuthCard title={sent ? "Check your inbox." : details.title} description={sent ? `If this request is eligible, a ${mode === "forgot-password" ? "password reset" : "confirmation"} link will arrive at ${email.trim()}. Check your spam folder too.` : details.description}>
    {!configured ? <div className="info-box">Account registration requires Supabase. Follow the README to configure your project.</div> : sent ? <div role="status" className="auth-success"><Check size={18}/><span>{mode === "signup" ? "Your invitation is used once your account is created. Email verification does not need another code." : "You can close this page after opening the email."}</span></div> : <form onSubmit={event => void send(event)}>
      {mode === "signup" && <><label htmlFor="auth-name">Your name</label><input id="auth-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={200} required/><label htmlFor="auth-invite">Invitation code</label><input id="auth-invite" autoComplete="off" spellCheck={false} placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" value={code} onChange={e => setCode(e.target.value)} maxLength={100} required/></>}
      {mode !== "reset-password" ? <><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required/></> : <p className="field-hint">Updating the password for {accountEmail}.</p>}
      {(mode === "signup" || mode === "reset-password") && <><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={200} required/><label htmlFor="auth-confirm-password">Confirm password</label><input id="auth-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={12} maxLength={200} required/><p className="field-hint">At least 12 characters.</p></>}
      <button className="button button-primary login-button" type="submit" disabled={loading}>{loading ? "Please wait…" : details.button}<ArrowRight size={14}/></button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {sent && mode !== "reset-password" && <button className="button button-secondary full-width" disabled={loading} onClick={() => void resend()}>{loading ? "Sending…" : "Resend email"}</button>}
    <div className="auth-links"><Link href="/login">Back to sign in</Link>{mode === "signup" && <Link href="/verify-email">Already registered? Verify email</Link>}</div>
  </AuthCard>;
}

export function ConfirmEmail({tokenHash, type}: {tokenHash: string; type: "email" | "recovery" | null}) {
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const confirm = async () => {
    setLoading(true); setError("");
    try {
      const response = await appFetch("/api/auth/confirm", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({token_hash: tokenHash, type})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "This link could not be confirmed.");
      announceAuthChange(); window.location.replace(appPath(body.redirectTo));
    } catch (e) {setError(e instanceof Error ? e.message : "This link could not be confirmed."); setLoading(false);}
  };
  return <AuthCard title={type === "recovery" ? "Reset your password." : "Confirm your email."} description="Continue to securely complete the request from your email.">
    {tokenHash && type ? <button className="button button-primary full-width" disabled={loading} onClick={() => void confirm()}>{loading ? "Confirming…" : type === "recovery" ? "Continue to password reset" : "Confirm email"}</button> : <p className="form-error" role="alert">This link is incomplete or invalid.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="auth-links"><Link href={type === "recovery" ? "/forgot-password" : "/verify-email"}>Request a new email</Link><Link href="/login">Back to sign in</Link></div>
  </AuthCard>;
}

export function AccountAccess({userId}: {userId: string}) {
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const logout = async () => {
    setLoading(true);
    try {
      const response = await appFetch("/api/auth/logout", {method: "POST", headers: {"x-workspace-user-id": userId}});
      if (!response.ok) throw new Error("Could not sign out. Please reload and retry.");
      announceAuthChange(); window.location.assign(appPath("/login"));
    } catch (e) {setError(e instanceof Error ? e.message : "Unable to sign out."); setLoading(false);}
  };
  return <AuthCard title="Workspace access is unavailable." description="Your account needs verified, active membership. Contact the administrator if your email is already verified.">
    <button className="button button-secondary" disabled={loading} onClick={() => void logout()}><LogOut size={15}/>Sign out</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="auth-links"><Link href="/verify-email">Verify email</Link><Link href="/">Retry access</Link></div>
  </AuthCard>;
}
