import { z } from "zod";
import { assertAccountBinding, requireAdmin } from "./accounts";

export async function adminForRequest(request: Request) {
  const auth = await requireAdmin();
  assertAccountBinding(request.headers.get("x-workspace-user-id"), auth.user.id);
  return auth;
}
export function adminPageOffset(request: Request) {
  return z.coerce.number().int().min(0).max(1000000).parse(new URL(request.url).searchParams.get("offset") || 0);
}
