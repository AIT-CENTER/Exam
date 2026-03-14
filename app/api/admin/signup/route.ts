import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireAdminUser } from "@/lib/requireAdmin";

export async function POST(request: Request) {
  try {
    const admin = supabaseAdmin();

    const body = await request.json();
    const { email, password, username, fullName, phone } = body;

    // Validation
    if (!email || !password || !username || !fullName || !phone) {
      return NextResponse.json(
        { error: "All fields required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password minimum 8 characters" },
        { status: 400 }
      )
    }

    // 1. Check if first admin exists
    const { data: existingAdmins, error: checkError } = await admin
      .from('admin')
      .select('id')
      .limit(1)

    if (checkError) {
      console.error('Check error:', checkError)
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      )
    }

    const isFirstAdmin = !existingAdmins || existingAdmins.length === 0

    // 2. Security gate: after bootstrap, only signed-in super_admin can create admins
    let createdBy: string | null = null;
    let role: "super_admin" | "admin" = "admin";
    if (isFirstAdmin) {
      role = "super_admin";
    } else {
      const { userId, role: creatorRole } = await requireAdminUser().catch((e) => {
        const msg = (e as Error)?.message || "UNAUTHORIZED";
        throw new Error(msg);
      });
      if (creatorRole !== "super_admin") {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      createdBy = userId;
    }

    // 3. Create auth user through normal signup flow so Supabase sends confirmation email.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const publicAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "";
    const loginSlug = process.env.NEXT_PUBLIC_ADMIN_LOGIN_SLUG || "alpha";
    const emailRedirectTo = origin ? `${origin}/auth/${loginSlug}` : undefined;

    const { data: signUpData, error: signUpError } = await publicAuth.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { username, full_name: fullName, phone, role },
      },
    });

    if (signUpError || !signUpData.user) {
      const msg = signUpError?.message || "Failed to create user";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // 4. Insert into admin table (service role bypasses RLS)
    const { error: profileError } = await admin.from("admin").insert({
      id: signUpData.user.id,
      username,
      full_name: fullName,
      email,
      phone_number: phone,
      role,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error("Profile error:", profileError);
      await admin.auth.admin.deleteUser(signUpData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: isFirstAdmin
        ? "First admin created. Please verify the email address to activate login."
        : "Admin created. A verification email has been sent.",
      user: {
        id: signUpData.user.id,
        email,
        username
      }
    })

  } catch (error) {
    const msg = (error as Error)?.message || "Internal server error";
    if (msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}