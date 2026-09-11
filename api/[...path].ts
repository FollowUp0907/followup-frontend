import type { IncomingMessage, ServerResponse } from 'node:http'

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
 * 시그니처 주의:
 *   Vercel 의 Node 런타임은 Web Request 가 아니라 Node 의 (req, res) 를 넘긴다.
 *   req.url 도 절대 URL 이 아니라 경로만 온다.
 *
 * 로컬 개발은 이 함수를 타지 않는다. vite dev server 가 /api 를
 * VITE_DEV_PROXY_TARGET 으로 프록시한다. (vite.config.ts)
 */

/** 홉 단위 헤더 — 그대로 넘기면 안 된다. */
const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'te',
  'trailer',
])

/**
 * fetch 가 응답 본문을 이미 풀어서 주기 때문에, 원본의 인코딩/길이 헤더를
 * 그대로 넘기면 브라우저가 깨진 본문으로 읽는다.
 */
const STRIP_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
])

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(body))
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = process.env.BACKEND_ORIGIN
  if (!origin) {
    sendJson(res, 500, {
      code: 'BACKEND_ORIGIN_MISSING',
      message: '서버 설정이 올바르지 않습니다. (BACKEND_ORIGIN 미설정)',
    })
    return
  }

  const host = req.headers.host ?? 'localhost'
  const incoming = new URL(req.url ?? '/', `https://${host}`)

  // 파일명이 [...path].ts 라서 Vercel 이 잡은 세그먼트를 "...path" 쿼리로 덧붙인다.
  // 백엔드로 새어 나가면 안 되는 값이라 떼어낸다.
  incoming.searchParams.delete('...path')

  const target = new URL(incoming.pathname + incoming.search, origin)

  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (STRIP_REQUEST_HEADERS.has(key.toLowerCase()) || value === undefined) continue
    headers[key] = Array.isArray(value) ? value.join(', ') : value
  }

  // fetch 의 BodyInit 은 Buffer 를 직접 받지 않는다. ArrayBuffer 로 넘긴다.
  let body: ArrayBuffer | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const buf = Buffer.concat(chunks)
    body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  }

  let upstream: Response
  try {
    upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual' })
  } catch {
    sendJson(res, 502, {
      code: 'BACKEND_UNREACHABLE',
      message: '백엔드 서버에 연결할 수 없습니다.',
    })
    return
  }

  res.statusCode = upstream.status

  // set-cookie 는 여러 개일 수 있어 따로 꺼낸다.
  const setCookie = upstream.headers.getSetCookie?.() ?? []
  if (setCookie.length) res.setHeader('set-cookie', setCookie)

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (STRIP_RESPONSE_HEADERS.has(lower) || lower === 'set-cookie') return
    res.setHeader(key, value)
  })

  res.end(Buffer.from(await upstream.arrayBuffer()))
}
