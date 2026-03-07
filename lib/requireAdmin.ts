import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export type AdminRole = "super_admin" | "admin";

export async function requireAdminUser(): Promise<{ userId: string; role: AdminRole }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as CookieOptions)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  const { data: adminRow } = await supabase
    .from("admin")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    throw new Error("FORBIDDEN");
  }

  const role = (adminRow.role as AdminRole | null) ?? "super_admin";
  return { userId: user.id, role };
}

