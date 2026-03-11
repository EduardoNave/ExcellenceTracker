import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEmailTemplates,
  updateEmailTemplate,
  sendTestEmail,
  type EmailTemplate,
} from '@/api/email-templates'
import { supabase } from '@/lib/supabase'

const QUERY_KEY = ['email-templates']

export function useEmailTemplates() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: getEmailTemplates,
    staleTime: 60_000,
  })
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Pick<EmailTemplate, 'subject' | 'html_body'> }) =>
      updateEmailTemplate(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: async ({ template_id, to_email }: { template_id: string; to_email: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No hay sesión activa')
      return sendTestEmail(template_id, to_email, session.access_token)
    },
  })
}
