/**
 * Google Identity Services (GIS) 로더.
 *
 * 흐름:
 *   구글 버튼 클릭 → 구글이 ID 토큰(credential) 발급
 *   → POST /api/auth/google { idToken } → 백엔드가 검증 후 우리 JWT 발급
 *
 * 구글 ID 토큰만으로는 우리 백엔드 API 를 호출할 수 없다.
 * 반드시 백엔드가 검증하고 자체 accessToken 을 내려 줘야 한다.
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

/** 클라이언트 ID 가 설정돼 있어야만 구글 로그인 UI 를 노출한다. */
export const isGoogleLoginEnabled = () => GOOGLE_CLIENT_ID.length > 0

export interface GoogleCredentialResponse {
  credential: string
  select_by?: string
}

interface GoogleButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    use_fedcm_for_prompt?: boolean
  }) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
  disableAutoSelect: () => void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } }
  }
}

let loadPromise: Promise<GoogleAccountsId> | null = null

/** GIS 스크립트를 한 번만 로드한다. (필요한 화면에서만 불러오도록 동적 로딩) */
export function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (loadPromise) return loadPromise

  loadPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    const script = existing ?? document.createElement('script')

    const onLoad = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('구글 로그인 스크립트를 초기화하지 못했습니다.'))
    }
    const onError = () => {
      loadPromise = null
      reject(new Error('구글 로그인 스크립트를 불러오지 못했습니다. 네트워크를 확인해 주세요.'))
    }

    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })

    if (!existing) {
      script.src = GIS_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }
  })

  return loadPromise
}
