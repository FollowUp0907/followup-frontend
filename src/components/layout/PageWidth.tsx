import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 본문 폭.
 *
 * 예전에는 화면마다 폭을 다르게 뒀는데(1120 등), 그러면 레이아웃이 잡아 주는
 * 1200 보다 좁아져서 후속 업무 화면만 넓고 나머지는 양옆이 남는 모양이 됐다.
 * 지금은 **모든 화면이 레이아웃 폭을 그대로 쓴다.** 상자가 페이지에 딱 맞는다.
 *
 * size 는 호출부를 한 번에 고치지 않으려고 남겨 뒀다. 특정 화면만 다시 좁히고
 * 싶으면 여기서 되살리면 된다.
 */
export function PageWidth({
  children,
  className,
}: {
  size?: number
  children: ReactNode
  className?: string
}) {
  return <div className={cn('w-full', className)}>{children}</div>
}
