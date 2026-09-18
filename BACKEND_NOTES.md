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


---

# 🔔 알림 기능 — 지금 프론트에 임시로 넣어 둔 것과, 백엔드에 필요한 것

**날짜**: 2026-09-16
**한 줄 요약**: 알림 API 가 없어서 **브라우저 저장소에 임시로 구현해 뒀습니다.**
지금 상태로는 "앱을 열어 둔 동안, 이 브라우저에서만" 동작합니다. 제대로 쓰려면 백엔드가 필요합니다.

## 1. 지금 프론트에 있는 것

사용자가 **후속 업무 상세 → "알림" 카드**에서 알릴 시각을 정하면,
**우측 상단 종 아이콘**에 배지가 뜨고 패널에서 목록·상세를 볼 수 있습니다.

구현 위치
```
src/features/reminders/store.ts        저장·조회·읽음 처리 (localStorage)
src/components/layout/NotificationBell.tsx   종 + 패널(목록/상세/뒤로가기)
src/pages/TaskDetailPage.tsx           "알림" 카드 (시각 설정/해제)
```

### 화면에 배지가 켜지는 조건

세 가지를 **동시에** 만족하는 알림의 개수가 배지 숫자입니다.

```
① reminder.userId === 로그인한 사용자
② reminder.remindAt <= 현재 시각        (미래면 "예정된 알림" 으로만 표시)
③ reminder.readAt 이 비어 있음          (상세를 열면 채워짐)
```

### 갱신 시점

`remindAt` 이 지났는지는 **프론트가 30초마다 다시 계산**합니다.
그 외에는 같은 탭의 커스텀 이벤트, 다른 탭의 `storage` 이벤트로만 갱신됩니다.
→ **최대 30초 지연**, 그리고 **앱이 떠 있을 때만** 계산됩니다.

## 2. ⚠️ 지금 구조의 한계 (백엔드가 필요한 이유)

| 한계 | 이유 |
| --- | --- |
| 다른 기기·다른 브라우저에서 안 보임 | 서버가 아니라 그 브라우저의 localStorage 에 있음 |
| 앱을 닫아 두면 알림이 안 옴 | 시각을 지켜보는 주체가 브라우저 타이머뿐 |
| 브라우저 저장소를 비우면 사라짐 | 영속 저장소가 아님 |
| 담당자에게 알릴 수 없음 | 설정한 사람 본인에게만 보임 |
| 업무가 삭제돼도 알림이 남음 | 연관 관계를 서버가 모름 |

**즉 지금 것은 "동작하는 시안" 에 가깝습니다.** 실제 알림으로 쓰려면 아래가 필요합니다.

## 3. 🙏 요청 — 알림 API

### 3-1. 저장 모델 (프론트가 지금 쓰는 모양 그대로)

```jsonc
{
  "id": 1,
  "userId": 5,            // 알림 받을 사람
  "projectId": 13,
  "actionItemId": 64,
  "taskTitle": "백엔드 에러 메시지 포맷 통일 작업",  // 목록 표시용 스냅샷
  "remindAt": "2026-09-16T16:33:00",              // 알릴 시각
  "createdAt": "2026-09-15T10:00:00",
  "readAt": null                                   // 읽은 시각 (null = 안 읽음)
}
```

`taskTitle` 을 스냅샷으로 들고 있으면 목록을 그릴 때 업무를 N번 조회하지 않아도 됩니다.
서버에서 조인해 내려 주셔도 됩니다.

### 3-2. 엔드포인트

```
GET    /api/notifications
         내 알림 목록. 도착/예정 구분은 프론트가 remindAt 으로 합니다.
         (서버에서 ?due=true 같은 필터를 주셔도 좋습니다)
  200   [ Notification ]

POST   /api/action-item/{actionItemId}/notification
         { "remindAt": "2026-09-20T09:00:00" }
  201   Notification
         업무당 1건만 유지합니다. 이미 있으면 덮어써 주세요. (프론트가 그렇게 동작 중)

DELETE /api/notification/{id}
  204   해제

PATCH  /api/notification/{id}/read
  200   Notification   (readAt 채움)

PATCH  /api/notifications/read-all
  204   도착한 것 전부 읽음 처리
```

### 3-3. 전달 방식 — 정해 주셔야 합니다

"시각이 되면 알려 준다" 를 어디까지 할지에 따라 작업량이 많이 다릅니다.

| 방식 | 되는 것 | 비용 |
| --- | --- | --- |
| **① 폴링** (권장 시작점) | 앱이 열려 있으면 30~60초 안에 뜸 | `GET /api/notifications` 만 있으면 끝. 프론트가 주기 호출 |
| ② SSE / WebSocket | 앱이 열려 있으면 **즉시** | 연결 유지 인프라 필요 |
| ③ Web Push (VAPID) | **브라우저를 닫아도** OS 알림 | 서비스워커 + 푸시 구독 관리 + 키 관리 |
| ④ 이메일 | 확실히 도달 | 메일 발송 수단 필요, 즉시성 낮음 |

**①로 시작하고, 정말 필요하면 ③/④를 얹는 걸 권합니다.**
①만 해도 지금의 "이 브라우저에서만" 문제는 사라집니다 (다른 기기에서도 보임, 담당자에게 전달 가능).

### 3-4. 함께 정해야 할 정책

- **누구에게 알리나?** 지금 프론트는 **설정한 사람 본인**에게만 보여 줍니다.
  "업무 담당자에게 알림" 이 더 자연스러우면 그렇게 바꾸겠습니다.
