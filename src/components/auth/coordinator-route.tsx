import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ShieldAlert } from 'lucide-react'

interface CoordinatorRouteProps {
  children: ReactNode
}

export function CoordinatorRoute({ children }: CoordinatorRouteProps) {
  const { profile } = useAuth()

  if (profile?.role !== 'coordinator') {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <ShieldAlert className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Acceso denegado</h2>
        <p className="text-gray-500">
          No tienes permisos para acceder a esta sección.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
