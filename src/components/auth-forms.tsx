"use client";

import { appFetch, appPath } from "@/lib/paths";

import Link from "next/link";
import { useState } from "react";
import { AudioLines, ArrowRight, Check, LogOut } from "lucide-react";
import { announceAuthChange } from "@/lib/auth";

function AuthCard({title, description, children}: {title: string; description: string; children: React.ReactNode}) {
  return <div className="setup-page"><div className="setup-card">
    <Link className="brand" href="/"><span className="brand-symbol"><AudioLines size={22}/></span><span>interview<span className="brand-light">pal</span><span className="brand-dot">.</span></span></Link>
    <span className="eyebrow">YOUR PRIVATE PRACTICE SPACE</span><h1>{title}</h1><p>{description}</p>{children}
  </div></div>;
}

type FormMode = "signup" | "reconnect" | "resend" | "forgot-password" | "reset-password";
const copy: Record<FormMode, {title: string; description: string; button: string}> = {
  signup: {title: "Your next chapter starts here.", description: "Create your private workspace with the invitation sent to you. Use the email your invitation was issued for.", button: "Create account"},
  reconnect: {title: "Reconnect your existing account.", description: "Use your original email and choose a new password. Verify the emailed code to reconnect your saved workspace.", button: "Reconnect account"},
  resend: {title: "Verify your email.", description: "Enter your account email to request a verification code, or enter the code already sent to you.", button: "Send verification code"},
  "forgot-password": {title: "Let’s get you back in.", description: "Enter your account email to request a password reset link.", button: "Send reset link"},
  "reset-password": {title: "Choose a new password.", description: "Use at least 12 characters. You’ll sign in again after updating it.", button: "Update password"},
};
export function AuthForm({mode, configured, token}: {mode: FormMode; configured: boolean; token?: string}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [invite, setInvite] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const registration = mode === "signup" || mode === "reconnect";
  const verification = mode === "resend" || (sent && registration);
  const details = copy[mode];
  const post = async (endpoint: string, payload: unknown) => {
    const response = await appFetch(`/api/auth/${endpoint}`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Please retry shortly.");
    return body;
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if ((registration || mode === "reset-password") && password !== confirmPassword) {setError("The passwords do not match."); return;}
    setLoading(true);
    try {
      const payload = registration ? {email, password, displayName: name, ...(mode === "signup" ? {inviteCode: invite} : {})}
        : mode === "reset-password" ? {password, token} : {email};
      await post(mode, payload);
      setPassword(""); setConfirmPassword(""); setInvite(""); setSent(true); setResendAfter(Date.now() + 60000);
      if (mode === "reset-password") {announceAuthChange(); window.location.replace(appPath("/login?notice=password-updated"));}
    } catch (e) {setError(e instanceof Error ? e.message : "Please retry shortly.");}
    finally {setLoading(false);}
  };
  const resend = async () => {
    setError("");
    if (Date.now() < resendAfter) {setError("Wait one minute before requesting another email."); return;}
    setLoading(true);
    try {
      await post(mode === "forgot-password" ? "forgot-password" : "resend", {email});
      setSent(true); setResendAfter(Date.now() + 60000);
    } catch (e) {setError(e instanceof Error ? e.message : "Unable to resend.");}
    finally {setLoading(false);}
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      await post("confirm", {email, code});
      announceAuthChange(); window.location.replace(appPath("/login?notice=email-verified"));
    } catch (e) {setError(e instanceof Error ? e.message : "Unable to verify this code."); setLoading(false);}
  };
  return <AuthCard title={verification ? "Verify your email." : sent ? "Check your inbox." : details.title}
    description={sent ? `Check ${email.trim()} for your ${mode === "forgot-password" ? "password reset link" : "verification code"}. Check your spam folder too.` : details.description}>
    {!configured ? <div className="info-box">Account access requires Neon. Follow the README to configure your project.</div> : verification ? <>
      <form onSubmit={event => void verify(event)}>
        <label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required/>
        <label htmlFor="auth-code">Verification code</label><input id="auth-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value)} maxLength={6} required/>
        <button className="button button-primary login-button" disabled={loading}>{loading ? "Please wait…" : "Verify email"}<ArrowRight size={14}/></button>
      </form>
      <button className="button button-secondary full-width" disabled={loading || !email.trim()} onClick={() => void resend()}>{sent ? "Resend verification code" : "Send verification code"}</button>
    </> : sent ? <div role="status" className="auth-success"><Check size={18}/><span>If the account exists, a reset link will arrive shortly.</span></div> : <form onSubmit={event => void send(event)}>
      {registration && <><label htmlFor="auth-name">Your name</label><input id="auth-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} maxLength={200} required/></>}
      {mode === "signup" && <><label htmlFor="auth-invite">Invitation code</label><input id="auth-invite" autoComplete="off" spellCheck={false} placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" value={invite} onChange={e => setInvite(e.target.value)} maxLength={100} required/></>}
      {mode !== "reset-password" && <><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required/></>}
      {(registration || mode === "reset-password") && <><label htmlFor="auth-password">Password</label><input id="auth-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} maxLength={200} required/><label htmlFor="auth-confirm-password">Confirm password</label><input id="auth-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={12} maxLength={200} required/><p className="field-hint">At least 12 characters.</p></>}
      <button className="button button-primary login-button" type="submit" disabled={loading}>{loading ? "Please wait…" : details.button}<ArrowRight size={14}/></button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {sent && mode === "forgot-password" && <button className="button button-secondary full-width" disabled={loading} onClick={() => void resend()}>Resend email</button>}
    <div className="auth-links"><Link href="/login">Back to sign in</Link>{registration && <Link href="/verify-email">Already registered? Verify email</Link>}</div>
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
