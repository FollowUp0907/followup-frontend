import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { Avatar } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { useAnchoredPanel } from '@/components/ui/useAnchoredPanel'
import { AVATAR_COLORS, avatarColor } from '@/lib/constants'
import { setAvatarColor, useAvatarColors } from './avatarColor'

/**
 * 아바타를 누르면 색을 고르는 작은 판이 열린다.
 * 고른 색은 이 브라우저에만 남고, 아바타가 나오는 모든 화면에 바로 반영된다.
 *
 * 판은 body 로 포털한다. 구성원 목록 카드가 overflow-hidden 이라
 * 그 안에서 띄우면 카드 경계에서 잘린다.
 */
export function AvatarColorPicker({ name, size = 40 }: { name: string; size?: number }) {
  const [open, setOpen] = useState(false)
  const overrides = useAvatarColors()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { dropUp, style: panelStyle } = useAnchoredPanel(open, triggerRef, {
    width: 188,
    estimatedHeight: 210,
    gap: 6,
  })

  const current = overrides[name] ?? avatarColor(name)
  const isCustom = !!overrides[name]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      // 판이 포털로 빠져 있어서 root 만 보면 안 된다.
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`${name} 프로필 색 바꾸기`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="group relative rounded-pill transition-shadow hover:ring-2 hover:ring-hairline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <Avatar name={name} size={size} />
        {/* 누를 수 있다는 걸 알리는 작은 표시 */}
        <span
          className="absolute -bottom-[1px] -right-[1px] h-3 w-3 rounded-pill border-2 border-canvas opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: current }}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${name} 프로필 색`}
            style={panelStyle}
            className={cn(
              'fixed z-[60] animate-scale-in rounded-md border border-hairline bg-canvas p-sm shadow-card',
              dropUp ? 'origin-bottom' : 'origin-top',
            )}
          >
            <p className="mb-xs text-caption text-body">프로필 색</p>
            <div className="grid grid-cols-5 gap-xs">
              {AVATAR_COLORS.map((color) => {
                const selected = current.toLowerCase() === color.toLowerCase()
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setAvatarColor(name, color)
                      setOpen(false)
                    }}
                    aria-label={`색 ${color}`}
                    aria-pressed={selected}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-pill border transition-transform hover:scale-110',
                      selected ? 'border-ink' : 'border-hairline',
                    )}
                    style={{ background: color }}
                  >
                    {selected && <Check size={13} strokeWidth={3} className="text-ink" />}
                  </button>
                )
              })}
            </div>
            {isCustom && (
              <button
                type="button"
                onClick={() => {
                  setAvatarColor(name, null)
                  setOpen(false)
                }}
                className="mt-sm w-full rounded-sm px-xs py-xs text-caption font-normal text-muted transition-colors hover:bg-surface-card hover:text-ink"
              >
                기본색으로 되돌리기
              </button>
            )}
            <p className="mt-xs text-[11px] font-normal leading-snug text-muted-soft">이 브라우저에만 저장됩니다.</p>
          </div>,
          document.body,
        )}
    </div>
  )
}
