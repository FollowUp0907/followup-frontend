# 백엔드에 전달할 내용 (프론트 연동하면서 확인한 것)

배포된 API(`http://13.124.207.246:8080`)에 실제로 붙여서 전체 플로우를 돌려 본 결과입니다.
정상 동작한 것과, 고쳐 주셨으면 하는 것을 나눠 적었습니다.

## ✅ 정상 동작 확인

테스트 계정(`test@followup.com`) / 프로젝트 6 기준으로 아래 흐름이 끝까지 동작했습니다.

- 로그인 → 프로젝트 목록 → 대시보드
- 회의 생성 (참여자 지정 포함)
- `POST /api/meeting/6/analysis` → `GENERATED` → 초안 3건 + 결정 사항 1건
- 초안 검토 → `POST /api/analysis/4/confirm` → 후속 업무 3건 생성
- 후속 업무 상태 변경 (`PATCH /api/action-item/5` → `IN_PROGRESS`)
- 대시보드 집계 반영 (전체 3 / 예정 2 / 진행 중 1)
- 구성원 목록, 프로젝트 상세

> 테스트하면서 프로젝트 6에 회의 1건(id 6), 후속 업무 3건(id 5·6·7), 분석 1건(id 4)이 생겼습니다. 필요 없으면 지우셔도 됩니다.

---

## 1. CORS 가 막혀 있어 브라우저에서 직접 호출이 불가능합니다 (우선순위 높음)

```
OPTIONS /api/projects
Origin: https://example.vercel.app
→ 403 "Invalid CORS request"
```

여기에 더해 백엔드가 **http** 라서, https 인 Vercel 페이지에서는 mixed content 로도 막힙니다.

**프론트에서는 프록시(로컬은 Vite, 배포는 Vercel rewrites)로 우회해 두었기 때문에 지금 당장 막히지는 않습니다.**
다만 아래 중 하나가 되면 구조가 훨씬 단순해집니다.

- `CorsConfiguration` 에 배포 도메인(`https://*.vercel.app`, 확정 도메인)과 `http://localhost:5173` 허용
- 가능하면 ALB/Nginx + 인증서로 **https** 제공

## 2. `/api/auth/me` 같은 내 정보 조회 API 가 있으면 좋겠습니다

`POST /api/auth/login` 응답이 `accessToken` / `tokenType` / `expiresIn` 뿐이고, JWT 페이로드도 `sub`(userId)만 있습니다.
그래서 **로그인한 사용자의 이름·이메일을 알 방법이 없습니다.**

지금은 이렇게 우회했습니다.
- userId → JWT `sub` 파싱
- 이메일 → 로그인 폼에 입력한 값을 그대로 저장
- 이름 → 프로젝트에 들어가서 멤버 목록에 내 userId 가 있으면 그때 채움 (프로젝트 밖에서는 이름을 못 보여 줍니다)

`GET /api/auth/me → { userId, name, email }` 하나만 있으면 전부 해결됩니다.

## 3. 후속 업무 목록 응답에 `originMeetingId` 를 넣어 주세요

`ActionItemListResDto` 에는 `originMeetingId` 가 없고 `ActionItemDetailResDto` 에만 있습니다.
"이 회의에서 생성된 후속 업무" 를 보여주려면 지금은 **목록을 받은 뒤 항목마다 상세를 한 번씩 더 조회**해야 합니다. (업무 N개 = 요청 N+1회)

목록에 `originMeetingId` 하나만 추가되면 요청 1회로 끝납니다.
같은 맥락에서 `assigneeName` 도 목록에 있으면 좋습니다. (지금은 멤버 목록과 클라이언트에서 조인 중)

## 4. 분석 확정 후에도 회의 `status` 가 `DRAFT` 로 남습니다

`POST /api/analysis/4/confirm` 이 성공해 후속 업무가 생성됐는데, `GET /api/meeting/6` 의 `status` 는 계속 `DRAFT` 입니다.
`CONFIRMED` 로 바뀌는 게 맞다면 확정 시점에 함께 갱신해 주세요. (회의 목록에서 "분석 확정" 뱃지를 그 값으로 그리고 있습니다)

## 5. `memberProgress.completionRate` 단위 확정 필요

`double` 이고 값이 `0.0` 만 확인돼서 0~1 인지 0~100 인지 알 수 없습니다.
프론트는 지금 "1 이하면 ×100, 아니면 그대로" 로 둘 다 받아들이게 해 뒀습니다. 확정해 주시면 그 함수만 지우겠습니다.

## 6. AI 분석이 Gemini 503 으로 자주 실패합니다

```json
{"code":503,"message":"This model is currently experiencing high demand...","status":"UNAVAILABLE"}
```

프론트는 `FAILED` 상태를 받으면 `errorMessage` 를 그대로 보여주고 **다시 분석** 버튼을 노출합니다.
백엔드 쪽에서도 짧은 재시도(예: 2회, 지수 백오프)를 넣어 주시면 사용자가 보는 실패가 크게 줄어들 것 같습니다.

## 7. 확인 겸 질문

- `POST /api/meeting/{id}/analysis` 의 "재사용 가능한 분석" 판정 기준이 무엇인가요? (회의록이 바뀌면 새로 만드는 게 맞는지 — 프론트의 **다시 분석** 버튼이 이 동작에 의존합니다)
- `PATCH /api/action-item/{id}` 에 `assigneeUserId: null` / `dueDate: null` 을 보내면 "값 지우기" 로 처리되나요, 아니면 무시되나요?
- `GET /api/project/{id}/action-items` 의 `status` 쿼리 파라미터에 `TODO,IN_PROGRESS` 처럼 여러 개를 줄 수 있나요? (지금은 전체를 받아 클라이언트에서 거르고 있습니다)
- 회의 목록/후속 업무 목록에 페이지네이션 계획이 있나요? 지금은 전체를 한 번에 받는 전제로 구현돼 있습니다.