- **업무가 삭제되면 알림도 지우나요?** cascade 로 함께 삭제가 자연스러워 보입니다.
- **마감일 기반 자동 알림**(예: 마감 하루 전 자동 생성)도 필요할까요?
  사용자가 매번 손으로 거는 것보다 훨씬 쓸모 있을 것 같은데, 이건 서버에서만 만들 수 있습니다.
- **반복 알림**이 필요한가요? 지금은 1회성입니다.

## 4. API 가 생기면 프론트에서 바뀌는 것

거의 없습니다. `src/features/reminders/store.ts` 의 **`readAll` / `writeAll` 두 함수만**
API 호출로 바꾸면 되고, 종·패널·업무 상세 화면은 **그대로 둡니다.**
그래서 백엔드 스펙이 위와 달라져도 맞추는 비용이 작습니다.


---

# 🔔 알림 2차 요청 — 지연 상시 · 생성 시 · 수정 시 알림

> ⚠️ **이 절은 아래 3차 요청으로 대체되었습니다.** 배경 설명으로만 읽어 주세요.
> 달라진 점: 수동 예약(`REMINDER`)을 **없앴고**, `TASK_COMPLETED` 가 **추가**됐습니다.

**날짜**: 2026-09-17
1차 알림 API 배포 감사합니다. 프론트는 **그대로 붙여서 잘 돌아갑니다.**
(설정 → 저장 → 배지 → 읽음 → 해제까지 실제 API 로 왕복 확인했습니다)

이어서 알림 **3종**을 추가하고 싶은데, **지금 모델로는 안 됩니다.**
왜 안 되는지와, 무엇을 바꿔야 하는지 적었습니다.

## 1. 왜 지금 구조로는 안 되나

현재 규칙은 **"업무당 알림 1건, 이미 있으면 덮어씀"** 입니다.
1차 요청 때 저희가 그렇게 요청드렸고, 예약 알림 하나만 있을 때는 맞는 설계였습니다.

그런데 추가하려는 3종은 성격이 다릅니다.

| 지금 있는 것 | 추가하려는 것 |
| --- | --- |
| **예약(reminder)** — "이 시각에 알려줘" | **활동(activity)** — "이런 일이 일어났다" |
| 사용자가 직접 건다 | 시스템이 자동으로 만든다 |
| 업무당 1건이면 충분 | 업무당 여러 건이 쌓여야 한다 |

그래서 지금 모델에 그대로 넣으면 이런 사고가 납니다.

```
사용자가 "내일 9시에 알려줘" 예약  →  notification(actionItemId=64) 저장
그 업무를 누군가 수정              →  "수정됨" 알림이 같은 업무에 덮어씀
                                  →  사용자가 건 예약이 사라진다 ❌
```

## 2. 🙏 요청 — `type` 필드 추가 + 1건 제약 완화

### 2-1. 스키마

```jsonc
{
  "id": 1,
  "userId": 5,
  "projectId": 13,
  "actionItemId": 64,
  "taskTitle": "백엔드 에러 메시지 포맷 통일 작업",
  "type": "REMINDER",        // ★ 추가
  "remindAt": "2026-09-18T09:00:00",
  "createdAt": "2026-09-17T10:00:00",
  "readAt": null
}
```

**`type` 값 4가지**

| type | 언제 만들어지나 | remindAt | 누구에게 |
| --- | --- | --- | --- |
| `REMINDER` | 사용자가 직접 설정 (기존 그대로) | 사용자가 고른 시각 | 설정한 본인 |
| `TASK_CREATED` | 후속 업무가 생성될 때 | 생성 시각 | 담당자 (아래 3번 참고) |
| `TASK_UPDATED` | 후속 업무가 수정될 때 | 수정 시각 | 담당자 |
| `OVERDUE` | 마감일이 지났고 아직 DONE 이 아닐 때 | 지연 판정 시각 | 담당자 |

**1건 제약은 `REMINDER` 에만 유지**해 주세요.
즉 `(userId, actionItemId, type='REMINDER')` 에만 유니크를 걸고,
나머지 type 은 여러 건 쌓이게 두면 됩니다.

### 2-2. 각 type 을 만드는 시점

**`TASK_CREATED`**
- `POST /api/project/{id}/action-item` 성공 시
- AI 분석 확정(`POST /api/analysis/{id}/confirm`)으로 업무가 여러 건 생길 때도 각각 1건
  → 한 번에 5건이 생기면 알림도 5건. 묶어서 1건으로 주시는 게 낫다면 그렇게 해주셔도 됩니다.

**`TASK_UPDATED`**
- `PATCH /api/action-item/{id}` 성공 시
- **주의**: 상태만 바뀌는 드래그앤드롭도 PATCH 를 탑니다. 보드에서 카드를 옮길
  때마다 알림이 쌓이면 시끄러워집니다. 아래 중 하나를 권합니다.
  - 상태(status) 변경만 있는 PATCH 는 알림을 만들지 않음
  - 또는 **본인이 한 수정은 본인에게 알리지 않음** (아래 3번과 같은 규칙)

**`OVERDUE`** — 이게 서버가 꼭 해줘야 하는 부분입니다
- 조건: `dueDate < 오늘` 이고 `status != DONE`
- **하루 한 번 스케줄러**로 생성해 주세요 (예: 매일 09:00, `@Scheduled`)
- **같은 업무에 대해 하루 1건만** 만들어 주세요. 안 그러면 매 실행마다 쌓입니다.
  `(actionItemId, type='OVERDUE', createdAt 의 날짜)` 로 중복을 막으면 됩니다.
