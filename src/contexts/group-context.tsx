import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import type { Group } from '@/types'

interface GroupContextType {
  activeGroup: Group | null
  setActiveGroup: (group: Group) => void
  groups: Group[]
  isLoading: boolean
}

const GroupContext = createContext<GroupContextType | null>(null)

const ACTIVE_GROUP_KEY = 'excellence-tracker-active-group'

export function GroupProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [activeGroup, setActiveGroupState] = useState<Group | null>(null)

  // Coordinators: groups they own
  const { data: coordGroups = [], isLoading: loadingCoord } = useQuery({
    queryKey: ['groups', 'coordinator', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('coordinator_id', user.id)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('Error fetching coordinator groups:', error)
        return []
      }
      return (data ?? []) as Group[]
    },
    enabled: !!user && profile?.role === 'coordinator',
  })

  // Servers: groups they belong to via group_members
  const { data: memberGroups = [], isLoading: loadingMember } = useQuery({
    queryKey: ['groups', 'member', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', user.id)
      if (error) {
        console.error('Error fetching member groups:', error)
        return []
      }
      return (data ?? []).map((d: any) => d.groups).filter(Boolean) as Group[]
    },
    enabled: !!user && profile?.role === 'server',
  })

  const groups = profile?.role === 'coordinator' ? coordGroups : memberGroups
  const isLoading = profile?.role === 'coordinator' ? loadingCoord : loadingMember

  const setActiveGroup = (group: Group) => {
    setActiveGroupState(group)
    localStorage.setItem(ACTIVE_GROUP_KEY, group.id)
  }

  useEffect(() => {
    if (groups.length === 0) {
      setActiveGroupState(null)
      return
    }

    const savedId = localStorage.getItem(ACTIVE_GROUP_KEY)
    const savedGroup = savedId ? groups.find((g) => g.id === savedId) : null

    if (savedGroup) {
      setActiveGroupState(savedGroup)
    } else {
      setActiveGroupState(groups[0])
      localStorage.setItem(ACTIVE_GROUP_KEY, groups[0].id)
    }
  }, [groups])

  return (
    <GroupContext.Provider value={{ activeGroup, setActiveGroup, groups, isLoading }}>
      {children}
    </GroupContext.Provider>
  )
}

export function useGroup() {
  const context = useContext(GroupContext)
  if (!context) {
    throw new Error('useGroup must be used within a GroupProvider')
  }
  return context
}

// Alias for backward compatibility
export const useGroupContext = useGroup
