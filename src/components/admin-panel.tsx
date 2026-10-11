"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, MailPlus, ShieldCheck, X } from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { Badge, PageHeading } from "./ui";
import type { AdminUser, Invitation } from "@/lib/auth";

function date(value: string) {return new Date(value).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"});}
function inviteStatus(invite: Invitation) {
  if (invite.redeemed_at) return "Redeemed";
  if (invite.revoked_at) return "Revoked";
  if (new Date(invite.expires_at).getTime() <= Date.now()) return "Expired";
  return "Pending";
}
export function AdminPanel() {
  const {accountFetch, notify} = useWorkspace();
  const [tab, setTab] = useState<"invitations" | "users">("invitations");
  const [offset, setOffset] = useState(0);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [email, setEmail] = useState("");
  const [newCode, setNewCode] = useState<{email: string; code: string} | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true); setError("");
    void (async () => {
      try {
        const response = await accountFetch(`/api/admin/${tab}?offset=${offset}`, {signal: abort.signal});
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load account management.");
        if (tab === "invitations") setInvitations(body.invitations); else setUsers(body.users);
      } catch (e) {if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Could not load account management.");}
      finally {if (!abort.signal.aborted) setLoading(false);}
    })();
    return () => abort.abort();
  }, [tab, offset, revision, accountFetch]);
  const update = useCallback(async (path: string, method: string, value?: unknown) => {
    setBusy(true); setError("");
    try {
      const response = await accountFetch(path, {method, headers: {"Content-Type": "application/json"}, ...(value ? {body: JSON.stringify(value)} : {})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update access.");
      if (body.code) {setNewCode({email: body.invitation.email, code: body.code}); setEmail(""); setOffset(0);}
      setRevision(value => value + 1);
    } catch (e) {setError(e instanceof Error ? e.message : "Could not update access.");}
    finally {setBusy(false);}
  }, [accountFetch]);
  const copyCode = async () => {
    if (!newCode) return;
    try {await navigator.clipboard.writeText(newCode.code); notify("Invitation code copied");}
    catch {setError("Select and copy the code below. Clipboard access is unavailable.");}
  };
  const changeTab = (next: "invitations" | "users") => {setTab(next); setOffset(0);};
  const count = tab === "invitations" ? invitations.length : users.length;
  return <><PageHeading eyebrow="INVITE-ONLY ACCESS" title="A space for your people." description="Invite members and manage access. Their practice work stays private."/>
    <div className="tabs" role="tablist" aria-label="Account management"><button role="tab" aria-selected={tab === "invitations"} aria-controls="admin-content" className={`tab ${tab === "invitations" ? "active" : ""}`} onClick={() => changeTab("invitations")}>Invitations</button><button role="tab" aria-selected={tab === "users"} aria-controls="admin-content" className={`tab ${tab === "users" ? "active" : ""}`} onClick={() => changeTab("users")}>Users</button></div>
    {error && <div className="inline-alert" role="alert">{error}<button className="button button-secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {newCode && <section className="card admin-new-code" aria-label="New invitation code"><div className="admin-code-heading"><h2>Invitation for {newCode.email}</h2><button className="icon-button" aria-label="Dismiss invitation code" onClick={() => setNewCode(null)}><X size={18}/></button></div><p>Copy this code now and share it privately. It works once, only for this email, and expires in seven days. It won’t be shown again.</p><div className="admin-code-copy"><input aria-label="Invitation code to share" value={newCode.code} readOnly onFocus={event => event.target.select()}/><button className="button button-secondary" onClick={() => void copyCode()}><Copy size={14}/>Copy code</button></div></section>}
    <section id="admin-content" role="tabpanel" aria-label={tab === "invitations" ? "Invitations" : "Users"}>
      {tab === "invitations" && <form className="card admin-invite-form" onSubmit={event => {event.preventDefault(); void update("/api/admin/invitations", "POST", {email});}}><div><label htmlFor="invite-email">Recipient email</label><input id="invite-email" type="email" required maxLength={254} placeholder="friend@example.com" value={email} onChange={event => setEmail(event.target.value)}/><p className="field-hint">Creating another code for this email revokes any unused previous invitation.</p></div><button className="button button-primary" type="submit" disabled={busy}><MailPlus size={15}/>{busy ? "Saving…" : "Create or replace invite"}</button></form>}
      <div className="card table-wrap admin-table" aria-busy={loading}>
        {loading ? <p className="admin-empty" role="status">Loading {tab}…</p> : count === 0 ? <p className="admin-empty">{tab === "invitations" ? "No invitations on this page. Create one to welcome someone." : "No users on this page."}</p> : tab === "invitations" ? <table><thead><tr><th>Email</th><th>Status</th><th>Created</th><th>Expires</th><th>Action</th></tr></thead><tbody>{invitations.map(invite => <tr key={invite.id}><td>{invite.email}</td><td><Badge tone={inviteStatus(invite) === "Redeemed" ? "green" : inviteStatus(invite) === "Pending" ? "purple" : "neutral"}>{inviteStatus(invite)}</Badge></td><td>{date(invite.created_at)}</td><td>{date(invite.expires_at)}</td><td>{!invite.redeemed_at && !invite.revoked_at ? <button className="button button-secondary" disabled={busy} onClick={() => void update(`/api/admin/invitations/${invite.id}`, "DELETE")}>Revoke</button> : "—"}</td></tr>)}</tbody></table> : <table><thead><tr><th>Member</th><th>Verification</th><th>Access</th><th>Joined</th><th>Action</th></tr></thead><tbody>{users.map(user => <tr key={user.user_id}><td><strong>{user.display_name || user.email}</strong><small className="admin-email">{user.email}</small>{user.role === "admin" && <Badge tone="purple"><ShieldCheck size={12}/> Admin</Badge>}</td><td><Badge tone={user.verified ? "green" : "amber"}>{user.verified ? "Verified" : "Pending email"}</Badge></td><td><Badge tone={user.status === "active" ? "green" : "neutral"}>{user.status === "active" ? "Active" : "Suspended"}</Badge></td><td>{date(user.created_at)}</td><td>{user.role === "member" ? <button className="button button-secondary" disabled={busy} onClick={() => void update(`/api/admin/users/${user.user_id}`, "PATCH", {status: user.status === "active" ? "suspended" : "active"})}>{user.status === "active" ? "Suspend" : "Restore access"}</button> : "Admin account"}</td></tr>)}</tbody></table>}
      </div>
      <div className="admin-pagination"><button className="button button-secondary" disabled={offset === 0 || loading} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous</button><span>Page {offset / 50 + 1}</span><button className="button button-secondary" disabled={count < 50 || loading} onClick={() => setOffset(value => value + 50)}>Next</button></div>
    </section>
  </>;
}
