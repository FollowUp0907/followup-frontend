# FollowUp — Frontend

회의록을 넣으면 AI가 결정 사항과 후속 업무를 추출하고, 다음 회의까지 이어서 관리하는 서비스의 프론트엔드입니다.

- **스택**: React 18 · TypeScript · Vite · Tailwind CSS · React Router · TanStack Query · React Hook Form · Zod · Axios · Recharts · dayjs
- **디자인**: Cal.com 디자인 시스템 토큰 (`tailwind.config.js` 에 전부 정의)
- **백엔드**: Spring Boot (AWS EC2 + RDS), OpenAPI 문서 `<백엔드 주소>/swagger-ui/index.html`

---

## 1. 로컬에서 실행하기

VS Code 에서 이 폴더를 열고 터미널에서 한 줄씩 실행하세요.

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다.

테스트 계정은 로그인 화면의 **테스트 계정 채우기** 버튼으로 채울 수 있습니다.

| 항목 | 값 |
| --- | --- |
| 이메일 | `test@followup.com` |
| 비밀번호 | `1111qqqq!` |

### 그 외 명령어

```bash
npm run build
```

```bash
npm run preview
```

```bash
npm run lint
```

`lint` 는 `tsc --noEmit` 타입 검사입니다.

---

## 2. 백엔드 연결 구조 (중요)

백엔드는 **http** 이고 CORS 가 열려 있지 않습니다. 그래서 브라우저에서 백엔드를 직접 호출하면 두 가지 이유로 막힙니다.

1. **Mixed content** — Vercel 은 https 라서 https 페이지가 http API 를 호출할 수 없습니다.
2. **CORS** — 백엔드가 임의의 오리진을 허용하지 않습니다. (`OPTIONS /api/projects` → `403 Invalid CORS request`)

그래서 이 프로젝트는 **항상 같은 오리진으로 `/api/...` 를 호출하고, 프록시가 백엔드로 넘겨주는 구조**를 씁니다.

```
[브라우저] --/api/...--> [Vite dev server 또는 Vercel 프록시 함수] --> [<백엔드 주소>/api/...]
```

| 환경 | 프록시 설정 위치 |
| --- | --- |
| 로컬 개발 | `vite.config.ts` 의 `server.proxy` |
| Vercel 배포 | `api/proxy.ts` (Vercel Function) + `vercel.json` 의 rewrite |

로컬은 `.env` 의 `VITE_DEV_PROXY_TARGET`, 배포는 Vercel 환경변수 `BACKEND_ORIGIN` 을 봅니다.
**백엔드 주소는 저장소에 두지 않습니다.** 주소가 바뀌면 배포는 Vercel 환경변수만 고치고 재배포하면 되고,
코드 변경은 필요 없습니다.

> `vercel.json` 의 rewrite destination 은 환경변수 보간을 지원하지 않습니다.
> 그래서 rewrite 로 주소를 직접 적는 대신, 런타임에 `process.env.BACKEND_ORIGIN` 을 읽는
> 프록시 함수(`api/proxy.ts`)를 두었습니다.

프록시가 `Origin` / `Referer` 를 떼어내는 것도 중요합니다. 서버 대 서버 호출에는 CORS 가 의미 없는데,
브라우저가 붙인 `Origin` 을 그대로 넘기면 백엔드 CORS 필터가 `403 Invalid CORS request` 로 막습니다.

### 환경변수

