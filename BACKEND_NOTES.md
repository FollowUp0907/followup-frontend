# 백엔드에 전달할 내용 (프론트 연동하면서 확인한 것)

배포된 API(EC2, 주소는 `.env` 참고)에 실제로 붙여서 전체 플로우를 돌려 본 결과입니다.
**2026-09-10 재검증 완료** — 지난번 열어 둔 질문들은 직접 호출해서 답을 확인했고, 새로 발견한 것 하나(1번)를 맨 위에 넣었습니다.

## ✅ 요청하신 두 가지 확인 — 모두 정상

새 프로젝트 8 / 새 계정 `member1@followup.com` 으로 확인했습니다.

| 확인 항목 | 결과 |
| --- | --- |
| 테스트 계정으로 프로젝트 생성 → OWNER 부여 | ✅ `role: "OWNER"` |
| 새 계정 회원가입 → 초대 → MEMBER 부여 | ✅ `role: "MEMBER"` |
| 중복 초대 | ✅ 409 `PROJECT_MEMBER_ALREADY_EXISTS` |
| 가입 안 한 이메일 초대 | ✅ 404 `USER_NOT_FOUND` |
| OWNER 제거 시도 | ✅ 409 `PROJECT_OWNER_CANNOT_BE_REMOVED` |

에러 코드/메시지가 일관돼서 프론트에서 분기하기 좋았습니다.

전체 플로우(회의 생성 → AI 분석 → 확정 → 후속 업무 생성 → 상태 변경 → 대시보드 반영)도 끝까지 동작했습니다.

> 테스트하면서 **프로젝트 8**(회의 8, 후속 업무 11·12, 분석 6·7, 결정 사항 1건)과 **계정 `member1@followup.com`(userId 8)** 이 생겼습니다. 필요 없으면 지우셔도 됩니다.

---

## 1. 🆕 서버가 만든 시각이 UTC 인데 오프셋이 없습니다 (우선순위 높음, 수정 쉬움)

가장 눈에 띄는 문제입니다. **화면에 시간이 9시간 빨리 찍힙니다.**

```
실제 생성 시각: 2026-09-10 17:01 KST
API 응답:      "createdAt": "2026-09-10T08:01:48.439004259"   ← UTC 인데 Z 도 +09:00 도 없음
```

오프셋이 없으면 브라우저는 이 값을 **로컬 시간(KST)** 으로 읽습니다. 그래서 방금 만든 프로젝트가 "9시간 전"으로 표시됐습니다.

해당 필드: `createdAt` · `updatedAt` · `joinedAt` · `completedAt` · `confirmedAt` (서버가 만드는 시각 전부)

**한편 `scheduledAt` 은 보낸 값이 그대로 돌아옵니다** (`2026-09-11T14:00:00` → `2026-09-11T14:00:00`). 사용자가 입력한 값이라 이건 이대로가 맞습니다.
즉 지금 API 안에 **성격이 다른 두 종류의 시각이 같은 모양으로 섞여 있습니다.**

**고치는 방법 (셋 중 하나)**

```java
// 1) 가장 깔끔 — 서버 생성 시각은 Instant / OffsetDateTime 으로
//    → "2026-09-10T08:01:48.439Z"
private Instant createdAt;

// 2) LocalDateTime 을 유지한다면 JVM/DB 타임존을 KST 로 맞추고 오프셋을 붙여 직렬화
spring.jackson.time-zone=Asia/Seoul

// 3) 최소 수정 — 문자열 끝에 Z 만 붙여도 프론트는 정상 동작합니다
```

**프론트는 이미 대응해 뒀습니다.** 오프셋이 없으면 UTC 로 간주해서 변환합니다(`src/lib/date.ts` 의 `parseServerTime`).
나중에 백엔드가 `Z` 나 `+09:00` 을 붙여 주면 그 값을 그대로 쓰므로, **고쳐 주셔도 프론트는 수정 없이 동작합니다.**

## 2. CORS 가 막혀 있어 브라우저에서 직접 호출이 불가능합니다 (우선순위 높음)

```
OPTIONS /api/projects
Origin: https://example.vercel.app
→ 403 "Invalid CORS request"
```

여기에 더해 백엔드가 **http** 라서, https 인 Vercel 페이지에서는 mixed content 로도 막힙니다.

**프론트에서는 프록시(로컬은 Vite, 배포는 Vercel rewrites)로 우회해 두었기 때문에 지금 당장 막히지는 않습니다.**
다만 아래 중 하나가 되면 구조가 훨씬 단순해집니다.

