import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/team': 'Equipo',
  '/checklists': 'Checklists',
  '/services': 'Servicios',
  '/reports': 'Reportes',
  '/profile': 'Perfil',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { profile } = useAuth()
  const location = useLocation()

  const title = pageTitles[location.pathname] ?? 'ExcellenceTracker'

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const roleBadge = profile?.role === 'coordinator' ? 'Coordinador' : 'Servidor'

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700 sm:inline-block">
          {roleBadge}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-sm font-medium text-white">
          {initials}
        </div>
      </div>
    </header>
  )
}
