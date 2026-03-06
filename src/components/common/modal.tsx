import { useEffect, useCallback, type ReactNode } from 'react'

interface ModalProps {
  children: ReactNode
  onClose: () => void
  maxWidth?: string
}

export function Modal({ children, onClose, maxWidth = 'max-w-lg' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`w-full ${maxWidth} rounded-xl bg-white shadow-xl`}>
        {children}
      </div>
    </div>
  )
}