`.env` (`.env.example` 참고)

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | (빈 값) | 비워 두면 같은 오리진(`/api`)으로 호출합니다. 백엔드가 https + CORS 를 지원하게 되면 여기에 백엔드 주소를 넣어 직접 호출할 수 있습니다. |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:8080` | 로컬 dev server 가 `/api` 를 넘길 대상. 배포된 백엔드를 보려면 그 주소를 넣으세요. |

로컬 백엔드로 붙는 경우:

```bash
echo "VITE_DEV_PROXY_TARGET=http://localhost:8080" >> .env
```

### 인증

- 로그인 성공 시 받은 `accessToken` 을 `localStorage` 에 저장하고, axios 요청 인터셉터가 `Authorization: Bearer ...` 를 붙입니다.
- 백엔드에 `/api/auth/me` 같은 엔드포인트가 없어서, **JWT 의 `sub` 클레임에서 userId 를 읽습니다**. (`src/lib/auth.ts`)
- 사용자 **이름**은 토큰에 없으므로, 프로젝트 멤버 목록(`GET /api/project/{id}/members`)에서 내 userId 를 찾아 채웁니다. (`src/features/projects/ProjectContext.tsx`)
- 401 응답을 받으면 세션을 비우고 로그인 화면으로 보냅니다. (`src/api/client.ts`)

---

## 3. Vercel 배포

### 현재 배포 상태

| 항목 | 값 |
| --- | --- |
| 배포 주소 | https://followup-frontend-pied.vercel.app |
| GitHub | `FollowUp0907/followup-frontend` (public) |
| Vercel | 팀 `FollowUp` / 프로젝트 `followup-frontend` |
| 배포 기준 브랜치 | `main` |

`main` 에 push 하면 **Production 자동 배포**, 그 외 브랜치·PR 은 **Preview 자동 배포**입니다.

> 주의: `followup-frontend.vercel.app` 은 **다른 사람의 프로젝트**입니다. 위 `-pied` 주소를 쓰세요.
> `-follow-up7` 이 붙은 주소는 팀 보호(Vercel Authentication)가 걸려 외부에서 열리지 않습니다.

### 환경변수 (Vercel)

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `BACKEND_ORIGIN` | 백엔드 오리진 (예: `http://1.2.3.4:8080`) | **필수.** 프록시 함수가 읽습니다. `VITE_` 접두사가 없어 번들에 포함되지 않습니다 |
| `VITE_API_BASE_URL` | (비워 둠) | 채우면 프록시를 타지 않아 CORS·mixed content 에 막힙니다 |
| `VITE_GOOGLE_CLIENT_ID` | (선택) | 비우면 구글 로그인 버튼이 표시되지 않습니다 |

백엔드 IP 가 바뀌면 **`BACKEND_ORIGIN` 만 수정하고 재배포**하면 됩니다. 코드 변경은 필요 없습니다.
(환경변수 변경은 재배포 시점에 반영됩니다. 재배포조차 없애려면 EC2 에 Elastic IP 를 붙이거나 도메인을 두세요.)

### 수동 배포 (CLI)

```bash
npx vercel --prod --scope follow-up7
```

### 배포 후 확인

- EC2/RDS 가 **켜져 있어야** 로그인이 됩니다. 꺼져 있으면 "서버에 연결할 수 없습니다" 가 표시됩니다.
- `https://<도메인>/api/health` 가 `{"status":"ok"}` 면 프록시가 정상입니다.

---

## 4. 폴더 구조

```
src/
├─ api/                  API 호출을 리소스별로 한 곳에서 관리
│  ├─ client.ts          axios 인스턴스, 토큰 주입, 에러 정규화
│  ├─ authApi.ts         회원가입 / 로그인 / health
│  ├─ projectApi.ts      프로젝트 + 프로젝트 멤버
│  ├─ meetingApi.ts      회의
│  ├─ actionItemApi.ts   후속 업무
│  ├─ aiApi.ts           AI 분석 요청 / 조회 / 확정
│  └─ dashboardApi.ts    대시보드
├─ components/
│  ├─ ui/                디자인 시스템 컴포넌트 (Button, Field, Card, Badge, Modal, Toast, NavPillGroup …)
│  └─ layout/            TopNav, Footer, AppShell, PageHeader, RouteGuards, ErrorBoundary
├─ features/             도메인별 react-query 훅 + 컨텍스트
│  ├─ auth/              AuthContext (로그인 상태)
│  ├─ projects/          ProjectContext (프로젝트 · 멤버 · 권한 · 담당자 이름 매칭)
│  ├─ meetings/ actionItems/ analysis/ dashboard/ members/
├─ lib/                  auth(JWT), date(dayjs), constants(라벨·색), queryKeys, cn
├─ pages/                라우트 단위 화면
└─ types/api.ts          백엔드 DTO 타입 (OpenAPI 스펙 기준)
```

