import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || "").trim();

    if (!username || username.length < 3) {
      // Keep response shape stable to avoid account enumeration via status codes.
      return NextResponse.json({ email: null }, { status: 200 });
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("admin")
      .select("email")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      // Don't leak details to client; just log server-side.
      console.error("[admin/resolve-email] lookup error", {
        message: (error as any)?.message,
        code: (error as any)?.code,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
      });
      return NextResponse.json({ email: null }, { status: 200 });
    }

    return NextResponse.json({ email: data?.email ?? null }, { status: 200 });
  } catch (e) {
    console.error("[admin/resolve-email] unexpected error", e);
    return NextResponse.json({ email: null }, { status: 200 });
  }
}

