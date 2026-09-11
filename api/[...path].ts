/**
 * 백엔드 프록시 (Vercel Function)
 *
 * 왜 rewrite 대신 함수인가:
 *   vercel.json 의 rewrite destination 은 환경변수 보간을 지원하지 않아서
 *   백엔드 주소를 저장소에 박아야 한다. public 저장소면 EC2 주소가 그대로 공개되고,
 *   IP 가 바뀔 때마다 코드를 고쳐 커밋해야 한다.
 *   이 함수는 BACKEND_ORIGIN 을 런타임에 읽으므로, IP 가 바뀌면
 *   Vercel 환경변수만 바꾸고 재배포하면 된다. (코드 변경 없음)
 *
 * 왜 프록시인가:
 *   브라우저 --https--> Vercel --http--> 백엔드
 *   서버 대 서버 호출이라 CORS 와 mixed content 를 둘 다 피한다.
 *   백엔드에 CORS 가 열리고 https 가 붙으면 이 함수를 지우고
 *   VITE_API_BASE_URL 에 백엔드 주소를 직접 넣으면 된다.
 *
 * 로컬 개발은 이 함수를 타지 않는다. vite dev server 가 /api 를
 * VITE_DEV_PROXY_TARGET 으로 프록시한다. (vite.config.ts)
 */

/** 홉 단위 헤더 — 그대로 넘기면 안 된다. */
const STRIP_REQUEST_HEADERS = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade']

/**
 * fetch 가 응답 본문을 이미 풀어서 주기 때문에, 원본의 인코딩/길이 헤더를
 * 그대로 넘기면 브라우저가 깨진 본문으로 읽는다.
 */
const STRIP_RESPONSE_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export default async function handler(request: Request): Promise<Response> {
  const origin = process.env.BACKEND_ORIGIN
  if (!origin) {
    return json(
      { code: 'BACKEND_ORIGIN_MISSING', message: '서버 설정이 올바르지 않습니다. (BACKEND_ORIGIN 미설정)' },
      500,
    )
  }

  const incoming = new URL(request.url)
  const target = new URL(incoming.pathname + incoming.search, origin)

  const headers = new Headers(request.headers)
  for (const h of STRIP_REQUEST_HEADERS) headers.delete(h)

  const init: RequestInit = { method: request.method, headers, redirect: 'manual' }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // 본문을 통째로 읽어 넘긴다. 회의록이 길어질 수 있어 스트리밍이 이상적이지만,
    // 런타임에 따라 duplex 옵션이 필요해서 단순하게 간다.
    init.body = await request.arrayBuffer()
  }

  let upstream: Response
  try {
    upstream = await fetch(target, init)
  } catch {
    return json({ code: 'BACKEND_UNREACHABLE', message: '백엔드 서버에 연결할 수 없습니다.' }, 502)
  }

  const responseHeaders = new Headers(upstream.headers)
  for (const h of STRIP_RESPONSE_HEADERS) responseHeaders.delete(h)

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}