- `CorsConfiguration` 에 배포 도메인(`https://*.vercel.app`, 확정 도메인)과 `http://localhost:3000` 허용
- 가능하면 ALB/Nginx + 인증서로 **https** 제공

## 3. `/api/auth/me` 같은 내 정보 조회 API 가 있으면 좋겠습니다

`POST /api/auth/login` 응답이 `accessToken` / `tokenType` / `expiresIn` 뿐이고, JWT 페이로드도 `sub`(userId)만 있습니다. (실측: `{"sub":"7","iat":...,"exp":...}`)
그래서 **로그인한 사용자의 이름·이메일을 알 방법이 없습니다.**

지금은 이렇게 우회했습니다.
- userId → JWT `sub` 파싱
- 이메일 → 로그인 폼에 입력한 값을 그대로 저장
- 이름 → 프로젝트에 들어가서 멤버 목록에 내 userId 가 있으면 그때 채움 (프로젝트 밖에서는 이름을 못 보여 줍니다)

`GET /api/auth/me → { userId, name, email }` 하나만 있으면 전부 해결됩니다.

## 4. 후속 업무 목록 응답에 `originMeetingId` 를 넣어 주세요

`ActionItemListResDto` 에는 `originMeetingId` 가 없고 `ActionItemDetailResDto` 에만 있습니다. (오늘도 동일)
"이 회의에서 생성된 후속 업무" 를 보여주려면 지금은 **목록을 받은 뒤 항목마다 상세를 한 번씩 더 조회**해야 합니다. (업무 N개 = 요청 N+1회)

목록에 `originMeetingId` 하나만 추가되면 요청 1회로 끝납니다.
같은 맥락에서 `assigneeName` 도 목록에 있으면 좋습니다. (지금은 멤버 목록과 클라이언트에서 조인 중)

## 5. 분석 확정 후에도 회의 `status` 가 `DRAFT` 로 남습니다 (오늘 재현됨)

```
POST /api/analysis/6/confirm  → 200, analysis.status = CONFIRMED, 후속 업무 2건 생성됨
GET  /api/meeting/8           → status = "DRAFT"     ← 그대로
```

`CONFIRMED` 로 바뀌는 게 맞다면 확정 시점에 함께 갱신해 주세요.
회의 목록/대시보드에서 이 값으로 "작성 중 / 분석 확정" 뱃지를 그리고 있어서, 지금은 확정한 회의도 계속 "작성 중"으로 보입니다.

## 6. `PATCH` 로 담당자·마감일을 **비울 수 없습니다**

```
PATCH /api/action-item/11  { "assigneeUserId": null, "dueDate": null }
→ 200 이지만 두 값 모두 이전 값 그대로 유지됨
```

null 을 "값 지우기"로 처리해 주시면 좋겠습니다. (`Optional` 필드나 `JsonNullable` 등)

지금 프론트는 **저장 결과를 응답과 비교해서, 비우려던 값이 남아 있으면 "담당자 · 마감일은 지금 비울 수 없어 이전 값이 유지됐습니다" 라고 알려 줍니다.**
(그냥 두면 "수정했습니다" 라고 뜨는데 실제로는 안 바뀌어서 사용자가 속습니다.)

## 7. AI 분석이 Gemini 503 으로 자주 실패합니다

```json
{"code":503,"message":"This model is currently experiencing high demand...","status":"UNAVAILABLE"}
```

> 오늘 테스트에서는 2회 모두 성공했습니다 (`gemini-3.6-flash` / `gemini-v1`).

프론트는 `FAILED` 상태를 받으면 `errorMessage` 를 그대로 보여주고 **다시 분석** 버튼을 노출합니다.
백엔드 쪽에서도 짧은 재시도(예: 2회, 지수 백오프)를 넣어 주시면 사용자가 보는 실패가 크게 줄어들 것 같습니다.

작은 것 하나: `draft.actionItems[].priorityReason` 이 계속 `null` 로 옵니다. 프롬프트에서 안 뽑고 있는 것 같은데, 화면에 "AI 추천 이유" 자리를 만들어 둬서 채워지면 바로 보입니다.

---

## ✅ 지난번 질문 — 직접 호출해서 답을 확인했습니다

수정하실 건 없고, 프론트가 어떻게 맞춰 뒀는지만 공유합니다.

