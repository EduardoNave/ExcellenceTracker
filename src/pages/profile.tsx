import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/lib/supabase'
import { User, Mail, Shield, Save, Key } from 'lucide-react'

export default function ProfilePage() {
  const { user, profile } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [saving, setSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  // Initials for avatar
  const initials = (profile?.full_name ?? '')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const roleLabel = profile?.role === 'coordinator' ? 'Coordinador' : 'Servidor'

  // -----------------------------------------------------------------------
  // Save profile
  // -----------------------------------------------------------------------
  const handleSaveProfile = async () => {
    if (!user) return

    const trimmed = fullName.trim()
    if (!trimmed) {
      setProfileMsg({ type: 'error', text: 'El nombre no puede estar vacio.' })
      return
    }

    setSaving(true)
    setProfileMsg(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: trimmed })
        .eq('id', user.id)

      if (error) throw error

      setProfileMsg({ type: 'success', text: 'Perfil actualizado correctamente.' })
    } catch (err: any) {
      setProfileMsg({
        type: 'error',
        text: err?.message ?? 'Ocurrio un error al guardar.',
      })
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------------------------------------------------
  // Change password
  // -----------------------------------------------------------------------
  const handleChangePassword = async () => {
    setPwMsg(null)

    if (newPassword.length < 6) {
      setPwMsg({
        type: 'error',
        text: 'La contrasena debe tener al menos 6 caracteres.',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Las contrasenas no coinciden.' })
      return
    }

    setChangingPw(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (error) throw error

      setPwMsg({ type: 'success', text: 'Contrasena actualizada correctamente.' })
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setPwMsg({
        type: 'error',
        text: err?.message ?? 'Ocurrio un error al cambiar la contrasena.',
      })
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      {/* Profile Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Mi perfil</h1>

        {/* Avatar + basic info */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* Avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <span className="text-2xl font-bold">{initials || <User className="h-8 w-8" />}</span>
          </div>

          <div className="flex-1 space-y-4 w-full">
            {/* Full name */}
            <div>
              <label
                htmlFor="fullName"
                className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700"
              >
                <User className="h-4 w-4" />
                Nombre completo
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Mail className="h-4 w-4" />
                Correo electronico
              </label>
              <input
                type="text"
                readOnly
                value={user?.email ?? ''}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 shadow-sm"
              />
            </div>

            {/* Role */}
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                <Shield className="h-4 w-4" />
                Rol
              </label>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                  profile?.role === 'coordinator'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Profile message */}
        {profileMsg && (
          <div
            className={`mt-4 rounded-md px-4 py-3 text-sm ${
              profileMsg.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {profileMsg.text}
          </div>
        )}

        {/* Save button */}
        <div className="mt-6">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Key className="h-5 w-5" />
          Cambiar contrasena
        </h2>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="newPassword"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Nueva contrasena
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimo 6 caracteres"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Confirmar contrasena
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repetir contrasena"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Password message */}
        {pwMsg && (
          <div
            className={`mt-4 rounded-md px-4 py-3 text-sm ${
              pwMsg.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {pwMsg.text}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleChangePassword}
            disabled={changingPw}
            className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 disabled:opacity-50"
          >
            <Key className="h-4 w-4" />
            {changingPw ? 'Cambiando...' : 'Cambiar contrasena'}
          </button>
        </div>
      </div>
    </div>
  )
}
