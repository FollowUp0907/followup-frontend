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
 * 백엔드가 completionRate 를 0~1 로 줄지 0~100 으로 줄지 명세에 없어 둘 다 받아들인다.
 * (double / 0.0 만 확인됨 — 명세 확정되면 이 함수만 고치면 된다)
 */
export function toPercent(rate?: number | null) {
  if (!rate || rate <= 0) return 0
  return Math.round(rate <= 1 ? rate * 100 : rate)
}
