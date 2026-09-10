import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'

const MARKETING_LINKS = [
  { label: '기능', href: '#features' },
  { label: '동작 방식', href: '#how' },
  { label: '흐름', href: '#loop' },
  { label: 'FAQ', href: '#faq' },
]

export function TopNav({ variant = 'app' }: { variant?: 'app' | 'marketing' }) {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenuOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b border-hairline-soft bg-canvas/90 backdrop-blur">
      <div className="container-content flex h-16 items-center justify-between gap-md">
        <div className="flex items-center gap-xl">
          <Logo to={isAuthenticated ? '/projects' : '/'} />
          {variant === 'marketing' && (
            <nav className="hidden items-center gap-lg md:flex">
              {MARKETING_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="text-nav-link text-muted transition-colors hover:text-ink">
                  {l.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-sm">
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-xs rounded-pill border border-hairline py-xxs pl-xxs pr-sm transition-colors active:bg-surface-card"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar name={user?.name || user?.email || '?'} size={28} />
                <span className="hidden max-w-[140px] truncate text-nav-link text-ink sm:block">
                  {user?.name || user?.email || '내 계정'}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-[220px] animate-fade-in rounded-lg border border-hairline bg-canvas p-xxs shadow-card"
                >
                  <div className="px-sm py-xs">
                    <p className="truncate text-title-sm text-ink">{user?.name || '이름 미확인'}</p>
                    <p className="truncate text-caption font-normal text-muted">{user?.email}</p>
                  </div>
                  <div className="my-xxs h-px bg-hairline-soft" />
                  <Link
                    to="/projects"
                    className="block rounded-sm px-sm py-xs text-body-sm text-body transition-colors hover:bg-surface-card"
                    role="menuitem"
                  >
                    내 프로젝트
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-sm px-sm py-xs text-left text-body-sm text-body transition-colors hover:bg-surface-card"
                    role="menuitem"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden px-sm text-nav-link text-ink sm:block">
                로그인
              </Link>
              <ButtonLink to="/signup" size="md">
                무료로 시작하기
              </ButtonLink>
            </>
          )}
          {variant === 'marketing' && (
            <button
              type="button"
              className="ml-xxs inline-flex h-9 w-9 items-center justify-center rounded-pill border border-hairline md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="메뉴 열기"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {variant === 'marketing' && (
        <div className={cn('border-t border-hairline-soft bg-canvas md:hidden', mobileOpen ? 'block' : 'hidden')}>
          <div className="container-content flex flex-col gap-xxs py-md">
            {MARKETING_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-md px-xs py-sm text-nav-link text-body">
                {l.label}
              </a>
            ))}
            {!isAuthenticated && (
              <Button variant="secondary" fullWidth className="mt-xs" onClick={() => navigate('/login')}>
                로그인
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
