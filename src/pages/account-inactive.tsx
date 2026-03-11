import { UserX } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

export default function AccountInactivePage() {
  const { signOut } = useAuth()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <UserX className="h-8 w-8 text-red-600" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">Cuenta desactivada</h1>

        <p className="mb-6 text-gray-600">
          Tu cuenta ha sido desactivada porque ya no formas parte de ningún equipo.
          Para volver a acceder al sistema, solicita a tu coordinador que te envíe
          una nueva invitación.
        </p>

        <button
          onClick={() => signOut()}
          className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