| 질문 | 확인된 동작 | 프론트 대응 |
| --- | --- | --- |
| 재분석 판정 기준 | **회의록이 바뀌면 새로 생성(201), 그대로면 기존 분석 재사용(200)** | "다시 분석" 버튼 아래에 이 규칙을 그대로 안내 |
| `status=TODO,IN_PROGRESS` 다중 값 | ❌ 400 `INVALID_ACTION_ITEM_STATUS` (소문자 `todo` 는 200 으로 허용됨) | 전체를 받아 클라이언트에서 필터 |
| `completionRate` 단위 | **0~1** (done 1 / total 1 → `1.0`) | 확정. 다만 `doneCount`/`totalCount` 로 계산하는 쪽을 우선 사용 |
| `assigneeUserId: null` / `dueDate: null` | 무시됨 → 위 **6번** 참고 | 저장 후 응답과 비교해 사용자에게 안내 |

**아직 열려 있는 질문**

- 회의 목록 / 후속 업무 목록에 **페이지네이션** 계획이 있나요? 지금은 전체를 한 번에 받는 전제로 구현돼 있습니다.
- 대시보드 `dueSoonActionItems` 의 "임박" 기준이 며칠인가요? (D-5 짜리 업무가 안 잡혀서 3일 이내로 추측 중입니다. 프론트 목록 화면 뱃지도 같은 값으로 맞추고 싶습니다)

---

# 🔴 추가 요청: 구글 로그인 API (`POST /api/auth/google`)

프론트에 구글 로그인 UI 와 연동 코드를 **전부 붙여 뒀습니다.** 백엔드에 엔드포인트 하나만 추가되면 바로 동작합니다.
현재는 이 API 가 없어서, 프론트가 404/405 를 받으면 *"백엔드에 구글 로그인 API가 아직 없습니다"* 라고 안내하고 있습니다.

## 왜 백엔드가 필요한가

구글이 발급한 ID 토큰으로는 우리 API 를 호출할 수 없습니다.
**백엔드가 구글 토큰을 검증하고 → 우리 서비스의 `accessToken` 을 발급**해 줘야, 기존 API 들이 그대로 인증을 통과합니다.

```
[브라우저]
  구글 로그인 버튼 클릭
      ↓
  구글이 ID 토큰(JWT) 발급
      ↓
  POST /api/auth/google { idToken }
      ↓
[백엔드]
  1. 구글 공개키로 ID 토큰 서명 검증
  2. aud == 우리 클라이언트 ID 확인
  3. iss == "accounts.google.com" 또는 "https://accounts.google.com" 확인
  4. exp 만료 확인
  5. email_verified == true 확인
  6. email 로 사용자 조회 → 없으면 자동 가입 (name = 구글 프로필 이름)
  7. 기존 로그인과 동일한 TokenResDto 발급
      ↓
  { accessToken, tokenType, expiresIn }   ← 기존 /api/auth/login 과 같은 응답
```

## 요청 / 응답 명세

### `POST /api/auth/google`

인증 불필요 (permitAll)

**Request**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `idToken` | string | O | Google Identity Services 가 발급한 ID 토큰(JWT) |

**Response 200**

기존 `TokenResDto` 를 **그대로** 재사용해 주세요. 프론트가 이미 그 타입으로 받고 있습니다.

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400000
}
```

**에러**

| 상태 | 상황 |
| --- | --- |
| 400 | `idToken` 누락 / 형식 오류 |
| 401 | 서명 검증 실패, 만료, `aud` 불일치, `email_verified == false` |
| 409 | (선택) 같은 이메일이 이미 비밀번호 계정으로 가입돼 있어 연결을 막고 싶을 때 |

프론트는 `ErrorResponse { code, message }` 의 `message` 를 사용자에게 그대로 보여줍니다.
사용자에게 보여도 되는 문장으로 내려 주세요.

## 검증 구현 (Spring)

`google-api-client` 의 `GoogleIdTokenVerifier` 를 쓰면 1~5번이 한 번에 처리됩니다.

```gradle
implementation 'com.google.api-client:google-api-client:2.7.0'
```

```java
GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
        new NetHttpTransport(), GsonFactory.getDefaultInstance())
    .setAudience(List.of(googleClientId))   // 프론트와 동일한 클라이언트 ID
    .build();

GoogleIdToken token = verifier.verify(req.getIdToken());
if (token == null) throw new UnauthorizedException("구글 인증에 실패했습니다.");

GoogleIdToken.Payload payload = token.getPayload();
if (!Boolean.TRUE.equals(payload.getEmailVerified())) {
    throw new UnauthorizedException("이메일이 인증되지 않은 구글 계정입니다.");
}

