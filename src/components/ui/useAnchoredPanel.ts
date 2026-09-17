import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'

/**
 * 뜨는 패널(드롭다운·메뉴·색 판)을 여는 버튼에 붙여 놓는다.
 *
 * 패널을 body 로 포털한 뒤 이 훅이 주는 style 을 그대로 얹으면 된다.
 * 왜 포털이 필요하냐면, 이 앱의 패널들이 overflow 가 걸린 상자 안에서 열리기 때문이다.
 *   - 후속 업무 목록의 표      → overflow-x-auto  (x 가 auto 면 y 도 auto 가 된다)
 *   - 구성원 목록 카드          → overflow-hidden
 * 그 안에서 absolute 로 띄우면 상자에 갇혀 잘린다.
 *
 * 아래 공간이 모자라면 위로 뒤집고, 화면 오른쪽 끝에서는 안으로 당긴다.
 * 스크롤·리사이즈를 따라다닌다 — capture 로 받아야 표처럼 안쪽 스크롤도 잡힌다.
 */
export function useAnchoredPanel(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  {
    width,
    minWidth = 0,
    align = 'left',
    estimatedHeight = 240,
    gap = 4,
  }: {
    /** 숫자면 그 폭, 'anchor' 면 버튼과 같은 폭 */
    width: number | 'anchor'
    minWidth?: number
    /** 버튼의 왼쪽에 맞출지 오른쪽에 맞출지 */
    align?: 'left' | 'right'
    /** 위로 뒤집을지 판단할 때 쓰는 대략적인 높이 */
    estimatedHeight?: number
    gap?: number
  },
) {
  const [box, setBox] = useState({ top: 0, left: 0, width: 0 })
  const [dropUp, setDropUp] = useState(false)

  const place = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const up = r.bottom + estimatedHeight > window.innerHeight && r.top > estimatedHeight
    const w = Math.max(width === 'anchor' ? r.width : width, minWidth)
    const raw = align === 'right' ? r.right - w : r.left
    setDropUp(up)
    setBox({
      top: up ? r.top - gap : r.bottom + gap,
      left: Math.max(8, Math.min(raw, window.innerWidth - w - 8)),
      width: width === 'anchor' ? r.width : width,
    })
  }, [anchorRef, width, minWidth, align, estimatedHeight, gap])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onMove = () => place()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, place])

  const style: CSSProperties = {
    top: box.top,
    left: box.left,
    width: box.width,
    // 위로 뒤집을 때는 높이를 몰라도 되도록 자기 높이만큼 끌어올린다.
    transform: dropUp ? 'translateY(-100%)' : undefined,
  }

  return { dropUp, style }
}
