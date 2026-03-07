// supabase/functions/coordinator-invitations/index.ts
// Admin CRUD for coordinator invitations + Brevo email sending.
//
// Required secrets (set in Supabase dashboard → Edge Functions → Secrets):
//   BREVO_API_KEY   — Brevo transactional email API key
//   ADMIN_EMAIL     — email address of the admin user
//   SENDER_EMAIL    — "from" email address shown to recipients
//   SENDER_NAME     — "from" display name shown to recipients
//   SITE_URL        — public URL of the app (e.g. https://app.example.com)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ── Auth check ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const jwt = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail || user.email !== adminEmail) {
    return json({ error: 'Forbidden: admin only' }, 403)
  }

  // ── Route dispatch ───────────────────────────────────────────────────────────
  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      return await handleList(supabaseAdmin)
    }

    if (req.method === 'POST') {
      const body = await req.json()
      return await handleCreate(supabaseAdmin, body.email, user.id)
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id')
      if (!id) return json({ error: 'Missing id parameter' }, 400)
      return await handleDelete(supabaseAdmin, id)
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('coordinator-invitations error:', err)
    return json({ error: String(err) }, 500)
  }
})

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleList(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .schema('salim_et')
    .from('coordinator_invitations')
    .select(`
      *,
      inviter:invited_by (full_name, email:id),
      coordinator:email (
        profiles!inner (id, full_name, role)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return json({ error: error.message }, 500)

  // Also fetch profiles of accepted coordinators for the "active coordinators" section
  const acceptedEmails = (data ?? [])
    .filter((inv: Record<string, unknown>) => inv.status === 'accepted')
    .map((inv: Record<string, unknown>) => inv.email as string)

  let coordinators: unknown[] = []
  if (acceptedEmails.length > 0) {
    // Get profiles by matching auth.users email — requires service_role
    const { data: authUsers } = await supabase.auth.admin.listUsers()
    const matchedUsers = (authUsers?.users ?? []).filter((u) =>
      acceptedEmails.includes(u.email ?? '')
    )
    const matchedIds = matchedUsers.map((u) => u.id)

    if (matchedIds.length > 0) {
      const { data: profiles } = await supabase
        .schema('salim_et')
        .from('profiles')
        .select('id, full_name, role, created_at')
        .in('id', matchedIds)

      // Get group counts per coordinator
      const { data: groups } = await supabase
        .schema('salim_et')
        .from('groups')
        .select('coordinator_id')
        .in('coordinator_id', matchedIds)

      const groupCounts: Record<string, number> = {}
      for (const g of groups ?? []) {
        groupCounts[g.coordinator_id] = (groupCounts[g.coordinator_id] ?? 0) + 1
      }

      coordinators = (profiles ?? []).map((p) => ({
        ...p,
        email: matchedUsers.find((u) => u.id === p.id)?.email,
        group_count: groupCounts[p.id] ?? 0,
      }))
    }
  }

  return json({ invitations: data ?? [], coordinators })
}

async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  email: string,
  invitedById: string
) {
  if (!email || !email.includes('@')) {
    return json({ error: 'Correo inválido' }, 400)
  }

  // Check if there's already a pending invitation for this email
  const { data: existing } = await supabase
    .schema('salim_et')
    .from('coordinator_invitations')
    .select('id, status')
    .eq('email', email)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return json({ error: 'Ya existe una invitación pendiente para este correo' }, 409)
  }

  // Insert invitation
  const { data: invitation, error: insertError } = await supabase
    .schema('salim_et')
    .from('coordinator_invitations')
    .insert({ email, invited_by: invitedById })
    .select()
    .single()

  if (insertError || !invitation) {
    return json({ error: insertError?.message ?? 'Error al crear invitación' }, 500)
  }

  const siteUrl = Deno.env.get('SITE_URL') ?? ''
  const inviteLink = `${siteUrl}/coordinator-invite/${invitation.token}`

  // Send Brevo email
  const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': Deno.env.get('BREVO_API_KEY') ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: Deno.env.get('SENDER_NAME') ?? 'ExcellenceTracker',
        email: Deno.env.get('SENDER_EMAIL') ?? 'noreply@excellencetracker.app',
      },
      to: [{ email }],
      subject: 'Invitación como Coordinador — ExcellenceTracker',
      htmlContent: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937">
          <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#111827">
            Fuiste invitado como Coordinador
          </h1>
          <p style="color:#6b7280;margin-bottom:24px">
            Has sido invitado a unirte a <strong>ExcellenceTracker</strong> como coordinador.
            Podrás crear y gestionar grupos, programar servicios y evaluar a tu equipo.
          </p>
          <a href="${inviteLink}"
             style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;
                    padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px">
            Aceptar invitación
          </a>
          <p style="margin-top:24px;font-size:12px;color:#9ca3af">
            Este enlace expira en 30 días. Si no esperabas este correo, ignóralo.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
          <p style="font-size:11px;color:#d1d5db">
            También puedes copiar y pegar este enlace en tu navegador:<br />
            <span style="word-break:break-all">${inviteLink}</span>
          </p>
        </div>
      `,
    }),
  })

  if (!brevoRes.ok) {
    const brevoBody = await brevoRes.text()
    console.error('Brevo error:', brevoBody)
    // Don't fail the whole request — invitation was created, email failed
    return json(
      { invitation, inviteLink, emailSent: false, emailError: brevoBody },
      201
    )
  }

  return json({ invitation, inviteLink, emailSent: true }, 201)
}

async function handleDelete(
  supabase: ReturnType<typeof createClient>,
  id: string
) {
  const { error } = await supabase
    .schema('salim_et')
    .from('coordinator_invitations')
    .delete()
    .eq('id', id)

  if (error) return json({ error: error.message }, 500)
  return json({ success: true })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