### 라우트

| 경로 | 화면 | 인증 |
| --- | --- | --- |
| `/` | 랜딩 | — |
| `/login`, `/signup` | 로그인 / 회원가입 | 비로그인만 |
| `/projects` | 프로젝트 목록 · 생성 | 필요 |
| `/projects/:projectId` | 프로젝트 대시보드 | 필요 |
| `/projects/:projectId/meetings` | 회의 목록 | 필요 |
| `/projects/:projectId/meetings/new` | 회의 생성 (참여자 · 이전 미완료 업무 연결 · 회의록) | 필요 |
| `/projects/:projectId/meetings/:meetingId` | 회의 상세 (회의록 편집 · 결정 사항 · 생성된 업무) | 필요 |
| `/projects/:projectId/meetings/:meetingId/analysis` | AI 분석 결과 검토 · 확정 | 필요 |
| `/projects/:projectId/tasks` | 후속 업무 보드 / 목록 + 필터 | 필요 |
| `/projects/:projectId/tasks/:actionItemId` | 업무 상세 · 수정 · 상태 변경 | 필요 |
| `/projects/:projectId/members` | 구성원 조회 · 추가 · 제거 | 필요 |
| `/projects/:projectId/settings` | 프로젝트 수정 · 삭제 | 필요 |

---

## 5. AI 분석 화면 동작

이 서비스의 핵심 화면입니다. `src/pages/AnalysisPage.tsx`

```
회의 상세에서 [AI 분석하기]
   ↓
POST /api/meeting/{meetingId}/analysis
   ├─ 201: 새 분석 생성 (status: PROCESSING)
   └─ 200: 재사용 가능한 기존 분석 반환
   ↓
status 가 PROCESSING 인 동안 GET /api/analysis/{id} 를 2초 간격으로 폴링
   ↓
GENERATED → 초안을 편집 가능한 로컬 상태로 옮김
   ├─ AI 가 준 assigneeName(문자열)을 프로젝트 멤버 이름과 매칭해 userId 로 변환
   │   (완전 일치 → 공백 제거 후 포함 관계 순으로 매칭, 실패하면 "담당자를 찾지 못했습니다" 경고)
   ├─ 항목 수정 / 추가 / 삭제
   └─ 확정 전에는 서버에 아무것도 저장되지 않음
   ↓
POST /api/analysis/{id}/confirm  ← 사용자가 확정한 값만 전송
   ↓
후속 업무 생성 → 업무 보드로 이동
```

- `FAILED` 상태면 백엔드가 준 `errorMessage` 를 그대로 보여주고, **회의록 수정** / **다시 분석** 두 가지 선택지를 줍니다. 실패해도 회의록은 그대로 남습니다.
- `CONFIRMED` 상태면 편집이 잠기고 읽기 전용으로 표시됩니다.

---

## 6. 알려진 제약

- **`GET /api/project/{id}/action-items` 응답에 `originMeetingId` 가 없습니다.** 그래서 "이 회의에서 생성된 후속 업무" 는 목록을 받은 뒤 상세를 각각 조회해 클라이언트에서 조인합니다. (`src/features/actionItems/useMeetingActionItems.ts`) 목록 응답에 `originMeetingId` 가 추가되면 이 훅은 통째로 지울 수 있습니다.
- **`memberProgress.completionRate` 의 단위(0~1 인지 0~100 인지)가 명세에 없습니다.** 지금은 둘 다 받아들이도록 처리했습니다. (`toPercent()` in `src/lib/date.ts`)
- **Cal Sans** 는 Cal.com 전용 폰트라 공개 웹폰트가 없습니다. Inter 600 + 음수 자간(-0.5 ~ -2px)으로 대체했습니다.

