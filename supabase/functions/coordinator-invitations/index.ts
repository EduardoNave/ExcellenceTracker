// supabase/functions/coordinator-invitations/index.ts
// Email-only handler for coordinator invitations.
// The DB record is now created client-side (migration 011 RLS policies).
// This function's only job is to send the Brevo email.
//
// Required secrets (env vars on the edge-runtime container):
//   BREVO_API_KEY   — Brevo transactional API key (starts with "xkeysib-")
//   ADMIN_EMAIL     — email address of the admin (must match VITE_ADMIN_EMAIL)
//   SENDER_EMAIL    — "From" address shown to recipients (must be verified in Brevo)
//   SENDER_NAME     — "From" display name shown to recipients
//   SITE_URL        — public URL of the app (e.g. https://salimet.example.com)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by the runtime.
//
// POST body:
//   { email, token, inviteLink, emailOnly: true }
//   emailOnly:true  → just send email, record already exists in DB
//   emailOnly:false (default) → legacy: create record + send email

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // ── Auth: must be the admin ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const jwt = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail || user.email !== adminEmail) {
    return json({ error: 'Forbidden: admin only' }, 403)
  }

  // ── Route ────────────────────────────────────────────────────────────────
  try {
    if (req.method === 'POST') {
      const body = await req.json()
      // emailOnly: true  → record already created by the client; just send email
      // emailOnly: false → legacy path: create record + send email
      if (body.emailOnly) {
        return await handleEmailOnly(body.email as string, body.inviteLink as string)
      }
      return await handleCreate(supabaseAdmin, body.email as string, user.id)
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('coordinator-invitations error:', err)
    return json({ error: String(err) }, 500)
  }
})

// ── Send email only (invitation already in DB) ────────────────────────────
async function handleEmailOnly(email: string, inviteLink: string) {
  const emailSent = await sendBrevoEmail(email, inviteLink)
  if (!emailSent.ok) {
    console.error('Brevo error (emailOnly):', emailSent.body)
    return json({ emailSent: false, emailError: emailSent.body }, 200)
  }
  return json({ emailSent: true })
}

// ── Legacy: create record + send email ───────────────────────────────────
async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  email: string,
  invitedById: string
) {
  if (!email || !email.includes('@')) return json({ error: 'Correo inválido' }, 400)

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

  const emailSent = await sendBrevoEmail(email, inviteLink)
  if (!emailSent.ok) {
    console.error('Brevo error (handleCreate):', emailSent.body)
    return json({ invitation, inviteLink, emailSent: false, emailError: emailSent.body }, 201)
  }

  return json({ invitation, inviteLink, emailSent: true }, 201)
}

// ── Brevo email helper ────────────────────────────────────────────────────
async function sendBrevoEmail(toEmail: string, inviteLink: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
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
      to: [{ email: toEmail }],
      subject: 'Invitación como Coordinador — ExcellenceTracker',
      htmlContent: buildCoordinatorInviteHtml(inviteLink),
    }),
  })
  const body = res.ok ? '' : await res.text()
  return { ok: res.ok, body }
}

// ── Email HTML template ───────────────────────────────────────────────────
// Edit this function to customise the coordinator invitation email.
function buildCoordinatorInviteHtml(inviteLink: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Header -->
        <tr>
          <td style="background:#6366f1;padding:28px 32px">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">
              ExcellenceTracker
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827">
              Fuiste invitado como Coordinador
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;line-height:1.6">
              Has sido invitado a unirte a <strong style="color:#374151">ExcellenceTracker</strong>
              como coordinador. Podrás crear y gestionar grupos de servidores, programar servicios
              y evaluar el desempeño de tu equipo.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#6366f1">
                  <a href="${inviteLink}"
                     style="display:inline-block;padding:14px 32px;font-size:15px;
                            font-weight:600;color:#ffffff;text-decoration:none;
                            border-radius:8px">
                    Aceptar invitación →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
              Este enlace expira en 30 días. Si no esperabas este correo, puedes ignorarlo.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:11px;color:#9ca3af">
              Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
              <span style="color:#6366f1;word-break:break-all">${inviteLink}</span>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Helpers ───────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
