import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { NotificationBell } from './NotificationBell'

const MARKETING_LINKS = [
  { label: '기능', href: '#features' },
  { label: '요금제', href: '#pricing' },
]

/**
 * variant
 *  - marketing : 랜딩용. 전체 로고 + 앵커 링크 + 로그인/가입 CTA
 *  - plain     : 프로젝트 목록처럼 내비게이션이 없는 화면. 전체 로고 + 로그아웃
 *  - app       : 프로젝트 안. 심볼 + 구분선 + 탭(ProjectLayout 이 children 으로 넘김) + 아바타
 */
export function TopNav({
  variant = 'plain',
  children,
}: {
  variant?: 'app' | 'marketing' | 'plain'
  children?: React.ReactNode
}) {
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

  const isApp = variant === 'app'

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className={cn('flex h-16 items-center gap-sm px-lg', isApp ? 'w-full' : 'container-content')}>
        {isApp ? (
          <>
            <Logo variant="symbol" height={22} to="/projects" />
            <span className="mx-sm h-6 w-px shrink-0 bg-hairline" aria-hidden />
          </>
        ) : (
          <Logo variant="full" height={22} to={isAuthenticated ? '/projects' : '/'} />
        )}

        {variant === 'marketing' && (
          <nav className="ml-xl hidden items-center gap-lg md:flex">
            {MARKETING_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="text-nav-link text-body transition-colors hover:text-ink">
                {l.label}
              </a>
            ))}
          </nav>
        )}

        {/* 프로젝트 탭 */}
        {children && <div className="thin-scroll min-w-0 flex-1 overflow-x-auto">{children}</div>}

        <div className={cn('flex items-center gap-sm', !children && 'ml-auto')}>
          {isAuthenticated && <NotificationBell />}
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-xs rounded-pill transition-colors active:bg-surface-card',
                  isApp ? 'p-xxs' : 'border border-hairline py-xxs pl-xxs pr-sm',
                )}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar name={user?.name || user?.email || '?'} size={isApp ? 32 : 28} />
                {!isApp && (
                  <span className="hidden max-w-[140px] truncate text-nav-link text-ink sm:block">
                    {user?.name || user?.email || '내 계정'}
                  </span>
                )}
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
                    className="flex w-full items-center gap-xs rounded-sm px-sm py-xs text-left text-body-sm text-body transition-colors hover:bg-surface-card"
                    role="menuitem"
                  >
                    <LogOut size={14} /> 로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="hidden px-sm text-nav-link text-body sm:block">
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
              <Menu size={16} />
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