String email = payload.getEmail();
String name  = (String) payload.get("name");
// email 로 조회 → 없으면 가입 → 기존 JWT 발급 로직 재사용
```

> `spring-boot-starter-oauth2-client` 의 리다이렉트 방식(`/oauth2/authorization/google`)은 **쓰지 않아도 됩니다.**
> 프론트가 이미 토큰을 받아서 넘기는 구조라, 위 검증 로직 하나면 충분합니다.

## 클라이언트 ID 는 프론트/백엔드가 같은 값을 써야 합니다

Google Cloud Console 에서 **웹 애플리케이션** 타입 OAuth 2.0 클라이언트 ID 를 하나 만들고, 그 값을 공유해 주세요.

- 프론트: `.env` 의 `VITE_GOOGLE_CLIENT_ID`
- 백엔드: `setAudience(...)` 에 들어갈 값

**승인된 자바스크립트 원본**에 아래를 등록해야 합니다. (리디렉션 URI 는 필요 없습니다)

```
http://localhost:3000
https://<vercel-배포-도메인>
```

## 확인 부탁드릴 것

- 같은 이메일이 **비밀번호 가입**과 **구글 가입** 양쪽에 있을 때 어떻게 처리할까요? (같은 계정으로 합치기 / 에러)
- 구글로 가입한 계정은 `password` 컬럼을 어떻게 두실 건가요? (nullable, 또는 provider 컬럼 추가)

---

# 🔴 삭제 기능이 막혀 있습니다 — 회의·프로젝트 삭제 cascade 요청

**날짜**: 2026-09-15 / **확인 환경**: 배포된 백엔드(EC2), 실제 호출로 전부 재현

사용자가 **회의 삭제**·**프로젝트 삭제** 버튼을 눌러도 지워지지 않는 경우가 있습니다.
프론트에서 우회할 수 있는 만큼은 이미 처리했지만, **분석 이력이 있는 회의는 프론트에서
손댈 방법이 전혀 없습니다.** 백엔드 수정이 필요합니다.

## 1. 문제 요약

| 동작 | 지금 결과 |
| --- | --- |
| 후속 업무가 있는 프로젝트 삭제 | ❌ 409 `PROJECT_DELETE_CONFLICT` |
| 후속 업무만 있는 회의 삭제 | ✅ 204 |
| **AI 분석을 한 번이라도 돌린 회의 삭제** | ❌ **409 `MEETING_DELETE_CONFLICT`** |
| 분석 삭제 | ❌ **API 자체가 없음** |

핵심은 마지막 두 줄입니다. **삭제를 막는 데이터(분석·결정)를 치울 수단이 없어서
막다른 길입니다.**

## 2. 재현 절차 (그대로 따라 하면 재현됩니다)

### 2-1. 프로젝트 삭제가 막히는 경우

```bash
# 후속 업무가 하나라도 있으면
DELETE /api/project/{projectId}
→ 409 {"code":"PROJECT_DELETE_CONFLICT",
       "message":"Project has related data and cannot be deleted"}

# 후속 업무를 전부 지운 뒤 다시 시도하면
DELETE /api/action-item/{id}   → 204
DELETE /api/project/{projectId} → 204   ✅ 성공
```

→ 이건 **프론트에서 우회 완료**했습니다. (아래 4번)

### 2-2. 회의 삭제가 막히는 경우 (해결 불가)

```bash
# 1) 회의 생성
POST /api/project/5/meeting
  { "title":"테스트", "scheduledAt":"2026-09-19T10:00:00",
    "content":"김하나가 로그인 버그를 9월 20일까지 수정하기로 했다." }
→ 201, meetingId = 20

# 2) AI 분석 실행 (확정도 하지 않았습니다. 그냥 돌리기만 함)
POST /api/meeting/20/analysis
→ 201, { "id":12, "status":"GENERATED" }

# 3) 회의 삭제 시도
DELETE /api/meeting/20
→ 409 {"code":"MEETING_DELETE_CONFLICT",
       "message":"AI 분석 또는 결정 이력이 존재하는 회의는 삭제할 수 없습니다."}
