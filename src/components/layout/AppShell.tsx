import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

/**
 * 셸이 뷰포트 높이에 딱 맞고, 넘치는 건 본문 안에서만 스크롤된다.
 * 그래서 창 전체를 움직이는 바깥 스크롤바가 생기지 않는다.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <TopNav />
      <main className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="container-content py-xxl">{children}</div>
      </main>
    </div>
  )
}
