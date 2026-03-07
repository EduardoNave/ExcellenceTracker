import { supabase } from '@/lib/supabase'

const EDGE_FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export interface CoordinatorInvitation {
  id: string
  email: string
  token: string
  invited_by: string | null
  status: 'pending' | 'accepted' | 'expired'
  expires_at: string
  created_at: string
}

export interface CoordinatorProfile {
  id: string
  full_name: string
  role: string
  email: string
  group_count: number
  created_at: string
}

export interface ListCoordinatorInvitationsResponse {
  invitations: CoordinatorInvitation[]
  coordinators: CoordinatorProfile[]
}

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('No hay sesión activa')
  return token
}

export async function listCoordinatorInvitations(): Promise<ListCoordinatorInvitationsResponse> {
  const token = await getAccessToken()
  const res = await fetch(`${EDGE_FN_BASE}/coordinator-invitations`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status}`)
  }
  return res.json()
}

export async function createCoordinatorInvitation(
  email: string
): Promise<{ invitation: CoordinatorInvitation; inviteLink: string; emailSent: boolean }> {
  const token = await getAccessToken()
  const res = await fetch(`${EDGE_FN_BASE}/coordinator-invitations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Error ${res.status}`)
  return body
}

export async function deleteCoordinatorInvitation(id: string): Promise<void> {
  const token = await getAccessToken()
  const res = await fetch(`${EDGE_FN_BASE}/coordinator-invitations?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Error ${res.status}`)
  }
}

export async function acceptCoordinatorInvitation(token: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('accept_coordinator_invitation', {
    p_token: token,
  }) as any
  if (error) throw error
  return data
}

export async function sendGroupInvitationEmail(params: {
  toEmail: string
  inviteLink: string
  groupName: string
  invitedByName: string
}): Promise<void> {
  const accessToken = await getAccessToken()
  const res = await fetch(`${EDGE_FN_BASE}/send-group-invitation-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_email: params.toEmail,
      invite_link: params.inviteLink,
      group_name: params.groupName,
      invited_by_name: params.invitedByName,
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    // Email failure is non-fatal — just log it
    console.warn('Failed to send group invitation email:', body.error)
  }
}
