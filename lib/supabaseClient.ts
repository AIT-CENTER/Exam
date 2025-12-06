// lib/supabaseClient.ts
// Updated for Next.js App Router with @supabase/ssr for proper cookie handling.

import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Admin client (service role for server-side operations, e.g., in API routes)
export const supabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Function to create an admin user (use in server-side API routes for security)
export async function createAdmin(userData: {
  username: string;
  full_name: string;
  email: string;
  phone_number?: string;
  password: string;
}) {
  const supabaseAdminClient = supabaseAdmin();

  try {
    // Create user in auth with service role
    const { data: { user }, error: authError } = await supabaseAdminClient.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true, // Auto-confirm email for admin
    });

    if (authError || !user) {
      throw new Error(authError?.message || 'Failed to create admin user');
    }

    // Insert profile into admin table
    const { error: profileError } = await supabaseAdminClient
      .from('admin')
      .insert({
        id: user.id,
        username: userData.username,
        full_name: userData.full_name,
        email: userData.email,
        phone_number: userData.phone_number,
      });

    if (profileError) {
      // Optionally, delete the auth user if profile insert fails
      await supabaseAdminClient.auth.admin.deleteUser(user.id);
      throw new Error(profileError.message || 'Failed to save admin profile');
    }

    return { user, success: true };
  } catch (error) {
    console.error('Admin creation error:', error);
    throw error;
  }
}