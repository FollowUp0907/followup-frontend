/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 알림 SSE 전용 백엔드 주소. 비어 있으면 SSE 를 켜지 않는다. */
  readonly VITE_SSE_ORIGIN?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_DEV_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
