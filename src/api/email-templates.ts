import { supabase } from '@/lib/supabase'

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  html_body: string
  variables: string[]
  updated_at: string
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('name')

  if (error) throw new Error(error.message)
  return data as EmailTemplate[]
}

export async function updateEmailTemplate(
  id: string,
  patch: { subject: string; html_body: string },
): Promise<void> {
  const { error } = await supabase
    .from('email_templates')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function sendTestEmail(
  template_id: string,
  to_email: string,
  accessToken: string,
): Promise<void> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id,
        to_email,
        variables: {},
      }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Error al enviar prueba: ${body}`)
  }
}
