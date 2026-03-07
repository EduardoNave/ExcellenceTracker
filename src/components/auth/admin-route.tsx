import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

interface AdminRouteProps {
  children: React.ReactNode
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth()
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL

  if (isLoading) return null

  if (!adminEmail || user?.email !== adminEmail) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
