import { z } from "zod";
import { assertAccountBinding, requireAdmin } from "./supabase";
import { HttpError } from "./http";

export async function adminForRequest(request: Request) {
  const auth = await requireAdmin();
  assertAccountBinding(request.headers.get("x-workspace-user-id"), auth.user.id);
  return auth;
}
export function adminPageOffset(request: Request) {
  return z.coerce.number().int().min(0).max(1000000).parse(new URL(request.url).searchParams.get("offset") || 0);
}
export function checkAdminResult<T>({data, error}: {data: T; error: {code?: string; message?: string} | null}): T {
  if (error?.code === "42501") throw new HttpError(403, "Admin access is required.");
  if (error?.code === "22023") throw new HttpError(400, error.message || "Invalid account operation.");
  if (error) throw new HttpError(503, "Account management is unavailable. Please retry.");
  return data;
}
