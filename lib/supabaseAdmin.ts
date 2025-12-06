import { createClient } from '@supabase/supabase-js';

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

export async function createAdmin(userData: {
  username: string;
  full_name: string;
  email: string;
  phone_number?: string;
  password: string;
}) {
  const supabaseAdminClient = supabaseAdmin();

  const { data: { user }, error: authError } = await supabaseAdminClient.auth.admin.createUser({
    email: userData.email,
    password: userData.password,
    email_confirm: true,
  });

  if (authError || !user) throw new Error(authError?.message || 'Failed to create admin user');

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
    await supabaseAdminClient.auth.admin.deleteUser(user.id);
    throw new Error(profileError.message || 'Failed to save admin profile');
  }

  return { user, success: true };
}
