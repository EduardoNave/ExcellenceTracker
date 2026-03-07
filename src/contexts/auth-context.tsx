import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  isLoading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin = !!user && !!adminEmail && user.email === adminEmail

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
      return
    }

    setProfile(data)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    await fetchProfile(user.id)
  }, [user, fetchProfile])

  const handlePendingInvitation = useCallback(async () => {
    const pendingToken = localStorage.getItem('pending_invitation_token')
    if (!pendingToken) return
    try {
      const { data } = await supabase.rpc('accept_invitation', {
        invitation_token: pendingToken,
      }) as any
      if (data?.success) {
        localStorage.removeItem('pending_invitation_token')
      }
    } catch (_err) {
      // Silently fail - invitation may have expired
    }
  }, [])

  const handlePendingCoordinatorInvitation = useCallback(async () => {
    const pendingToken = localStorage.getItem('pending_coordinator_invitation_token')
    if (!pendingToken) return
    try {
      const { data } = await supabase.rpc('accept_coordinator_invitation', {
        p_token: pendingToken,
      }) as any
      if (data?.success) {
        localStorage.removeItem('pending_coordinator_invitation_token')
      }
    } catch (_err) {
      // Silently fail - invitation may have expired
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
        handlePendingInvitation()
        handlePendingCoordinatorInvitation()
      }
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
          handlePendingInvitation()
          handlePendingCoordinatorInvitation()
        } else {
          setProfile(null)
        }
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [fetchProfile, handlePendingInvitation, handlePendingCoordinatorInvitation])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, isLoading, isAdmin, signIn, signUp, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}
