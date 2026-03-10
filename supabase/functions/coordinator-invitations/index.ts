// supabase/functions/coordinator-invitations/index.ts
// Sends the coordinator invitation email via Brevo.
// The DB record is created client-side (migration 011 RLS policies allow admin INSERT).
//
// Required env vars on the edge-runtime container:
//   BREVO_API_KEY   — Brevo transactional API key (xkeysib-...)
//   ADMIN_EMAIL     — must match VITE_ADMIN_EMAIL in the frontend
//   SENDER_EMAIL    — verified "From" address in Brevo
//   SENDER_NAME     — display name for the sender
//   SITE_URL        — public URL of the app (used for logo + invite links)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // ── Auth: validate JWT and confirm it belongs to the admin ───────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const { data: { user }, error: authError } =
    await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const adminEmail = Deno.env.get('ADMIN_EMAIL')
  if (!adminEmail || user.email !== adminEmail)
    return json({ error: 'Forbidden: admin only' }, 403)

  // ── Route ────────────────────────────────────────────────────────────────
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json()
    if (body.emailOnly) {
      // New flow: record already in DB, just send the email
      return await handleEmailOnly(body.email as string, body.inviteLink as string)
    }
    // Legacy flow: create record + send email
    return await handleCreate(supabaseAdmin, body.email as string, user.id)
  } catch (err) {
    console.error('coordinator-invitations error:', err)
    return json({ error: String(err) }, 500)
  }
})

// ── emailOnly mode ────────────────────────────────────────────────────────
async function handleEmailOnly(email: string, inviteLink: string) {
  const result = await sendBrevoEmail(email, inviteLink)
  if (!result.ok) {
    console.error('Brevo error:', result.body)
    return json({ emailSent: false, emailError: result.body })
  }
  return json({ emailSent: true })
}

// ── Legacy create + send mode ─────────────────────────────────────────────
async function handleCreate(
  supabase: ReturnType<typeof createClient>,
  email: string,
  invitedById: string,
) {
  if (!email?.includes('@')) return json({ error: 'Correo inválido' }, 400)

  const { data: existing } = await supabase
    .schema('salim_et').from('coordinator_invitations')
    .select('id').eq('email', email).eq('status', 'pending').maybeSingle()
  if (existing) return json({ error: 'Ya existe una invitación pendiente para este correo' }, 409)

  const { data: invitation, error: insertError } = await supabase
    .schema('salim_et').from('coordinator_invitations')
    .insert({ email, invited_by: invitedById }).select().single()
  if (insertError || !invitation)
    return json({ error: insertError?.message ?? 'Error al crear invitación' }, 500)

  const siteUrl = Deno.env.get('SITE_URL') ?? ''
  const inviteLink = `${siteUrl}/coordinator-invite/${invitation.token}`
  const result = await sendBrevoEmail(email, inviteLink)

  return json({
    invitation,
    inviteLink,
    emailSent: result.ok,
    ...(result.ok ? {} : { emailError: result.body }),
  }, 201)
}

// ── Brevo helper ──────────────────────────────────────────────────────────
async function sendBrevoEmail(toEmail: string, inviteLink: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': Deno.env.get('BREVO_API_KEY') ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name:  Deno.env.get('SENDER_NAME')  ?? 'ExcellenceTracker',
        email: Deno.env.get('SENDER_EMAIL') ?? 'noreply@excellencetracker.app',
      },
      to: [{ email: toEmail }],
      subject: 'Invitación como Coordinador — ExcellenceTracker',
      htmlContent: buildCoordinatorEmail(inviteLink),
    }),
  })
  const body = res.ok ? '' : await res.text()
  return { ok: res.ok, body }
}

// ── Email template ────────────────────────────────────────────────────────
function buildCoordinatorEmail(inviteLink: string): string {
  const siteUrl  = Deno.env.get('SITE_URL') ?? ''
  const logoUrl  = `${siteUrl}/logo.png`
  const year     = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitación — ExcellenceTracker</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1 0%,#4f46e5 100%);
                     padding:32px 40px;text-align:center;">
            <img src="${logoUrl}" alt="ExcellenceTracker"
                 width="48" height="48"
                 style="border-radius:12px;margin-bottom:14px;display:block;margin-left:auto;margin-right:auto;"
                 onerror="this.style.display='none'">
            <p style="margin:0;font-size:22px;font-weight:700;
                      color:#ffffff;letter-spacing:-0.3px;">
              ExcellenceTracker
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">

            <!-- Badge -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:24px;">
              <tr>
                <td style="background:#eef2ff;border-radius:20px;
                           padding:6px 14px;font-size:12px;font-weight:600;
                           color:#6366f1;letter-spacing:0.5px;">
                  NUEVA INVITACIÓN
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 12px;font-size:26px;font-weight:700;
                       color:#111827;line-height:1.2;">
              Fuiste invitado como<br>Coordinador
            </h1>

            <p style="margin:0 0 28px;font-size:16px;color:#6b7280;line-height:1.6;">
              Has recibido una invitación para unirte a
              <strong style="color:#374151;">ExcellenceTracker</strong>
              como coordinador. Podrás crear grupos, programar servicios
              y evaluar el desempeño de tu equipo.
            </p>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:32px;">
              <tr>
                <td style="background:linear-gradient(135deg,#6366f1,#4f46e5);
                           border-radius:10px;box-shadow:0 4px 12px rgba(99,102,241,.35);">
                  <a href="${inviteLink}"
                     style="display:inline-block;padding:16px 36px;font-size:16px;
                            font-weight:600;color:#ffffff;text-decoration:none;
                            border-radius:10px;letter-spacing:0.2px;">
                    Aceptar invitación →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td style="background:#f9fafb;border-radius:10px;border-left:4px solid #6366f1;
                           padding:16px 20px;">
                  <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">
                    ⏱ Este enlace <strong style="color:#374151;">expira en 30 días</strong>.
                    Si no esperabas este correo, puedes ignorarlo sin problema.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;text-align:center;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            <p style="margin:0;font-size:12px;text-align:center;word-break:break-all;">
              <a href="${inviteLink}" style="color:#6366f1;text-decoration:none;">
                ${inviteLink}
              </a>
            </p>
            <p style="margin:24px 0 0;font-size:11px;color:#d1d5db;text-align:center;">
              © ${year} ExcellenceTracker. Todos los derechos reservados.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>`
}

// ── util ──────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
