import { supabase } from '@/lib/supabase'

const EDGE_FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export interface CoordinatorInvitation {
  id: string
  email: string
  token: string
  invited_by: string | null
  accepted_by: string | null
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

// ---------------------------------------------------------------------------
// List — all coordinator invitations + all coordinator profiles with group count
// Requires the admin RLS policies from migration 011 to be applied.
// ---------------------------------------------------------------------------
export async function listCoordinatorInvitations(): Promise<ListCoordinatorInvitationsResponse> {
  const [invResult, profResult, grpResult] = await Promise.all([
    supabase
      .from('coordinator_invitations')
      .select('*')
      .order('created_at', { ascending: false }),

    supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'coordinator'),

    supabase
      .from('groups')
      .select('coordinator_id'),
  ])

  if (invResult.error) throw new Error(invResult.error.message)
  if (profResult.error) throw new Error(profResult.error.message)
  // group count failure is non-fatal — just show 0
  const groupRows = grpResult.data ?? []

  const groupCountMap: Record<string, number> = {}
  for (const g of groupRows) {
    groupCountMap[g.coordinator_id] = (groupCountMap[g.coordinator_id] ?? 0) + 1
  }

  const coordinators: CoordinatorProfile[] = (profResult.data ?? []).map((p: {
    id: string
    full_name: string
    email: string | null
    created_at: string
  }) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email ?? '',
    role: 'coordinator',
    group_count: groupCountMap[p.id] ?? 0,
    created_at: p.created_at,
  }))

  return {
    invitations: (invResult.data ?? []) as CoordinatorInvitation[],
    coordinators,
  }
}

// ---------------------------------------------------------------------------
// Create — inserts directly via the Supabase client.
// The "coordinator_invitations: admin insert" RLS policy (migration 011)
// allows this when is_admin() returns true.
// Email sending is attempted via edge function but is fully optional —
// the admin can always copy the invitation link manually.
// ---------------------------------------------------------------------------
export async function createCoordinatorInvitation(
  email: string
): Promise<{ invitation: CoordinatorInvitation; inviteLink: string; emailSent: boolean }> {
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('coordinator_invitations')
    .insert({ email, invited_by: user?.id ?? null })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const invitation = data as CoordinatorInvitation
  const inviteLink = `${window.location.origin}/coordinator-invite/${invitation.token}`

  // Attempt email via send-email edge function (optional — graceful fail if unavailable)
  let emailSent = false
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      const res = await fetch(`${EDGE_FN_BASE}/send-email`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: 'coordinator_invitation',
          to_email: email,
          variables: { invite_link: inviteLink },
        }),
      })
      emailSent = res.ok
    }
  } catch {
    console.warn('Could not send coordinator invitation email (edge function unavailable)')
  }

  return { invitation, inviteLink, emailSent }
}

// ---------------------------------------------------------------------------
// Delete — uses RLS policy "coordinator_invitations: admin delete"
// ---------------------------------------------------------------------------
export async function deleteCoordinatorInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from('coordinator_invitations')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Accept — called client-side by the coordinator accepting their invite.
// Uses the accept_coordinator_invitation() SECURITY DEFINER RPC.
// ---------------------------------------------------------------------------
export async function acceptCoordinatorInvitation(
  token: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('accept_coordinator_invitation', {
    p_token: token,
  }) as any
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Send group invitation email — calls edge function (best-effort).
// Non-fatal: logs a warning if the edge function is unavailable.
// ---------------------------------------------------------------------------
export async function sendGroupInvitationEmail(params: {
  toEmail: string
  inviteLink: string
  groupName: string
  invitedByName: string
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return

  const res = await fetch(`${EDGE_FN_BASE}/send-email`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: 'group_invitation',
      to_email: params.toEmail,
      variables: {
        invite_link: params.inviteLink,
        group_name: params.groupName,
        invited_by_name: params.invitedByName,
      },
    }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    console.warn('Failed to send group invitation email:', body.error)
  }
}
