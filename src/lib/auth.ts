import { z } from "zod";

type AccountRole = "admin" | "member";
type AccountStatus = "active" | "suspended";
export interface Account { user_id: string; role: AccountRole; status: AccountStatus; created_at: string }
export interface Invitation { id: string; email: string; created_at: string; expires_at: string; revoked_at: string | null; redeemed_at: string | null; redeemed_by: string | null }
export interface AdminUser { user_id: string; email: string; display_name: string; role: AccountRole; status: AccountStatus; created_at: string; verified: boolean }

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const passwordSchema = z.string().min(12, "Use at least 12 characters for your password.").max(200);
const inviteCodeSchema = z.string().max(100).transform(value => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[A-F0-9]{32}$/, "Enter the complete invitation code."));
export const signupSchema = z.object({email: emailSchema, password: passwordSchema,
  displayName: z.string().trim().min(1, "Enter your name.").max(200), inviteCode: inviteCodeSchema}).strict();
export const reconnectSchema = signupSchema.omit({inviteCode: true});
export const AUTH_CHANGE_KEY = "interview-pal.auth-change";
export function announceAuthChange() {
  try { localStorage.setItem(AUTH_CHANGE_KEY, crypto.randomUUID()); } catch { /* Focus checks also detect account changes. */ }
}