- 업무가 DONE 이 되거나 마감일이 미래로 바뀌면 더 만들지 않으면 됩니다.
  (이미 만들어진 건 지우지 않아도 됩니다. 사용자가 읽고 넘기면 됩니다)

> "상시 알림" 을 매분 띄우는 뜻으로 받아들이면 알림이 폭주합니다.
> **하루 1건**이면 "아직 안 끝난 지연 업무가 있다" 를 충분히 알립니다.
> 다른 주기를 원하시면 알려주세요.

### 2-3. 누구에게 보낼지 — **정책 확인 부탁드립니다**

1차 때는 "설정한 사람 본인" 이었는데, 자동 알림 3종은 **담당자(assigneeUserId)** 에게
가는 게 자연스럽습니다. 내가 만든 업무를 나한테 알리는 건 의미가 없으니까요.

제안:
- `TASK_CREATED` / `TASK_UPDATED` / `OVERDUE` → **담당자에게**
- 단, **행위자 == 담당자면 만들지 않음** (내가 내 업무를 고치고 나한테 알림받지 않도록)
- 담당자가 없는 업무(`assigneeUserId = null`)는 알림을 만들지 않음

### 2-4. API 변경

기존 5개는 **그대로 두시면 됩니다.** 필터만 하나 추가해 주시면 좋겠습니다.

```
GET /api/notifications?due={boolean}&type={REMINDER|TASK_CREATED|TASK_UPDATED|OVERDUE}
```

`type` 은 선택입니다. 없으면 전부 내려 주세요.
프론트는 전부 받아서 종 안에서 묶어 보여 줄 예정이라, 없어도 동작합니다.

## 3. 프론트가 할 일

`type` 이 내려오면 종 패널에서 이렇게 구분해 보여 줍니다.

- `REMINDER` — 시계 아이콘 · "알림 시각 …"
- `TASK_CREATED` — 새 업무 아이콘 · "새 후속 업무가 배정되었습니다"
- `TASK_UPDATED` — 연필 아이콘 · "담당 업무가 수정되었습니다"
- `OVERDUE` — 경고 아이콘 · "마감일이 지났습니다"

**지금 붙어 있는 코드는 `type` 이 없어도 그대로 돕니다.** (모르는 필드는 무시)
그래서 백엔드가 먼저 올라가도 프론트가 깨지지 않고, 저희가 나중에 맞춰 붙이면 됩니다.

## 4. 정리 — 해주셔야 하는 것

1. `notification` 테이블에 `type` 컬럼 추가 (기존 데이터는 `REMINDER` 로)
2. 유니크 제약을 `(userId, actionItemId)` → `(userId, actionItemId, type)` 으로,
   혹은 `type='REMINDER'` 일 때만 적용
3. 업무 생성 / 수정 시 알림 생성 (행위자 == 담당자면 제외)
4. **지연 업무 스케줄러** (하루 1회, 업무당 하루 1건)
5. (선택) `GET /api/notifications?type=` 필터


---

# 🔔 알림 3차 (최종) 요청 — 알림을 전부 자동으로

**날짜**: 2026-09-17
**한 줄 요약**: 사용자가 알림을 **손으로 거는 기능을 없앴습니다.** 이제 알림은 전부 자동입니다.

2차 요청에서 "예약 알림은 그대로 두고 자동 알림 3종을 추가하자" 고 했었는데,
쓰다 보니 **예약 알림을 쓸 일이 없었습니다.** 담당자가 자기 업무를 직접 등록하고
시각까지 고르는 건 일이 하나 더 늘어나는 것뿐이더군요.

그래서 기획을 이렇게 정리했습니다.

> **알림은 시스템이 만든다. 사용자는 받기만 한다.**

프론트에서는 업무 상세의 "알림 설정" 카드를 **이미 제거**했고,
`POST /api/action-item/{id}/notification` 은 **더 이상 호출하지 않습니다.**

## 1. 만들어야 하는 알림 4종

| type | 언제 | 받는 사람 | 반복 |
| --- | --- | --- | --- |
| `OVERDUE` | 마감일이 지났는데 아직 `DONE` 이 아님 | 그 업무의 담당자 | **끝날 때까지 계속** |
| `TASK_CREATED` | 업무가 생기면서 담당자가 지정됨 | 새 담당자 | 1회 |
| `TASK_UPDATED` | 담당 중인 업무의 내용이 바뀜 | 담당자 | 1회(변경마다) |
| `TASK_COMPLETED` | 업무가 `DONE` 으로 바뀜 | **관련된 담당자 전원** | 1회 |

## 2. type 별 상세

### 2-1. `OVERDUE` — 지연 상시 알림

**조건**: `dueDate < 오늘` AND `status != 'DONE'` AND `assigneeUserId != null`

**"상시"의 뜻**: 화면에 **계속 떠 있어야** 합니다. 한 번 읽으면 사라지는 게 아니라,
**업무를 끝내거나 마감일을 미루기 전까지** 종 안에 남아 있어야 합니다.

구현 방법은 두 가지가 있는데, **B 를 권합니다.**

**A. 스케줄러로 알림 row 를 만든다** (2차 요청에서 제안했던 방식)
```java
@Scheduled(cron = "0 0 9 * * *")  // 매일 09:00
public void notifyOverdue() { ... }
```
- 문제: 업무가 완료되면 이미 만들어진 알림 row 를 **지워 줘야** 합니다.
  안 지우면 "끝낸 업무가 지연됐다" 고 계속 뜹니다.
- 하루 1건 중복 방지도 따로 해야 합니다.

