import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type ToastTone = 'default' | 'success' | 'error'
interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastApi {
  toast: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const toast = useCallback((message: string, tone: ToastTone = 'default') => {
    const id = (seq.current += 1)
    setItems((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3600)
  }, [])

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m: string) => toast(m, 'success'),
      error: (m: string) => toast(m, 'error'),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-lg left-1/2 z-[60] flex w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 flex-col gap-xs">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto animate-fade-in rounded-md px-md py-sm text-body-sm shadow-card',
              t.tone === 'error'
                ? 'bg-error text-white'
                : t.tone === 'success'
                  ? 'bg-ink text-white'
                  : 'bg-ink text-white',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
