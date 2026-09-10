import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import relativeTime from 'dayjs/plugin/relativeTime'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

dayjs.extend(relativeTime)
dayjs.extend(isSameOrBefore)
dayjs.locale('ko')

export const DATE_FORMAT = 'YYYY-MM-DD'
export const DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss'

/** 마감 임박 기준 (일). 대시보드 API 와 별개로 목록 화면에서 뱃지를 붙일 때 사용 */
export const DUE_SOON_DAYS = 3

export function formatDate(value?: string | null) {
  if (!value) return '—'
  return dayjs(value).format('YYYY.MM.DD')
}

export function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return dayjs(value).format('YYYY.MM.DD HH:mm')
}

export function formatRelative(value?: string | null) {
  if (!value) return '—'
  return dayjs(value).fromNow()
}

/** <input type="date"> 용 */
export function toDateInput(value?: string | null) {
  if (!value) return ''
  return dayjs(value).format(DATE_FORMAT)
}

/** <input type="datetime-local"> 용 */
export function toDateTimeLocalInput(value?: string | null) {
  if (!value) return ''
  return dayjs(value).format('YYYY-MM-DDTHH:mm')
}

/** datetime-local 값을 백엔드가 받는 YYYY-MM-DDTHH:mm:ss 로 */
export function fromDateTimeLocalInput(value: string) {
  return dayjs(value).format(DATETIME_FORMAT)
}

/** 남은 일수. 음수면 지연. */
export function daysUntil(dueDate?: string | null): number | null {
  if (!dueDate) return null
  return dayjs(dueDate).startOf('day').diff(dayjs().startOf('day'), 'day')
}

export function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'DONE') return false
  const d = daysUntil(dueDate)
  return d !== null && d < 0
}

export function isDueSoon(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'DONE') return false
  const d = daysUntil(dueDate)
  return d !== null && d >= 0 && d <= DUE_SOON_DAYS
}

/** D-2 / D-day / D+3 */
export function dDayLabel(dueDate?: string | null) {
  const d = daysUntil(dueDate)
  if (d === null) return null
  if (d === 0) return 'D-day'
  return d > 0 ? `D-${d}` : `D+${Math.abs(d)}`
}

export { dayjs }

/**
 * memberProgress.completionRate 는 0~1 스케일이다.
 * (2026-09-10 실측: doneCount 1 / totalCount 1 -> completionRate 1.0)
 *
 * 다만 백엔드가 doneCount / totalCount 도 함께 주기 때문에, 화면에서는 그쪽을 우선 쓰고
 * completionRate 는 카운트가 없을 때의 보조값으로만 쓴다.
 */
export function toPercent(rate?: number | null) {
  if (!rate || rate <= 0) return 0
  return Math.round(Math.min(rate, 1) * 100)
}

/** 담당자별 진행률. 카운트가 있으면 카운트로 계산하는 쪽이 표시와 항상 일치한다. */
export function progressPercent(doneCount?: number | null, totalCount?: number | null, rate?: number | null) {
  if (totalCount && totalCount > 0) return Math.round(((doneCount ?? 0) / totalCount) * 100)
  return toPercent(rate)
}

/* ---------- 서버 생성 시각 (UTC, 오프셋 없음) ---------- */

/**
 * 백엔드는 서버가 만든 시각(createdAt / updatedAt / joinedAt / completedAt / confirmedAt)을
 * UTC 기준 LocalDateTime 으로, 오프셋 없이 내려준다.  예) "2026-09-10T08:01:48.439004259"
 * 이걸 그대로 파싱하면 브라우저가 로컬 시간으로 읽어 KST 에서 9시간 빨라진다.
 *
 * 반대로 scheduledAt / dueDate 는 사용자가 입력한 값을 그대로 저장하고 그대로 돌려준다
 * (보낸 값 == 받은 값). 그래서 그쪽은 변환 없이 formatDateTime / formatDate 를 쓴다.
 *
 * 나중에 백엔드가 오프셋(Z 또는 +09:00)을 붙여 주면 아래 정규식이 걸러 내므로 그대로 동작한다.
 */
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/

export function parseServerTime(value?: string | null) {
  if (!value) return null
  const d = dayjs(HAS_OFFSET.test(value) ? value : `${value}Z`)
  return d.isValid() ? d : null
}

export function formatServerDate(value?: string | null) {
  return parseServerTime(value)?.format('YYYY.MM.DD') ?? '—'
}

export function formatServerDateTime(value?: string | null) {
  return parseServerTime(value)?.format('YYYY.MM.DD HH:mm') ?? '—'
}

export function formatServerRelative(value?: string | null) {
  return parseServerTime(value)?.fromNow() ?? '—'
}