**B. 조회 시점에 계산해서 내려 준다** ← **권장**
```java
// GET /api/notifications 응답에 합쳐서 내려 주기
List<ActionItem> overdue = actionItemRepository
    .findByAssigneeUserIdAndDueDateBeforeAndStatusNot(userId, LocalDate.now(), DONE);
```
- 저장하지 않으니 **지울 일도 없습니다.** 업무가 끝나면 다음 조회부터 자동으로 빠집니다.
- 읽음 처리도 필요 없습니다 (상시 알림이라 읽어도 남아야 하니까).
- `id` 는 음수나 `"overdue-{actionItemId}"` 같은 가상 키를 주셔도 되고,
  아예 별도 필드로 내려 주셔도 됩니다.

> **프론트는 지금 B 를 자체적으로 하고 있습니다.**
> 내 프로젝트들의 업무 목록을 받아서 `assigneeUserId == 나 && 지연` 을 직접 계산합니다.
> (`src/features/reminders/useNotifications.ts`)
> 그래서 **`OVERDUE` 는 백엔드가 안 해주셔도 지금 돌아갑니다.** 우선순위 낮습니다.
> 다만 프로젝트가 많아지면 프론트가 목록을 여러 번 부르게 되니, 여유 되실 때
> B 방식으로 서버에서 내려 주시면 프론트 계산을 걷어내겠습니다.

### 2-2. `TASK_CREATED` — 나에게 업무가 배정됨

**만드는 시점**
- `POST /api/project/{id}/action-item` — `assigneeUserId` 가 있으면 1건
- `POST /api/analysis/{id}/confirm` — 생성되는 업무마다 1건
  (한 번에 5건 생기면 알림도 5건. 이건 그대로 5건이 맞다고 봅니다.
   각각 다른 업무니까 사용자도 따로 보고 싶어 합니다)
- `PATCH /api/action-item/{id}` 로 **담당자가 바뀐 경우도 포함**해 주세요.
  → 새 담당자에게 `TASK_CREATED` (자기 입장에선 새로 배정된 것이니까)

**만들지 않는 경우**
- `assigneeUserId == null`
- **행위자 == 담당자** (내가 나한테 배정한 업무)

### 2-3. `TASK_UPDATED` — 담당 업무가 수정됨

**만드는 시점**: `PATCH /api/action-item/{id}` 성공 시, 담당자에게 1건.

**⚠️ 여기가 제일 시끄러워지기 쉬운 곳입니다.** 아래 두 가지를 꼭 걸러 주세요.

1. **행위자 == 담당자면 만들지 않음**
   내가 내 업무를 고치고 나한테 알림이 오면 안 됩니다.

2. **`status` 만 바뀐 PATCH 는 만들지 않음**
   칸반 보드에서 카드를 드래그하면 `PATCH { status }` 가 날아갑니다.
   이걸 알림으로 만들면 카드 옮길 때마다 알림이 쌓입니다.
   → `status` 변경은 `TASK_COMPLETED`(DONE 일 때)로만 처리하고,
     `TASK_UPDATED` 는 **title / description / dueDate / priority / assigneeUserId**
     중 하나라도 바뀌었을 때만 만들어 주세요.

```java
boolean contentChanged =
    changed(req.getTitle(), item.getTitle())
 || changed(req.getDescription(), item.getDescription())
 || changed(req.getDueDate(), item.getDueDate())
 || changed(req.getPriority(), item.getPriority());
// 담당자 변경은 TASK_CREATED 로 따로 처리
```

3. (선택) 같은 업무에 대해 **짧은 시간 안의 연속 수정은 1건으로 묶기**.
   없어도 됩니다. 시끄러우면 그때 넣죠.

### 2-4. `TASK_COMPLETED` — 업무가 완료됨

**만드는 시점**: `PATCH /api/action-item/{id}` 로 `status` 가 `DONE` 이 **된 순간**.
(이미 `DONE` 인데 또 `DONE` 을 보내면 만들지 않음 — 상태가 **바뀔 때만**)

**받는 사람 — 여기 정책 확인 부탁드립니다 🙏**

요청은 **"완료되면 해당하는 담당자 모두에게"** 였는데,
지금 스키마는 업무당 담당자가 **한 명**(`assigneeUserId`)뿐입니다.
그래서 "모두" 를 이렇게 해석했습니다.

| 대상 | 이유 |
| --- | --- |
| 업무 담당자 | 본인 업무니까 |
| 업무를 만든 사람 (`createdBy`) | 시킨 사람이 결과를 알아야 하니까 |
| 같은 회의(`originMeetingId`)에서 나온 업무들의 담당자 | 같은 안건을 나눠 맡은 사람들 |

**세 번째는 과할 수도 있습니다.** 회의 하나에서 업무 10건이 나오면
1건 완료할 때마다 10명에게 알림이 갑니다.
→ **일단 1·2번(담당자 + 생성자)만 구현**해 주시고, 3번은 빼 주세요.
   써 보고 부족하면 그때 요청드리겠습니다.

**중복 제거**: 담당자와 생성자가 같은 사람이면 1건만.
**행위자 제외 안 함**: 완료는 "내가 끝냈다" 는 기록이라 본인에게도 보이는 게 자연스럽습니다.
(시끄러우면 행위자 제외로 바꿔 주셔도 됩니다)

## 3. 스키마

2차 요청에서 드린 것과 같습니다. `type` 에 `TASK_COMPLETED` 만 추가됐습니다.