```

**확정(CONFIRMED)이 아니라 분석을 한 번 돌리기만 해도 영구히 삭제 불가가 됩니다.**
사용자가 실수로 분석을 눌렀다가 회의를 지우고 싶어도 방법이 없습니다.

### 2-3. 분석 삭제 API 부재 확인

```bash
DELETE /api/analysis/999999          → 500
DELETE /api/decision/999999          → 500   ← 존재하지 않는 경로
DELETE /api/meeting/999999/analysis  → 500
GET    /api/analysis/999999          → 404   ← GET 은 핸들러가 있음
```

없는 경로와 응답이 같은 걸로 봐서 **DELETE 핸들러가 아예 없습니다.**

> 곁다리로: 매핑되지 않은 경로/메서드가 **404·405 가 아니라 500** 으로 나옵니다.
> 전역 예외 핸들러가 `NoHandlerFoundException` / `HttpRequestMethodNotSupportedException`
> 까지 삼키고 있는 것 같습니다. 디버깅할 때 헷갈리니 함께 봐 주시면 좋겠습니다.

## 3. 🙏 요청 — 둘 중 하나만 해주시면 됩니다

### 옵션 A. 삭제 시 연관 데이터도 함께 삭제 (권장)

가장 깔끔하고, 프론트 우회 코드를 전부 걷어낼 수 있습니다.

```java
// MeetingService
@Transactional
public void delete(Long meetingId, Long userId) {
    Meeting meeting = ...;  // 권한 검사는 기존 그대로

    // 지금: 분석/결정이 있으면 MEETING_DELETE_CONFLICT 를 던짐
    // 변경: 함께 삭제
    analysisRepository.deleteByMeetingId(meetingId);
    decisionRepository.deleteByMeetingId(meetingId);
    actionItemRepository.deleteByOriginMeetingId(meetingId);   // 정책에 따라 선택
    meetingRepository.delete(meeting);
}
```

JPA 연관관계를 쓰신다면 애너테이션만으로도 됩니다.

```java
@OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Analysis> analyses = new ArrayList<>();

@OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, orphanRemoval = true)
private List<Decision> decisions = new ArrayList<>();
```

프로젝트 삭제도 같은 방식으로 회의·후속 업무까지 cascade 해주시면,
프론트의 순차 삭제 로직을 통째로 지울 수 있습니다.

**확인 부탁드릴 정책 하나**: 회의를 지울 때 그 회의에서 생성된 **후속 업무도 같이
지울지**, 아니면 **업무는 남기고 회의 연결만 끊을지**(`originMeetingId = null`)
정해 주세요. 지금 프론트는 **함께 삭제**로 구현해 뒀습니다.

### 옵션 B. 분석 삭제 API 추가

A가 부담되면 이것만이라도 괜찮습니다. 프론트에서 분석 → 회의 순으로 지우겠습니다.

```
DELETE /api/analysis/{analysisId}
  204  삭제 성공
  403  권한 없음
  404  없는 분석
  409  (선택) 이미 확정된 분석은 못 지우게 하려면
```

다만 이 경우 프론트가 회의의 분석 목록을 알아야 하는데 **조회 API도 없습니다.**
(`GET /api/analysis/{id}` 는 id 를 알아야 하고, `POST /api/meeting/{id}/analysis` 는
부작용이 있어 조회용으로 못 씁니다.) 그래서 `GET /api/meeting/{meetingId}/analysis`
같은 조회 API도 함께 필요합니다. **결국 A가 훨씬 간단합니다.**

## 4. 프론트에서 이미 해둔 것

`src/features/projects/useCascadeDelete.ts`

- **프로젝트 삭제**: 후속 업무 → 회의 → 프로젝트 순으로 지웁니다.
- **회의 삭제**: 그 회의에서 생성된 후속 업무를 먼저 지우고 회의를 지웁니다.
- 한 건 실패로 전체가 멈추지 않게 실패분을 모아 두고 계속 진행합니다.
- 확정 대화상자에 무엇이 함께 지워지는지 명시하고, 완료 토스트에 건수를 보여줍니다.
- 그래도 409 가 나면 `"AI 분석 이력이 남아 있어 이 회의는 삭제할 수 없습니다"` 로
  풀어서 안내합니다.

**백엔드가 A를 적용하면 이 파일은 통째로 삭제하고 `DELETE` 한 번으로 바꾸겠습니다.**

## 5. ⚠️ 정리 부탁드릴 데이터

위 2-2 를 확인하느라 만든 회의가 **프론트에서 지울 수 없어 남아 있습니다.**

```
프로젝트 5 / 회의 20  "[삭제요망] 테스트 회의 — 백엔드에서 삭제 필요"
                분석 12 (GENERATED)
```

제목을 눈에 띄게 바꿔 두었습니다. DB 에서 직접 지워 주시거나, 옵션 A 적용 후
프론트에서 지우겠습니다.

