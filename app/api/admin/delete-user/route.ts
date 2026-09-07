import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route runs on the server only. SUPABASE_SERVICE_ROLE_KEY must NOT
// have the NEXT_PUBLIC_ prefix — that's what keeps it out of the browser
// bundle. It's required because deleting an auth user (so they can never
// log back in with that email) needs Supabase's admin API, which the
// public anon key is not allowed to call.
export async function POST(req: Request) {
  const { targetUserId, accessToken } = await req.json();

  if (!targetUserId || !accessToken) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the caller is really who they say they are, and is an admin.
  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(accessToken);
  if (callerError || !callerData.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", callerData.user.id)
    .single();

  if (!callerProfile?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
