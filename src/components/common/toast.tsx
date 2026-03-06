import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  message: string
  duration: number
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void
    error: (message: string, duration?: number) => void
    warning: (message: string, duration?: number) => void
    info: (message: string, duration?: number) => void
  }
}

// ---------------------------------------------------------------------------
// Confirm dialog types
// ---------------------------------------------------------------------------

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

// ---------------------------------------------------------------------------
// Contexts
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null)
const ConfirmContext = createContext<ConfirmContextValue | null>(null)

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.toast
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ToastProvider')
  return ctx.confirm
}

// ---------------------------------------------------------------------------
// Toast styling
// ---------------------------------------------------------------------------

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; text: string; icon: typeof CheckCircle }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: XCircle,
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    icon: Info,
  },
}

// ---------------------------------------------------------------------------
// Single Toast component
// ---------------------------------------------------------------------------

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const style = TOAST_STYLES[toast.type]
  const Icon = style.icon

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), toast.duration - 300)
    const removeTimer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => {
      clearTimeout(exitTimer)
      clearTimeout(removeTimer)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      className={`
        flex items-start gap-3 w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm
        transition-all duration-300
        ${style.bg} ${style.border}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${style.text}`} />
      <p className={`flex-1 text-sm font-medium ${style.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`shrink-0 rounded-lg p-0.5 ${style.text} hover:bg-black/5 transition-colors`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirm Dialog component
// ---------------------------------------------------------------------------

function ConfirmDialog({
  options,
  onResult,
}: {
  options: ConfirmOptions
  onResult: (confirmed: boolean) => void
}) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResult(false)
    },
    [onResult]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const isDanger = options.variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onResult(false)
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            {isDanger ? (
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-blue-600" />
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{options.title}</h3>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{options.message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            onClick={() => onResult(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            onClick={() => onResult(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
            autoFocus
          >
            {options.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions
    resolve: (v: boolean) => void
  } | null>(null)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, type, message, duration }])
  }, [])

  const toast = {
    success: (msg: string, dur?: number) => addToast('success', msg, dur),
    error: (msg: string, dur?: number) => addToast('error', msg, dur ?? 6000),
    warning: (msg: string, dur?: number) => addToast('warning', msg, dur ?? 5000),
    info: (msg: string, dur?: number) => addToast('info', msg, dur),
  }

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ options, resolve })
    })
  }, [])

  const handleConfirmResult = useCallback((result: boolean) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }, [confirmState])

  return (
    <ToastContext.Provider value={{ toast }}>
      <ConfirmContext.Provider value={{ confirm }}>
        {children}

        {/* Toast container */}
        <div className="fixed top-4 right-4 z-[70] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>

        {/* Confirm dialog */}
        {confirmState && (
          <ConfirmDialog
            options={confirmState.options}
            onResult={handleConfirmResult}
          />
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}
