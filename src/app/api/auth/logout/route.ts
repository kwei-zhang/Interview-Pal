import { requireUser } from "@/lib/server/supabase";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const {supabase} = await requireUser();
    const {error} = await supabase.auth.signOut(); if (error) throw new HttpError(500, "Could not sign out.");
    return Response.json({ok: true});
  } catch (error) {return errorResponse(error);}
}
