// supabase/functions/reactivate-account/index.ts
// Allows a deactivated user to set a new password when accepting a re-invitation.
//
// Security: the password update only happens when a VALID, PENDING, NON-EXPIRED
// invitation token exists for the specified email.
//
// POST body: { token: string, new_password: string }
// Response:  { success: true, email: string } | { error: string }
//
// After success, the frontend signs in with the new password and calls
// accept_invitation() RPC, which reactivates the profile and adds to group_members.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  // Parse body
  let body: { token: string; new_password: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { token, new_password } = body
  if (!token || !new_password) {
    return json({ error: 'Missing required fields: token, new_password' }, 400)
  }
  if (new_password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400)
  }

  // 1. Validate the invitation token
  const { data: invitation, error: invError } = await supabaseAdmin
    .schema('salim_et')
    .from('invitations')
    .select('email, status, expires_at')
    .eq('token', token)
    .single()

  if (invError || !invitation) {
    return json({ error: 'Invitación no encontrada' }, 404)
  }

  if (invitation.status !== 'pending') {
    return json({ error: 'Esta invitación ya fue usada' }, 400)
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return json({ error: 'Esta invitación ha expirado' }, 400)
  }

  const email = invitation.email

  // 2. Find the auth user by email
  //    listUsers does not support direct email filter in all Supabase versions;
  //    we paginate until we find the user or exhaust the list.
  let targetUserId: string | null = null
  let page = 1
  const pageSize = 1000

  outer: while (true) {
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    })

    if (listErr) break
    if (!users || users.length === 0) break

    for (const u of users) {
      if (u.email?.toLowerCase() === email.toLowerCase()) {
        targetUserId = u.id
        break outer
      }
    }

    if (users.length < pageSize) break // last page
    page++
  }

  if (!targetUserId) {
    // No existing auth user for this email — the invitation is for a new user,
    // they should use the registration form instead.
    return json({ error: 'No se encontró una cuenta con este correo. Usa el formulario de registro.' }, 404)
  }

  // 3. Update the password via Supabase Admin API
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    password: new_password,
  })

  if (updateErr) {
    console.error('Password update error:', updateErr)
    return json({ error: 'No se pudo actualizar la contraseña. Intenta nuevamente.' }, 500)
  }

  // 4. Return success — frontend handles sign-in + accept_invitation RPC
  return json({ success: true, email })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
