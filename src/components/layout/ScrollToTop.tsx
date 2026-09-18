import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * 페이지를 옮기면 맨 위로 되돌린다.
 *
 * 셸이 뷰포트에 딱 맞고 본문(<main>)만 안에서 스크롤하도록 바뀌어서,
 * window 만 올리면 아무 일도 일어나지 않는다. 실제로 스크롤되는 상자를 찾아 올린다.
 * (창 자체가 스크롤되는 화면 — 랜딩 등 — 도 있으니 window 도 같이 올린다)
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.querySelectorAll('main').forEach((el) => {
      el.scrollTop = 0
    })
  }, [pathname])
  return null
}
