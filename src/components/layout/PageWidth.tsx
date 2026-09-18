import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 시안은 화면마다 본문 폭이 다르다. (대시보드·업무 보드 1080 / 회의 목록 900 /
 * 회의 상세 800 / 회의 작성 720 / 구성원 720 / 설정 600)
 * ProjectLayout 이 1080 까지 잡아 주므로, 그보다 좁은 화면만 이걸로 한 번 더 조인다.
 */
const WIDTH = {
  600: 'max-w-[600px]',
  720: 'max-w-[720px]',
  800: 'max-w-[800px]',
  900: 'max-w-[900px]',
  1040: 'max-w-[1040px]',
  960: 'max-w-[960px]',
  1080: 'max-w-[1080px]',
  1120: 'max-w-[1120px]',
  1200: 'max-w-[1200px]',
} as const

export function PageWidth({
  size,
  children,
  className,
}: {
  size: keyof typeof WIDTH
  children: ReactNode
  className?: string
}) {
  return <div className={cn('mx-auto w-full', WIDTH[size], className)}>{children}</div>
}