```jsonc
{
  "id": 1,
  "userId": 5,                  // 받는 사람
  "projectId": 13,
  "actionItemId": 64,
  "taskTitle": "백엔드 에러 메시지 포맷 통일 작업",
  "type": "TASK_CREATED",       // OVERDUE | TASK_CREATED | TASK_UPDATED | TASK_COMPLETED
  "remindAt": "2026-09-17T14:03:00",  // = 사건이 일어난 시각
  "createdAt": "2026-09-17T14:03:00",
  "readAt": null
}
```

**필드 관련**
- `remindAt` 은 이제 "예약 시각" 이 아니라 **"사건이 일어난 시각"** 입니다.
  이름이 안 맞지만 **그대로 두셔도 됩니다.** 프론트는 이미 그렇게 읽고 있습니다.
  (바꾸고 싶으시면 `occurredAt` 같은 이름으로 주시고 알려만 주세요)
- **유니크 제약을 풀어 주세요.** 지금 `(userId, actionItemId)` 1건 제약이 걸려 있는데,
  이제 한 업무에 생성·수정·완료 알림이 **여러 건 쌓여야** 합니다.
- 기존 데이터는 `type = 'REMINDER'` 로 채우고 두시거나, 테스트 데이터면 지우셔도 됩니다.

## 4. API 변경

**없애도 되는 것**
```
POST /api/action-item/{id}/notification   ← 프론트에서 더 이상 호출 안 합니다
```
지우셔도 되고, 두셔도 상관없습니다.

**그대로 쓰는 것**
```
GET    /api/notifications            내 알림 전체
DELETE /api/notification/{id}        1건 삭제
PATCH  /api/notification/{id}/read   1건 읽음
PATCH  /api/notifications/read-all   전부 읽음
```

**하나만 부탁드립니다**: `GET /api/notifications` 응답을 **최신순**으로 주세요.
지금은 프론트에서 정렬하고 있는데, 나중에 페이징이 필요해지면 서버 정렬이 있어야 합니다.

## 5. 구현 가이드 (스프링 기준)

이벤트를 쓰시면 서비스 코드가 알림을 몰라도 돼서 깔끔합니다.

```java
// 1) 업무 서비스는 "사건이 일어났다" 만 발행한다
@Service
@RequiredArgsConstructor
public class ActionItemService {
    private final ApplicationEventPublisher events;

    @Transactional
    public ActionItemResDto update(Long id, ActionItemPatchReq req, Long actorId) {
        ActionItem item = find(id);
        Long prevAssignee = item.getAssigneeUserId();
        ActionItemStatus prevStatus = item.getStatus();
        boolean contentChanged = applyPatch(item, req);   // 실제로 바뀐 게 있는지 반환

        if (!Objects.equals(prevAssignee, item.getAssigneeUserId())) {
            events.publishEvent(new TaskAssignedEvent(item, actorId));
        } else if (contentChanged) {
            events.publishEvent(new TaskUpdatedEvent(item, actorId));
        }
        if (prevStatus != DONE && item.getStatus() == DONE) {
            events.publishEvent(new TaskCompletedEvent(item, actorId));
        }
        return toDto(item);
    }
}

// 2) 알림은 한 곳에서만 만든다
@Component
@RequiredArgsConstructor
public class NotificationListener {
    private final NotificationRepository repo;

    @TransactionalEventListener(phase = AFTER_COMMIT)   // ★ 커밋 후에만
    public void on(TaskAssignedEvent e) {
        if (e.item().getAssigneeUserId() == null) return;
        if (e.item().getAssigneeUserId().equals(e.actorId())) return;   // 본인 제외
        repo.save(Notification.of(e.item(), TASK_CREATED, e.item().getAssigneeUserId()));
    }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    public void on(TaskUpdatedEvent e) { /* 위와 동일, type 만 TASK_UPDATED */ }

    @TransactionalEventListener(phase = AFTER_COMMIT)
    public void on(TaskCompletedEvent e) {
        Set<Long> targets = new LinkedHashSet<>();       // 중복 자동 제거
        if (e.item().getAssigneeUserId() != null) targets.add(e.item().getAssigneeUserId());
        targets.add(e.item().getCreatedBy());
        targets.forEach(uid -> repo.save(Notification.of(e.item(), TASK_COMPLETED, uid)));
    }
}
```

**`AFTER_COMMIT` 이 중요합니다.** 업무 저장이 롤백됐는데 알림만 남으면 안 되니까요.

## 6. 전달 방식 — 폴링 그대로 괜찮습니다

프론트는 **30초마다 `GET /api/notifications`** 를 부르고 있습니다.
SSE/웹소켓 없어도 됩니다. 지금 사용자 수에서는 폴링으로 충분합니다.

## 7. 테스트 시나리오

아래가 다 되면 완료입니다.

```
[TASK_CREATED]
 A 가 B 를 담당자로 업무 생성          → B 에게 1건, A 에게 0건
 A 가 A 를 담당자로 업무 생성          → 0건
 담당자를 B → C 로 변경                → C 에게 1건

[TASK_UPDATED]
 A 가 B 담당 업무의 제목 수정          → B 에게 1건
 B 가 자기 업무의 제목 수정            → 0건
 보드에서 카드 드래그 (status 만 변경) → 0건  ← 꼭 확인

[TASK_COMPLETED]
 B 가 자기 업무를 DONE 으로            → B, 생성자 A 에게 각 1건
 이미 DONE 인 업무에 다시 DONE PATCH   → 0건

[OVERDUE]  (서버에서 하실 경우)
 마감 지난 미완료 업무                 → 담당자에게 계속 보임
 그 업무를 DONE 으로 바꿈              → 다음 조회부터 안 보임
 마감일을 내일로 미룸                  → 다음 조회부터 안 보임
```

