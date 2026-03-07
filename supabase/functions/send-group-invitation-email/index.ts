// supabase/functions/send-group-invitation-email/index.ts
// Sends a Brevo email for group member invitations.
// Called by the coordinator's team page after creating an invitation token.
//
// Required secrets (same as coordinator-invitations function):
//   BREVO_API_KEY, SENDER_EMAIL, SENDER_NAME

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Require an authenticated user (any coordinator)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401)
  }

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

  if (!to_email || !invite_link || !group_name) {
    return json({ error: 'Missing required fields: to_email, invite_link, group_name' }, 400)
  }

  try {
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
        to: [{ email: to_email }],
        subject: `Invitación al grupo "${group_name}" — ExcellenceTracker`,
        htmlContent: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1f2937">
            <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#111827">
              Fuiste invitado a un grupo
            </h1>
            <p style="color:#6b7280;margin-bottom:4px">
              <strong>${invited_by_name ?? 'Un coordinador'}</strong> te invitó a unirte al grupo
            </p>
            <p style="font-size:20px;font-weight:700;color:#6366f1;margin:8px 0 24px">
              ${group_name}
            </p>
            <p style="color:#6b7280;margin-bottom:24px">
              En ExcellenceTracker podrás participar en servicios y seguir tu desempeño.
            </p>
            <a href="${invite_link}"
               style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;
                      padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px">
              Aceptar invitación
            </a>
            <p style="margin-top:24px;font-size:12px;color:#9ca3af">
              Este enlace expira en 7 días. Si no esperabas este correo, ignóralo.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
            <p style="font-size:11px;color:#d1d5db">
              También puedes copiar y pegar este enlace:<br />
              <span style="word-break:break-all">${invite_link}</span>
            </p>
          </div>
        `,
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
