const KEY = 'followup.pendingInvite'

/**
 * 아직 수락하지 못한 초대 토큰을 잠깐 들고 있는다.
 *
 * 초대 메일 링크로 들어온 사람은 로그인이나 가입을 거쳐야 수락할 수 있는데,
 * 그 과정에서 초대 화면을 벗어나는 일이 흔하다(주소창에 직접 로그인 주소를 치거나,
 * 가입 후 프로젝트 목록으로 떨어지거나). 토큰을 적어 두면 어디로 돌아오든
 * 로그인한 순간 자동으로 수락할 수 있다.
 */
export function savePendingInvite(token: string) {
  try {
    if (token) localStorage.setItem(KEY, token)
  } catch {
    // 시크릿 창 등에서 저장이 막혀 있어도 초대 화면에서 직접 수락하면 된다.
  }
}

export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 지우지 못해도 수락은 한 번만 성공하므로 두 번째부터는 조용히 실패한다.
  }
}