## 8. 정리 — 해주셔야 하는 것

1. `notification.type` 컬럼 추가 (`OVERDUE`/`TASK_CREATED`/`TASK_UPDATED`/`TASK_COMPLETED`)
2. `(userId, actionItemId)` **유니크 제약 제거**
3. 업무 생성·담당자 변경 → `TASK_CREATED` (본인 제외, 담당자 없으면 제외)
4. 업무 내용 수정 → `TASK_UPDATED` (**본인 제외, status 만 변경은 제외**)
5. `DONE` 전환 → `TASK_COMPLETED` (담당자 + 생성자, 중복 제거)
6. `GET /api/notifications` 최신순 정렬
7. (여유 되시면) `OVERDUE` 를 조회 시점 계산으로 응답에 합쳐 주기 — **지금은 프론트가 함**

`type` 이 안 내려와도 프론트는 안 깨집니다. 모르는 알림은 기본 모양으로 보여 줍니다.
그러니 **한 번에 다 안 하셔도 되고, 3 → 5 → 4 순서로 하나씩 올려주셔도 됩니다.**

---

# 🔔 3차 요청 보충 — 받은 질문 두 개 답변

**날짜**: 2026-09-17

## Q1. D-7 매일 알림이 빠진 건 의도적인가요?

**의도적으로 뺐습니다. 이번 범위 아닙니다.** 그대로 가 주세요.

다만 "빠뜨렸다" 와는 좀 다른 사정이 있어서 적어 둡니다.
**D-7 매일 알림은 어느 문서에서도 스펙으로 확정된 적이 없습니다.**
1차 요청서 3-4 절에 *"마감일 기반 자동 알림(예: 마감 하루 전)도 필요할까요?"* 라는
**열린 질문**으로 한 줄 있었고, 답을 받아 스펙으로 옮긴 적은 없습니다.
그래서 3차에서 "빼기로 결정한" 게 아니라, **애초에 들어간 적이 없습니다.**

나중에 넣으실 때를 위해 걸림돌 두 개만 미리 남깁니다.

**① 알림 폭주 위험** — D-7 매일 + OVERDUE 상시를 둘 다 켜면
마감 1주 전부터 매일, 마감 후에는 끝낼 때까지 계속 알림이 옵니다.
업무 하나가 **알림을 10건 넘게** 만들 수 있습니다. 넣으신다면
"D-7, D-3, D-day 세 번만" 처럼 **횟수를 못 박는 쪽**을 권합니다.

**② 프론트 기준과 숫자가 안 맞습니다** — 프론트는 **D-3** 을 "마감 임박" 으로 씁니다.
(`DUE_SOON_DAYS = 3`, 목록·보드의 주황색 "마감 임박" 뱃지 기준)
여기서 알림만 D-7 로 가면 **"알림은 왔는데 화면엔 임박 표시가 없는"** 구간이
4일 생깁니다. 숫자를 맞추고 시작하는 게 낫습니다.

> 관련해서 1차 때 여쭤보고 아직 답을 못 받은 게 하나 있습니다 (문서 145줄).
> **대시보드 `dueSoonActionItems` 의 임박 기준이 서버에서는 며칠인가요?**
> D-5 짜리가 안 잡혀서 3일로 추측해 프론트를 맞춰 뒀는데, 확인만 해주시면 좋겠습니다.
> 이 숫자가 정해지면 나중에 마감 예고 알림도 같은 값으로 가면 됩니다.

## Q2. 회의 알림(초대/수정)도 이번에 하나요?

**아닙니다. 이번엔 업무 4종만 갑니다.** 빠뜨린 게 아니라 범위 밖입니다.

이번 요청은 "**후속 업무**의 담당자에게 가는 알림" 한 덩어리였습니다.
회의는 담당자 개념이 없고 참여자 개념이라, 받는 사람을 정하는 규칙부터 다릅니다.
같이 넣었으면 문서가 두 배가 됐을 겁니다.

말씀대로 **이벤트 + `AFTER_COMMIT` 리스너 방식 그대로** 붙이시면 됩니다.
그때 참고하시라고, 지금 데이터 모양 기준으로 보이는 것만 적어 둡니다.

**넣을 만한 것**
- `MEETING_INVITED` — 회의 생성·수정 시 `participantIds` 에 **새로 들어온 사람**에게.
  전원이 아니라 **새로 추가된 사람만** 입니다. 참여자 목록을 건드릴 때마다
  기존 참여자 전원에게 다시 가면 시끄럽습니다.

**한 번 더 생각해 보셔야 하는 것**
- `MEETING_UPDATED`(회의록 수정) — 회의록은 **작성 중에 계속 저장**됩니다.
  저장할 때마다 알림이 나가면 못 씁니다. 넣으신다면 제목·일시 같은
  **메타 정보 변경만**, 본문 수정은 제외하는 쪽이 맞습니다.

**넣으면 중복되는 것**
- "AI 분석이 확정됐습니다" 류 — 확정 시점에 이미 `TASK_CREATED` 가
  담당자들에게 나갑니다. 회의 알림까지 더하면 같은 사건으로 두 번 옵니다.

프론트는 회의 알림이 와도 **안 깨집니다.** 모르는 type 은 아래 3번대로 떨어집니다.
다만 종에서 "업무 보기" 로 넘어가는 링크가 업무 상세로 고정돼 있어서,
회의 알림을 실제로 보내실 때는 **미리 알려 주세요.** 링크를 회의 상세로 가르도록
프론트를 먼저 고쳐 두겠습니다.

