// supabase/functions/send-group-invitation-email/index.ts
// Sends the group-member invitation email via Brevo.
// Called by the coordinator's Team page after creating an invitation token.
//
// Required env vars:
//   BREVO_API_KEY, SENDER_EMAIL, SENDER_NAME, SITE_URL
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

  let body: {
    to_email: string
    invite_link: string
    group_name: string
    invited_by_name: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { to_email, invite_link, group_name, invited_by_name } = body
  if (!to_email || !invite_link || !group_name)
    return json({ error: 'Missing required fields: to_email, invite_link, group_name' }, 400)

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
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
        to: [{ email: to_email }],
        subject: `Invitación al grupo "${group_name}" — ExcellenceTracker`,
        htmlContent: buildGroupInviteEmail(invite_link, group_name, invited_by_name ?? ''),
      }),
    })

    if (!brevoRes.ok) {
      const errorBody = await brevoRes.text()
      console.error('Brevo error:', errorBody)
      return json({ success: false, error: errorBody }, 502)
    }

    return json({ success: true })
  } catch (err) {
    console.error('send-group-invitation-email error:', err)
    return json({ error: String(err) }, 500)
  }
})

// ── Email template ────────────────────────────────────────────────────────
function buildGroupInviteEmail(
  inviteLink: string,
  groupName: string,
  invitedByName: string,
): string {
  const siteUrl = Deno.env.get('SITE_URL') ?? ''
  const logoUrl = `${siteUrl}/logo.png`
  const year    = new Date().getFullYear()

  // Show sender name only if it looks like a real name (not an email address)
  const senderLabel = invitedByName && !invitedByName.includes('@')
    ? invitedByName
    : 'Tu coordinador'

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Invitación a ${groupName} — ExcellenceTracker</title>
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
                 style="border-radius:12px;margin-bottom:14px;display:block;
                        margin-left:auto;margin-right:auto;"
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
                  INVITACIÓN AL EQUIPO
                </td>
              </tr>
            </table>

            <h1 style="margin:0 0 8px;font-size:26px;font-weight:700;
                       color:#111827;line-height:1.2;">
              ${senderLabel} te invita a unirte
            </h1>
            <p style="margin:0 0 24px;font-size:16px;color:#6b7280;">
              Te han agregado al grupo:
            </p>

            <!-- Group name highlight -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                   style="margin-bottom:28px;">
              <tr>
                <td style="background:#eef2ff;border-radius:12px;
                           padding:20px 24px;text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:700;color:#6366f1;">
                    ${groupName}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
              Al aceptar podrás participar en los servicios programados
              y ver tu historial de evaluaciones.
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
                    Unirme al grupo →
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
                    ⏱ Este enlace <strong style="color:#374151;">expira en 7 días</strong>.
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
