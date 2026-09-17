import { useSyncExternalStore } from 'react'

/**
 * 구성원이 직접 고른 아바타 색.
 *
 * 백엔드에 저장할 자리가 없어서 이 브라우저에만 남는다. 다른 기기에서는
 * 다시 이름 기반 기본색으로 보인다. (서버에 필드가 생기면 여기만 갈아 끼우면 된다)
 *
 * Avatar 는 이름만 받기 때문에 **이름을 열쇠로** 쓴다. 그래야 보드·목록·알림 등
 * 아바타가 나오는 모든 곳에서 고른 색이 한 번에 반영된다.
 * 대신 같은 이름이 둘이면 색을 같이 쓰게 된다 — 색이 겹치는 것뿐이라 그냥 둔다.
 */

const KEY = 'followup.avatarColors'

type Overrides = Record<string, string>

const EMPTY: Overrides = {}
let cache: Overrides | null = null
const listeners = new Set<() => void>()

function read(): Overrides {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    cache =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Overrides) : EMPTY
  } catch {
    // 시크릿 모드처럼 저장소가 막힌 경우 — 기본색으로 돈다.
    cache = EMPTY
  }
  return cache
}

function emit() {
  listeners.forEach((fn) => fn())
}

/** color 가 null 이면 기본색(이름으로 고른 색)으로 되돌린다. */
export function setAvatarColor(name: string, color: string | null) {
  const next = { ...read() }
  if (color) next[name] = color
  else delete next[name]
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀도 이번 세션에는 반영된다.
  }
  emit()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 아바타가 그려지는 모든 곳이 이걸 구독해서, 색을 고르면 즉시 같이 바뀐다. */
export function useAvatarColors() {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}