## 3. ⚠️ 프론트 수정 한 건 — 순차 배포 중 라벨 문제

말씀하신 3 → 5 → 4 순서로 올리시면, 그 사이에 **`type` 이 없는 알림**이
내려오는 구간이 생깁니다. (`type` 컬럼 전에 알림을 먼저 만드시거나,
기존 `REMINDER` 행이 남아 있는 경우)

그때 프론트가 그걸 **"설정한 알림"** 이라고 표시하고 있었습니다.
수동 예약을 없앤 지금은 **사용자가 걸지도 않은 알림에 걸었다고 말하는 꼴**이라
방금 고쳤습니다. 이제 모르는 type 은 종 아이콘 + **"업무 알림"** 으로 중립적으로 뜹니다.

**백엔드에서 하실 일은 없습니다.** 순서 그대로 올리셔도 됩니다.

## 4. 정리

| 질문 | 답 |
| --- | --- |
| D-7 매일 알림 | **이번 범위 아님.** 그대로 진행해 주세요. 나중에 넣을 때 횟수 제한 + D-3 기준 정렬 필요 |
| 회의 알림 | **이번 범위 아님.** 업무 4종만. 나중에 같은 방식으로 추가 OK, 보내기 전에 알려만 주세요 |
| 배포 순서 | 3(`TASK_CREATED`) → 5(`TASK_COMPLETED`) → 4(`TASK_UPDATED`) **그대로 좋습니다** |
| `OVERDUE` | 맨 뒤로 미루셔도 됩니다. 지금 프론트가 계산하고 있어서 **기능 공백 없습니다** |

부탁드릴 건 1차 때 못 받은 답 하나뿐입니다 — **서버의 `dueSoonActionItems` 임박 기준 일수.**

---

# 🔔 정정 — D-7 마감 예고 알림, 넣기로 했습니다

**날짜**: 2026-09-17
**바로 앞 절에서 "D-7 은 이번 범위 아님" 이라고 답변드렸는데, 그 뒤에 넣기로 정해졌습니다.**
헷갈리게 해서 죄송합니다.

## 백엔드에서 하실 일은 없습니다

`OVERDUE` 와 똑같이 **프론트가 직접 계산**합니다. 내 업무와 마감일만 있으면
알 수 있는 값이라 서버가 만들어 줄 필요가 없습니다.

**3 → 5 → 4 순서 그대로 진행해 주세요.** 영향 없습니다.

## 프론트에 들어간 규칙 (나중에 서버로 옮길 때 참고)

| 항목 | 값 |
| --- | --- |
| type | `DUE_SOON` |
| 조건 | `0 <= (마감일 - 오늘) <= 7` AND `status != DONE` AND 담당자 == 나 |
| 빈도 | **하루 한 번.** 읽으면 그날은 접히고, 다음 날 다시 뜸 |
| 표시 | 알림마다 `D-7` ~ `D-day` 뱃지. 지연은 `D+3` 처럼 |
| `OVERDUE` 와의 경계 | 남은 일수가 음수가 되는 순간 `DUE_SOON` 이 사라지고 `OVERDUE` 로 넘어감 (둘이 겹치지 않음) |

"하루 한 번" 은 **읽음 키에 날짜를 넣어서** 만들었습니다.
(`duesoon-<업무id>-<YYYY-MM-DD>` — 자정이 지나면 저절로 새 키가 되어 다시 뜹니다)
나중에 서버로 옮기실 때도 같은 방식이면 스케줄러 중복 방지가 쉽습니다.

## 다만 기준 일수가 화면과 어긋나 있습니다

- **알림**은 이제 **D-7** 부터
- **목록·보드의 주황색 "마감 임박" 뱃지**는 여전히 **D-3** 부터 (`DUE_SOON_DAYS = 3`)

그래서 D-7 ~ D-4 구간에는 **알림은 오는데 화면에 임박 표시는 없습니다.**
알림 자체에 `D-6` 같은 뱃지를 달아 뒀으니 당장 혼란스럽진 않습니다만,
숫자를 하나로 맞추는 게 깔끔하긴 합니다.

**그래서 1차 때 여쭤본 것 하나만 다시 부탁드립니다** —
**서버 `dueSoonActionItems` 의 임박 기준이 며칠인가요?**
그 값에 프론트의 뱃지 기준과 알림 기준을 함께 맞추겠습니다.

---

# 👥 담당자 여러 명 — 필드 하나만 부탁드립니다

**날짜**: 2026-09-18

후속 업무 하나를 **여러 명이 나눠 맡는** 경우가 있어서 요청드립니다.
지금은 `assigneeUserId` 하나뿐이라 한 명만 담을 수 있습니다.

## 필요한 것

```jsonc
// ActionItemListResDto / ActionItemDetailResDto
{
  "id": 64,
  "title": "로그인 오류 수정",
  "assigneeUserId": 7,        // ← 그대로 두세요 (아래 참고)
  "assigneeUserIds": [7, 12], // ★ 추가
  ...
}

// ActionItemCreateReqDto / ActionItemUpdateReqDto
{ "assigneeUserIds": [7, 12] }   // ★ 추가
```

**`assigneeUserId` 는 지우지 말아 주세요.** 첫 번째 담당자를 계속 넣어 주시면
예전 화면·예전 클라이언트가 그대로 돕니다. 나중에 정리하면 됩니다.