---

## 7. 구글 로그인 설정

구글 로그인은 **`VITE_GOOGLE_CLIENT_ID` 가 설정돼 있을 때만** 로그인/회원가입 화면에 버튼이 나타납니다.
비워 두면 버튼이 아예 렌더링되지 않으므로, 설정 전에도 앱은 정상 동작합니다.

### 7-1. Google Cloud Console

1. https://console.cloud.google.com → 프로젝트 생성(또는 선택)
2. **API 및 서비스 → OAuth 동의 화면** 설정 (External / 앱 이름 / 지원 이메일)
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 자바스크립트 원본**에 추가 (리디렉션 URI 는 필요 없습니다)
     ```
     http://localhost:3000
     https://<vercel-배포-도메인>
     ```
4. 생성된 **클라이언트 ID** 를 복사

### 7-2. 프론트 설정

`.env` 에 넣습니다.

```
VITE_GOOGLE_CLIENT_ID=1234567890-xxxxxxxx.apps.googleusercontent.com
```

Vercel 은 **Settings → Environment Variables** 에 같은 이름으로 추가한 뒤 재배포하세요.

> 환경변수를 바꾸면 dev 서버를 **재시작**해야 반영됩니다.

### 7-3. 백엔드 (필수)

**백엔드에 `POST /api/auth/google` 이 있어야 실제 로그인이 됩니다.**
구글 ID 토큰만으로는 우리 API 를 호출할 수 없고, 백엔드가 검증 후 자체 JWT 를 발급해야 하기 때문입니다.

명세와 Spring 구현 예시는 [BACKEND_NOTES.md](./BACKEND_NOTES.md) 마지막 섹션에 정리해 뒀습니다.
백엔드와 프론트는 **같은 클라이언트 ID** 를 써야 합니다. (백엔드는 `aud` 검증에 사용)

이 API 가 없는 동안 버튼을 누르면 *"백엔드에 구글 로그인 API(/api/auth/google)가 아직 없습니다"* 안내가 표시되고,
이메일 로그인은 그대로 사용할 수 있습니다.

### 동작 흐름

```
구글 버튼 클릭
   ↓  Google Identity Services 가 ID 토큰 발급
POST /api/auth/google { idToken }
   ↓  백엔드가 구글 공개키로 검증 → 없으면 자동 가입 → 우리 JWT 발급
{ accessToken, tokenType, expiresIn }   ← 기존 로그인과 동일한 응답
   ↓  localStorage 저장 → /projects 이동
```

관련 파일: `src/lib/googleAuth.ts`, `src/components/auth/GoogleLoginButton.tsx`, `src/api/authApi.ts`

---

## 8. 만약 Vercel 의 `/api` 프록시가 동작하지 않으면

`vercel.json` 의 rewrite 는 대상이 `http://` 인 외부 주소입니다. 혹시 이 방식이 막히면(502 등),
아래 서버리스 함수로 바꾸면 동일하게 동작합니다.

1. `api/[...path].ts` 파일을 만들고 아래 내용을 넣습니다.

```ts
// api/[...path].ts — Vercel 서버리스 프록시 (rewrite 대안)
export const config = { runtime: 'nodejs' }

const BACKEND = process.env.BACKEND_ORIGIN

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const target = BACKEND + url.pathname + url.search

  const headers = new Headers(req.headers)
  headers.delete('host')
  headers.delete('content-length')

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
  })

  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  })
}
```

2. `vercel.json` 에서 `/api/:path*` rewrite 를 **지웁니다.** (SPA fallback rewrite 는 그대로 둡니다)

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

프론트 코드는 그대로 `/api/...` 를 호출하므로 수정할 필요가 없습니다.
