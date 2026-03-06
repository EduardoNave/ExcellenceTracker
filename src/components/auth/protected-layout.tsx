import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { GroupProvider } from '@/contexts/group-context'
import { AppShell } from '@/components/layout/app-shell'
import { Loader2 } from 'lucide-react'

export function ProtectedLayout() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <GroupProvider>
      <AppShell />
    </GroupProvider>
  )
}