**스키마**: `action_item` 에 컬럼을 늘리는 대신 조인 테이블이 자연스럽습니다.
```sql
action_item_assignee(action_item_id, user_id, primary key (action_item_id, user_id))
```

## 프론트는 이미 준비돼 있습니다

`src/features/actionItems/assignees.ts` 가 **`assigneeUserIds` 가 오면 그걸 쓰고,
없으면 `assigneeUserId` 를 한 명짜리 목록으로** 다룹니다. 화면은 전부 이 목록을
기준으로 그리고 있습니다.

- 카드: 아바타를 겹쳐 놓고 **"반서현 외 2명"**
- 목록 뷰: 같은 방식
- 오른쪽 상세 패널: 담당자를 한 줄에 한 명씩 펼쳐서

**그래서 필드만 내려 주시면 프론트 배포 없이 여러 명이 바로 보입니다.**
(지금은 한 명만 오니 아바타도 하나만 보입니다)

## 알림은 어떻게 되나

`BACKEND_NOTES` "알림 3차 (최종) 요청" 의 규칙에서 **"담당자"** 를
**"담당자 전원"** 으로 읽어 주시면 됩니다.

- `TASK_CREATED` → 새로 추가된 담당자들에게
- `TASK_UPDATED` / `OVERDUE` / `DUE_SOON` → 담당자 전원에게
- `TASK_COMPLETED` → 담당자 전원 + 생성자 (지금과 같음, 중복 제거)
- **행위자 본인은 제외** 하는 규칙은 그대로

## 함께 정할 것

- 담당자를 **0명**으로 두는 걸 허용할까요? (지금 `assigneeUserId = null` 과 같은 뜻)
  저희는 허용 쪽이 자연스럽다고 봅니다 — "아직 안 정함" 이 실제로 있습니다.
- 담당자 **상한**이 필요할까요? 없어도 화면은 3명까지 아바타를 보이고 나머지는
  숫자로 접습니다.

## 정리

1. `action_item_assignee` 조인 테이블
2. 응답 DTO 두 개에 `assigneeUserIds` 추가 (`assigneeUserId` 는 첫 번째로 유지)
3. 생성/수정 요청 DTO에 `assigneeUserIds` 받기
4. 알림 대상에서 "담당자" 를 "담당자 전원" 으로

**프론트 작업은 0입니다.** 필드가 오는 순간 반영됩니다.

---

# ✅ 담당자 여러 명 — 프론트 준비 끝났습니다 (배포하셔도 됩니다)

**날짜**: 2026-09-18
받은 최종 스펙 그대로 맞춰 뒀습니다. **아무 때나 배포하셔도 됩니다.**

## 배포 순서를 맞출 필요가 없습니다

필드를 **교체**하시는 거라 한쪽만 올라간 순간이 위험합니다. 그래서 프론트를
**두 모양 다 읽도록** 만들었습니다.

| 읽기 우선순위 | |
| --- | --- |
| 1 | `assignees[]` (상세) |
| 2 | `assigneeUserIds[]` (목록·이월·대시보드) |
| 3 | 없으면 구 필드 `assignee` / `assigneeUserId` |

**빈 배열은 "담당자 없음" 으로 정확히 읽습니다.** 구 필드로 떨어지지 않습니다.

요청에는 **새 필드와 구 필드를 같이** 실어 보냅니다.
```jsonc
{ "assigneeUserIds": [7, 8, 9], "assigneeUserId": 7 }
```
새 서버는 `assigneeUserId` 를 모르는 필드로 무시하고, 구 서버는 `assigneeUserIds` 를
무시합니다. 그래서 **먼저 올리셔도, 나중에 올리셔도 안 깨집니다.**

## 맞춰 둔 화면

| 응답 | 쓰는 곳 |
| --- | --- |
| `assignees[]` | 업무 상세, 오른쪽 상세 패널(담당자를 한 줄에 한 명씩) |
| `assigneeUserIds[]` (목록) | 보드 카드·목록 뷰(아바타 겹침 + "OOO 외 N명"), 알림 판정, 구성원별 담당 업무 수 |
| `assigneeUserIds[]` (이월) | 회의 상세의 이월 업무 |
| `assigneeUserIds[]` / `assigneeNames[]` (대시보드) | 마감 임박·지연 목록 |

요청은 업무 생성 / 업무 수정 / **AI 분석 확정** 모두 `assigneeUserIds` 로 보냅니다.
분석 화면의 담당자도 체크박스 다중 선택으로 바꿔 놨습니다.

## 배포 후에 저희가 할 일

배포 확인되면 아래를 지웁니다. 지금은 안전을 위해 남겨 둔 것들입니다.
1. 요청에서 `assigneeUserId` 빼기
2. 읽기에서 구 필드 분기 빼기
3. 담당자 2명 이상을 임시로 브라우저에 적어 두던 코드 (`rememberExtraAssignees`) 삭제

## 확인 부탁드릴 것 두 가지

1. **`assigneeUserIds: []` 를 "담당자 없음" 으로 받아 주시나요?**
   화면에서 담당자를 전부 해제할 수 있어서, 빈 배열이 올라갑니다.
   (예전에 `assigneeUserId: null` 을 무시하고 값을 안 지우던 적이 있어서 여쭙습니다)

2. **AI 초안(`DraftActionItem`)의 `assigneeName` 은 그대로인가요?**
   이건 AI 가 읽어낸 **이름 문자열**이라 담당자 필드와 성격이 달라서 안 건드렸습니다.
   여기도 배열로 바뀐다면 알려 주세요. 한 줄이면 맞춥니다.
