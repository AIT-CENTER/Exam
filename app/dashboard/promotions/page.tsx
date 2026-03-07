import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { CookieOptions } from "@supabase/ssr";
import PromoteStudentsClient from "./promote-students-client";

export default async function PromotionsPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete(name);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/`);

  const { data: adminRow } = await supabase
    .from("admin")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) redirect("/unauthorized");

  // Page-level guard: allow super_admin always; admins only if super admin has permitted (explicit true).
  const role = (adminRow.role as "super_admin" | "admin" | null) ?? "super_admin";
  if (role === "admin") {
    const { data: permRow } = await supabase
      .from("admin_page_permissions")
      .select("allowed")
      .eq("role", "admin")
      .eq("page_key", "students_promotions")
      .maybeSingle();
    if (permRow?.allowed !== true) redirect("/unauthorized");
  }

  return <PromoteStudentsClient />;
}

