/**
 * 프로젝트 구성원 상한.
 *
 * 백엔드에 이 제한이 없어서 화면에서 막는다. 서버가 같은 제한을 갖게 되면
 * 그때는 서버 응답의 오류 메시지를 그대로 보여 주면 된다.
 */
export const MAX_MEMBERS = 10

export const memberLimitMessage = `구성원은 최대 ${MAX_MEMBERS}명까지 추가할 수 있습니다.`

export function isMemberLimitReached(count: number) {
  return count >= MAX_MEMBERS
}
