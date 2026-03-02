import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseClient'

export async function POST(request: Request) {
  try {
    const admin = supabaseAdmin()

    const body = await request.json()
    const { email, password, username, fullName, phone } = body

    // Validation
    if (!email || !password || !username || !fullName || !phone) {
      return NextResponse.json(
        { error: 'All fields required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password minimum 8 characters' },
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
        { error: 'Database error' },
        { status: 500 }
      )
    }

    const isFirstAdmin = !existingAdmins || existingAdmins.length === 0

    // 2. Create auth user (admin API - bypass email confirmation)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        username,
        full_name: fullName,
        phone
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // 3. Insert into admin table (bypass RLS with admin client)
    const { error: profileError } = await admin
      .from('admin')
      .insert({
        id: authData.user.id,
        username,
        full_name: fullName,
        email,
        phone_number: phone,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: isFirstAdmin ? null : authData.user.id // First admin has no created_by
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      
      // Rollback: delete auth user if admin insert fails
      await admin.auth.admin.deleteUser(authData.user.id)
      
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: isFirstAdmin ? 'First admin created successfully' : 'Admin created successfully',
      user: {
        id: authData.user.id,
        email,
        username
      }
    })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}