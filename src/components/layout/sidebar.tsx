import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calendar,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface SidebarProps {
  onClose?: () => void
}

const coordinatorLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/team', label: 'Equipo', icon: Users },
  { to: '/checklists', label: 'Checklists', icon: ClipboardList },
  { to: '/services', label: 'Servicios', icon: Calendar },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
]

const serverLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/services', label: 'Servicios', icon: Calendar },
  { to: '/reports', label: 'Reportes', icon: BarChart3 },
]

export function Sidebar({ onClose }: SidebarProps) {
  const { profile, signOut } = useAuth()

  const links = profile?.role === 'coordinator' ? coordinatorLinks : serverLinks

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="flex h-full flex-col bg-primary-950 text-primary-100">
      <div className="flex h-16 items-center px-6">
        <h2 className="text-lg font-bold tracking-tight text-white">
          ExcellenceTracker
        </h2>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-primary-200 hover:bg-primary-900 hover:text-white'
              }`
            }
          >
            <link.icon className="h-5 w-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-primary-800 p-4">
        <div className="mb-3 px-1">
          <p className="text-sm font-medium text-white">
            {profile?.full_name ?? 'Usuario'}
          </p>
          <p className="text-xs text-primary-300">
            {profile?.role === 'coordinator' ? 'Coordinador' : 'Servidor'}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-300 transition-colors hover:bg-primary-900 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
