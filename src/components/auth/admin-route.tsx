import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { profile, isLoading } = useAuth()

  if (isLoading) return null

  if (!profile?.is_admin) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
