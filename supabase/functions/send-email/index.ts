// supabase/functions/send-email/index.ts
// Unified email sender: reads template from DB, substitutes {{variable}} placeholders,
// sends via Brevo. Called by any authenticated client.
//
// POST body: { template_id: string, to_email: string, variables: Record<string, string> }
//
// Required env vars:
//   BREVO_API_KEY, SENDER_EMAIL, SENDER_NAME
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  // Validate JWT belongs to a real user
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const { data: { user }, error: authError } =
    await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // Parse body
  let body: { template_id: string; to_email: string; variables: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { template_id, to_email, variables } = body
  if (!template_id || !to_email) {
    return json({ error: 'Missing required fields: template_id, to_email' }, 400)
  }

  // Fetch template using service_role (bypasses RLS)
  const { data: template, error: templateError } = await supabaseAdmin
    .schema('salim_et')
    .from('email_templates')
    .select('subject, html_body')
    .eq('id', template_id)
    .single()

  if (templateError || !template) {
    console.error('Template fetch error:', templateError)
    return json({ error: `Template '${template_id}' not found` }, 404)
  }

  // Substitute {{variable}} placeholders
  const vars = variables ?? {}
  // Always include site_url
  vars.site_url = vars.site_url ?? (Deno.env.get('SITE_URL') ?? '')

  const subject = applyVars(template.subject, vars)
  const htmlContent = applyVars(template.html_body, vars)

  // Send via Brevo
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
        subject,
        htmlContent,
      }),
    })

    if (!brevoRes.ok) {
      const errorBody = await brevoRes.text()
      console.error('Brevo error:', errorBody)
      return json({ success: false, error: errorBody }, 502)
    }

    return json({ success: true })
  } catch (err) {
    console.error('send-email error:', err)
    return json({ error: String(err) }, 500)
  }
})

// ── Substitution ───────────────────────────────────────────────────────────
function applyVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '')
}

// ── util ───────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
