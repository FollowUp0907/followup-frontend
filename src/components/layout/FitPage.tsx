import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 한 화면에 딱 맞는 페이지.
 *
 * 상단바(64 + 아래 테두리 1) 와 레이아웃의 위아래 여백(24 + 24) 을 뺀 높이를 차지한다.
 * 1px 을 빠뜨리면 그만큼 넘쳐서 스크롤바가 생기고, 그 폭만큼 오른쪽 여백이 어긋난다.
 * 그래서 어느 페이지를 열어도 **아래 여백이 좌우·위와 똑같이 24px** 로 끝난다.
 * 내용이 넘치면 페이지가 길어지는 대신 안쪽 목록에서만 스크롤된다.
 *
 * 쓰는 쪽은 flex 컬럼으로 짜고, 늘어나야 하는 부분에 flex-1 min-h-0 을 준다.
 */
export function FitPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex h-[calc(100dvh-113px)] min-h-[520px] flex-col', className)}>{children}</div>
}
