import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, Settings } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { Avatar } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { ProfileSettingsPanel } from './ProfileSettingsPanel'
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
/** 이름을 아직 모르면 이메일 앞부분이라도 보여준다. (백엔드에 /me 가 없어 이름이 늦게 온다) */
function displayName(user: { name?: string; email?: string } | null) {
  if (user?.name) return user.name
  const local = user?.email?.split('@')[0]
  return local || '사용자'
}

export function TopNav({
  variant = 'plain',
  children,
}: {
  variant?: 'app' | 'marketing' | 'plain'
  children?: React.ReactNode
}) {
  const { user, isAuthenticated, logout, syncName } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // 프로필 팝오버 안에서 계정 설정으로 한 단계 들어간다.
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenuOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  // 팝오버를 닫으면 설정 단계도 처음으로 돌려놓는다.
  useEffect(() => {
    if (!menuOpen) setSettingsOpen(false)
  }, [menuOpen])

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
      {/* 헤더 안쪽 너비를 본문과 같게 맞춘다 — 로고와 프로필이 페이지 내용의 좌우 끝에 선다. */}
      <div className="container-content flex h-16 items-center gap-sm">
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

        {/* 프로젝트 탭 — 로고 바로 옆에 붙인다. 남는 자리는 오른쪽 아바타가 가져간다. */}
        {children && <div className="flex min-w-0 flex-1 items-center">{children}</div>}

        <div className={cn('flex items-center gap-sm', !children && 'ml-auto')}>
          {isAuthenticated && <NotificationBell />}
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className={cn(
                  'flex items-center gap-xs rounded-pill transition-colors active:bg-surface-card',
                  isApp ? 'p-xxs pr-sm' : 'border border-hairline py-xxs pl-xxs pr-sm',
                )}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <Avatar name={user?.name || user?.email || '?'} size={isApp ? 32 : 28} />
                {/* 누구로 로그인했는지 한눈에 — 좁은 화면에서는 아바타만 남긴다. */}
                <span className="hidden min-w-0 max-w-[180px] text-left sm:block">
                  <span className="block truncate text-nav-link leading-tight text-ink">
                    {displayName(user)}
                  </span>
                  {user?.email && (
                    <span className="block truncate text-caption font-normal leading-tight text-muted">
                      {user.email}
                    </span>
                  )}
                </span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] w-[264px] animate-fade-in rounded-lg border border-hairline bg-canvas p-xxs shadow-card"
                >
                  {settingsOpen ? (
                    <ProfileSettingsPanel
                      currentName={user?.name ?? ''}
                      email={user?.email ?? ''}
                      onBack={() => setSettingsOpen(false)}
                      onRenamed={(name) => syncName(name)}
                      onDeleted={() => {
                        logout()
                        navigate('/', { replace: true })
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex items-start gap-xs px-sm py-xs">
                        <span className="min-w-0 flex-1">
                          <p className="truncate text-title-sm text-ink">{displayName(user)}</p>
                          <p className="truncate text-caption font-normal text-muted">{user?.email}</p>
                        </span>
                        {/* 이름 옆 톱니 — 이름 수정과 탈퇴가 여기 들어 있다. */}
                        <button
                          type="button"
                          onClick={() => setSettingsOpen(true)}
                          aria-label="계정 설정"
                          className="-mr-xxs mt-xxs inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-card hover:text-ink"
                        >
                          <Settings size={15} />
                        </button>
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
                    </>
                  )}
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
