# 🔔 알림 시스템 — 지금 어떻게 동작하고, 앞으로 어떻게 넓힐까

**마지막 갱신**: 2026-09-17
대상: 프론트·백엔드 둘 다. 1부는 "지금 이렇다", 2부는 "이래서 아쉽다",
3부는 "이런 기능을 넣으려면 양쪽이 각각 뭘 해야 한다" 입니다.

---

# 1부. 지금 어떻게 동작하나

## 1-1. 한 장 요약

알림은 **전부 자동**입니다. 사용자가 손으로 거는 예약은 없앴습니다.
그리고 지금은 **출처가 두 군데로 갈려 있습니다.**

```
                    ┌──────────────────────────────┐
                    │  종 아이콘 (NotificationBell) │
                    └──────────────┬───────────────┘
                                   │
                        useNotifications(userId)
                                   │
                ┌──────────────────┴───────────────────┐
                │                                      │
     ① 프론트가 계산하는 것                   ② 서버가 만들어 주는 것
     DUE_SOON / OVERDUE                     TASK_CREATED / UPDATED / COMPLETED
                │                                      │
   GET /api/projects                          GET /api/notifications
   GET /api/project/{id}/action-item          (30초마다 폴링)
   (30초마다 폴링, 프로젝트 수만큼)
                │                                      │
   내 담당 + 마감일로 직접 판정                 서버 DB 행을 그대로 표시
   읽음은 localStorage                        읽음은 서버 readAt
                └──────────────────┬───────────────────┘
                                   │
                          하나로 합쳐서 정렬
                    (마감 예고·지연 먼저, 서버 알림은 최신순)
```

**왜 갈라져 있나**: 마감 관련 알림은 "내 업무와 마감일"만 있으면 화면에서 바로
알 수 있습니다. 서버를 기다릴 이유가 없어서 먼저 붙였습니다. 반대로
"누가 무엇을 했다"는 사건은 서버만 알 수 있어서 서버가 만들어 줘야 합니다.

## 1-2. 알림 5종과 정확한 발생 조건

| type | 누가 만드나 | 조건 | 읽음 | 사라지는 때 |
| --- | --- | --- | --- | --- |
| `DUE_SOON` | **프론트** | 내 담당 · `status != DONE` · `0 ≤ 마감일−오늘 ≤ 7` | 하루 단위 (로컬) | 완료하거나 마감을 8일 뒤로 미루면 |
| `OVERDUE` | **프론트** | 내 담당 · `status != DONE` · `마감일 < 오늘` | **없음 (상시)** | 완료하거나 마감을 미래로 옮기면 |
| `TASK_CREATED` | 서버 | 나에게 업무가 배정됨 | 서버 `readAt` | 읽거나 지울 때까지 남음 |
| `TASK_UPDATED` | 서버 | 내 담당 업무가 수정됨 | 서버 `readAt` | 〃 |
| `TASK_COMPLETED` | 서버 | 내 담당 업무가 완료됨 | 서버 `readAt` | 〃 |
| `UNKNOWN` | 서버 | `type` 이 없거나 모르는 값 | 서버 `readAt` | 〃 |

> ⚠️ **서버 3종은 아직 백엔드에 구현되지 않았습니다.** 프론트는 붙을 준비가
> 끝나 있어서, 백엔드가 `type` 을 실어 주기 시작하면 그대로 목록에 섞여 보입니다.
> 안 실어 줘도 `UNKNOWN`("업무 알림")으로 떨어져서 화면이 깨지지 않습니다.
> 백엔드 작업 항목은 `BACKEND_NOTES.md` 의 "알림 3차 (최종) 요청" 을 보세요.

## 1-3. "하루 한 번" 을 만든 방법

`DUE_SOON` 은 매일 한 번만 떠야 합니다. 서버 없이 이걸 만들려고
**읽음 키에 날짜를 넣었습니다.**

```
duesoon-<업무id>-<YYYY-MM-DD>
                 └─ 자정이 지나면 저절로 다른 키가 된다
```

읽으면 이 키가 `localStorage['followup.notifications.read']` 에 들어갑니다.
다음 날이 되면 키가 바뀌므로 그 목록에 없고, 그래서 **다시 안 읽은 상태로 뜹니다.**
만료 처리를 따로 짤 필요가 없습니다. 이틀 지난 키는 저장할 때 같이 버립니다.

`OVERDUE` 는 반대로 **읽음을 아예 두지 않았습니다.** "상시 표시" 이기 때문에
읽었다고 사라지면 안 됩니다. 업무를 끝내야 없어집니다.

## 1-4. 전달 방식 — 폴링 (간격을 비용에 맞춰 나눠 둠)

서버가 밀어 주지 않습니다. 화면이 주기적으로 물어봅니다.
**두 질의의 비용이 아주 달라서 간격을 따로 뒀습니다.**

| 질의 | 요청 수 | 간격 |
| --- | --- | --- |
| `GET /api/notifications` | 1개 | **15초** |
| `GET /api/project/{id}/action-item` | **프로젝트 수(N)** | **60초** |

여기에 더해 **창으로 돌아올 때 · 탭이 다시 보일 때 · 네트워크가 돌아올 때 ·
종을 열 때** 즉시 한 번 더 받아 옵니다. 그래서 업무 쪽 주기가 길어도 체감이
느려지지 않습니다. (마감·지연은 하루 단위로 변하는 값이라 60초면 충분합니다)

**분당 요청 수**

| 참여 프로젝트 | 균일 30초였을 때 | 균일 15초였을 때 | **지금 (15/60초)** |
| --- | --- | --- | --- |
| 1개 | 4 | 8 | **5** |
| 5개 | 12 | 24 | **9** |
| 10개 | 22 | 44 | **14** |

30초로 균일하게 돌리던 때보다 **적으면서 종은 더 빨리 갱신**됩니다.

> 참고: 백그라운드 탭에서는 폴링이 멈춥니다. React Query 의
> `refetchIntervalInBackground` 기본값이 `false` 라서, 창이 포커스를 잃으면
> 주기 갱신을 건너뜁니다. 돌아올 때 위의 focus 처리로 한 번 당겨 옵니다.

그래도 **앱이 열려 있어야 배지가 갱신됩니다.** 탭을 닫아 두면 아무 일도 안 일어납니다.

### ⚠️ "이벤트가 있을 때만 요청한다" 는 아닙니다 — 오해 방지

받은 질문이 있어 분명히 적어 둡니다.

**기본은 무조건 도는 주기 폴링입니다.** 이벤트는 그 위에 *추가로* 한 번 더
당겨 올 뿐, 폴링을 대체하지 않습니다. 코드로 보면 이렇게 두 겹입니다.

| | 무엇 | 언제 |
| --- | --- | --- |
| 1겹 | `refetchInterval` | **조건 없이** 15초 / 60초마다 |
| 2겹 | 추가 조회 | 창 포커스 · 탭 다시 보임 · 네트워크 복구 · 종 열기 · 내가 한 변경 직후 |

**2겹은 "내가 아는 사건" 만 잡습니다.** 창을 다시 본다거나 내가 업무를 고쳤다거나
하는 것들입니다. **다른 사람이 내 업무를 완료 처리한 것은 클라이언트가 알 방법이
없습니다.** 그건 1겹(주기 폴링)이 돌아올 때까지 모릅니다.

그래서 **남이 만든 알림의 지연 시간 = 폴링 간격** 입니다. 지금은 최대 15초.
이걸 0에 가깝게 만들려면 서버가 먼저 알려 주는 수밖에 없습니다 (3부 ② SSE).

### 그 사이에 쓸 수 있는 유일한 지렛대

푸시 없이 지연을 줄이는 방법은 **간격을 줄이는 것뿐**이고, 간격은 **요청 1건의
비용**에 묶여 있습니다. 그러니 비용을 낮추면 간격을 줄일 여지가 생깁니다.

1. **`GET /api/notifications/unread-count`** (3부 ⑥) — 숫자 하나만 내려 주는
   가벼운 엔드포인트. 이것만 짧게(예: 7초) 돌리고, **숫자가 바뀌었을 때만**
   무거운 목록을 받습니다. 지연이 절반 이하로 줄고 전송량은 오히려 줍니다.
   *다만 호출 횟수 자체는 늘어납니다(Vercel 함수 호출).*
2. **`ETag` / `304`** — 바뀐 게 없으면 본문 0바이트. 전송량만 줄고 호출 수는 그대로.

둘 다 **하루가 안 걸리고 기존 동작을 건드리지 않습니다.** SSE 처럼 연결을
유지하거나 프록시 설정을 손볼 일이 없어서 되돌리기도 쉽습니다.

### 모든 요청이 서버리스 함수를 거칩니다

`api/proxy.ts`(Vercel Function)가 CORS·mixed content 때문에 앞에 서 있습니다.
**요청 1건 = 함수 호출 1건**이라, 폴링 횟수가 그대로 Vercel 함수 호출량입니다.
백엔드 부하보다 이쪽 한도가 먼저 보일 수 있습니다.

## 1-5. 파일 지도

| 파일 | 하는 일 |
| --- | --- |
| `src/features/reminders/useNotifications.ts` | **핵심.** 두 출처를 합치고, 종류를 판정하고, 읽음을 다룬다 |
| `src/components/layout/NotificationBell.tsx` | 종 아이콘, 목록, 상세, 배지 숫자 |
| `src/api/notificationApi.ts` | 서버 알림 4개 엔드포인트 |
| `src/lib/date.ts` | `daysUntil` / `dDayLabel` — D-day 판정의 단일 출처 |

## 1-6. 화면 동작

- 종에 **안 읽은 수**가 뜬다 (`9+` 까지)
- 항목을 누르면 상세로 바뀌고, 그 순간 읽음 처리된다
- "업무 보기" 를 누르면 해당 업무 상세로 이동한다
- "모두 읽음" 은 `OVERDUE` 를 건드리지 않는다 (상시라서)
- 알림마다 `D-3` / `D+2` 뱃지가 붙는다 (마감이 있는 것만)

---

# 2부. 지금 구조의 한계

솔직하게 적습니다. 다음 단계를 고를 때 근거가 됩니다.

### ① 앱이 닫혀 있으면 아무 알림도 못 받는다
가장 큰 구멍입니다. 마감이 지났는데 그 주에 앱을 안 열면 영영 모릅니다.
→ 3부 ③④ (Web Push / 이메일)

### ② 종 하나 때문에 프로젝트 수만큼 요청이 나간다  ★ 남은 가장 큰 낭비
`useNotifications` 는 지연·마감을 계산하려고 **내 모든 프로젝트의 업무 목록**을
받아 옵니다. 간격을 60초로 늘려 두긴 했지만 **구조가 `1 + N`인 건 그대로**입니다.
프로젝트가 10개면 한 번에 11개 요청이 나갑니다.
→ 3부 ① 을 하면 **`1 + N` 이 `1` 로** 떨어집니다. 프로젝트 10개 기준 분당 14회 → 4회.

**프론트는 이미 받을 준비가 끝나 있습니다.** 서버 응답에 `DUE_SOON` 이나
`OVERDUE` 가 한 번이라도 섞여 오면, 프론트가 **스스로 계산을 접고 업무 목록
조회를 통째로 멈춥니다.** (`useNotifications.ts` 의 `serverSendsDueKinds` 래치)
백엔드가 올리는 순간 프론트 배포 없이 바로 가벼워집니다.

### ③ 마감 알림 읽음이 기기마다 따로 논다
`localStorage` 라 회사 PC에서 읽어도 노트북에서 또 뜹니다.
→ 3부 ①

### ④ 바뀐 게 없어도 매번 전체 JSON
`ETag` / `If-None-Match` 를 쓰지 않아서, 응답이 직전과 똑같아도 전부 다시
내려받습니다. 폴링은 대부분의 응답이 그대로인 구조라 이게 제일 아깝습니다.
→ 응답에 `ETag` 를 붙이고 `304` 를 돌려주시면 바뀐 게 없을 때 본문이 0바이트가 됩니다.

### ⑤ 알림이 쌓이기만 한다
페이징도, 오래된 것 정리도 없습니다. 전부 받아서 전부 그립니다.
→ 3부 ⑥

### ⑥ 끄는 방법이 없다
알림 종류별로 켜고 끌 수 없습니다. 시끄러우면 그냥 시끄럽습니다.
→ 3부 ⑤

### ⑦ 기준 일수가 화면과 어긋나 있다
알림은 **D-7** 부터인데, 목록·보드의 "마감 임박" 판정은 **D-3** (`DUE_SOON_DAYS = 3`)입니다.
D-7 ~ D-4 사이에는 알림은 오는데 화면에 임박 표시가 없습니다.
→ 서버의 `dueSoonActionItems` 기준 일수를 확인해서 셋을 한 값으로 맞추는 게 좋습니다.

---

# 3부. 기능별 구현 가이드

각 항목은 **백엔드 / 프론트 / 드는 품** 으로 나눠 적었습니다.
위에서부터 하는 걸 권합니다 — 아래로 갈수록 앞의 것에 기댑니다.

## ① 마감 알림을 서버로 옮기기  ★ 먼저

②③④ 한계를 한 번에 없앱니다. **가장 값싸고 효과가 큰 작업입니다.**

**백엔드**
```java
// 저장하지 말고 조회 시점에 계산해서 목록에 섞어 내려 준다.
// 저장하면 "업무 끝냈는데 지연 알림이 남는" 문제를 따로 치워야 한다.
public List<NotificationRes> myNotifications(Long userId) {
    List<NotificationRes> stored = repo.findByUserIdOrderByCreatedAtDesc(userId);

    List<ActionItem> due = actionItemRepo
        .findByAssigneeUserIdAndStatusNotAndDueDateNotNull(userId, DONE);

    List<NotificationRes> derived = due.stream()
        .map(i -> {
            long left = ChronoUnit.DAYS.between(LocalDate.now(), i.getDueDate());
            if (left < 0)  return NotificationRes.derived(i, OVERDUE);
            if (left <= 7) return NotificationRes.derived(i, DUE_SOON);
            return null;
        })
        .filter(Objects::nonNull).toList();

    return Stream.concat(derived.stream(), stored.stream()).toList();
}
```
- `id` 는 음수나 `"duesoon-64"` 같은 가상 키로 주세요. 저장된 행과 구분만 되면 됩니다.
- `DUE_SOON` 의 "하루 한 번" 읽음은 별도 테이블 한 장이면 됩니다:
  `notification_read(user_id, dedup_key, read_date)` — `dedup_key = "duesoon-64"`.
  오늘 날짜로 읽음 행이 있으면 `readAt` 을 채워 내려 주면 됩니다.

**프론트 — 할 일 없습니다. 이미 준비돼 있습니다.**
응답에 `DUE_SOON` 이나 `OVERDUE` 가 **한 번이라도 섞여 오면** 프론트가 스스로
계산을 접고 업무 목록 조회를 멈춥니다. (`serverSendsDueKinds` 래치)
**백엔드를 올리는 순간 프론트 배포 없이 요청이 `1 + N` 에서 `1` 로 떨어집니다.**

나중에 여유 있을 때 죽은 코드(`useQueries` 블록, `localRead`)를 걷어내면 됩니다.
안 걷어내도 동작에는 영향이 없습니다.

**품**: 백 반나절, **프론트 0**.

## ② 실시간 전달 — 폴링 → SSE

30초 지연을 없애고 요청 수도 줄입니다. WebSocket 까지 갈 필요 없습니다.
**알림은 서버→클라 한 방향**이라 SSE 로 충분합니다.

**백엔드**
```java
@GetMapping(value = "/api/notifications/stream", produces = TEXT_EVENT_STREAM_VALUE)
public SseEmitter stream(@AuthenticationPrincipal User user) {
    SseEmitter emitter = new SseEmitter(0L);            // 타임아웃 없음
    emitters.add(user.getId(), emitter);
    emitter.onCompletion(() -> emitters.remove(user.getId(), emitter));
    emitter.onTimeout(() -> emitters.remove(user.getId(), emitter));
    return emitter;
}

// 알림을 만든 바로 그 자리(NotificationListener)에서 밀어 준다
emitters.send(targetUserId, "notification", dto);
```
- 주의: **프록시가 버퍼링하면 안 됩니다.** Nginx 면 `proxy_buffering off;`
- 주의: 서버를 여러 대로 늘리면 emitter 가 인스턴스에 묶입니다. 그때는 Redis pub/sub 필요.
- 15~30초마다 주석 한 줄(`:ping`)을 보내 연결이 끊기지 않게 하세요.

**프론트**
```ts
useEffect(() => {
  const es = new EventSource('/api/notifications/stream', { withCredentials: true })
  es.addEventListener('notification', () => {
    qc.invalidateQueries({ queryKey: qk.notifications })   // 받으면 다시 불러온다
  })
  es.onerror = () => { /* EventSource 는 알아서 재접속한다 */ }
  return () => es.close()
}, [qc])
```
- **폴링을 지우지 말고 간격만 늘리세요** (30초 → 5분). SSE 가 끊겨도 알림이 멈추지 않습니다.
- JWT 를 헤더로 보내는 구조면 `EventSource` 는 헤더를 못 실으므로
  쿼리 파라미터 토큰이나 쿠키가 필요합니다. 여기서 한 번 막힐 수 있습니다.

**품**: 백 1일, 프론트 2시간.

## ③ 브라우저 OS 알림 (앱이 열려 있을 때)

탭이 뒤에 있어도 OS 알림 배너를 띄웁니다. **백엔드 작업 없음.**

**프론트만**
```ts
// 권한은 사용자가 버튼을 눌렀을 때만 요청한다. 페이지 로드 직후에 물으면 대부분 거절한다.
const granted = await Notification.requestPermission()

// 새 알림이 들어왔을 때 (SSE 이벤트 또는 폴링 결과의 diff)
if (Notification.permission === 'granted' && document.hidden) {
  const n = new Notification(KIND_LABEL[kind], { body: taskTitle, tag: `task-${id}` })
  n.onclick = () => { window.focus(); location.href = `/projects/${p}/tasks/${id}` }
}
```
- `tag` 를 같은 값으로 주면 같은 업무의 알림이 쌓이지 않고 덮어씁니다.
- `document.hidden` 일 때만 띄우세요. 보고 있는 화면에 또 띄우면 성가십니다.
- **앱이 닫혀 있으면 안 됩니다.** 그건 ④ 입니다.

**품**: 프론트 반나절.

## ④ Web Push (앱이 닫혀 있어도)

진짜 "놓치지 않는" 알림. 대신 품이 제일 많이 듭니다.

**백엔드**
1. VAPID 키쌍 생성 (`web-push` 라이브러리 / Java 는 `webpush-java`)
2. 구독 저장: `push_subscription(user_id, endpoint, p256dh, auth, created_at)`
3. `POST /api/push/subscribe`, `DELETE /api/push/subscribe`
4. 알림 생성 시점에 그 사용자의 구독 전부로 발송
5. **410 Gone / 404 가 오면 그 구독을 지우세요.** 안 그러면 죽은 구독에 계속 쏩니다.

**프론트**
1. `public/sw.js` — 서비스 워커
```js
self.addEventListener('push', (e) => {
  const d = e.data.json()
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, data: d.url, tag: d.tag }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data))
})
```
2. 등록 + 구독 → 서버로 전송
3. 설정 화면에 켜기/끄기 토글

**주의**
- **HTTPS 필수** (localhost 는 예외). Vercel 이라 배포본은 문제없습니다.
- iOS 사파리는 **홈 화면에 추가한 PWA 에서만** 됩니다. 아이폰 사용자에겐 안 옵니다.
- 알림 폭주가 바로 체감됩니다. ⑤ (설정) 를 같이 넣는 게 좋습니다.

**품**: 백 2~3일, 프론트 1~2일. **먼저 ①②③ 을 하고 나서 판단하세요.**

## ⑤ 알림 설정 — 종류별 on/off, 방해 금지

**백엔드**
```sql
notification_preference(
  user_id, type,            -- DUE_SOON / OVERDUE / TASK_CREATED / ...
  in_app   boolean default true,
  push     boolean default false,
  email    boolean default false,
  primary key (user_id, type)
)
-- 별도로
user_setting(user_id, quiet_from time, quiet_to time, timezone varchar)
```
- `GET/PUT /api/me/notification-preferences`
- 알림을 만들기 직전에 이 표를 한 번 보고 거릅니다.
- 방해 금지 시간에 걸리면 **버리지 말고 미뤘다가** 시간이 지나면 보내세요.

**프론트**
- 설정 페이지에 종류 × 채널 체크박스 격자
- 종 패널 상단에 "알림 설정" 링크

**품**: 백 1일, 프론트 1일.

## ⑥ 페이징 · 오래된 알림 정리

**백엔드**
```
GET /api/notifications?cursor={id}&size=20   → { items, nextCursor }
GET /api/notifications/unread-count          → { count }   ★ 이것만 먼저 해도 큼
```
- 배지 숫자 때문에 전체 목록을 받을 필요가 없어집니다. **가장 값싼 성능 개선.**
- 90일 지난 읽은 알림은 배치로 지우세요.

**프론트**
- `useInfiniteQuery` 로 교체, 패널 바닥에서 다음 페이지
- 배지는 `unread-count` 만 폴링

**품**: 백 반나절, 프론트 반나절.

## ⑦ 알림 묶어 보기 (그룹핑)

회의 분석을 확정하면 업무 5건이 한꺼번에 생기고 알림도 5건 옵니다.
"회의 A 에서 업무 5건이 배정되었습니다" 한 줄이 낫습니다.

**백엔드**: `group_key` 컬럼 (예: `meeting-12-created`) 을 추가하고 같은 키끼리 묶어 내려 주기
**프론트**: 같은 `group_key` 를 한 줄로 접고, 누르면 펼치기

**품**: 백 1일, 프론트 1일. **급하지 않습니다.**

## ⑧ 이메일 다이제스트

실시간 말고 "매일 아침 어제 못 본 것 모아서 한 통".
Web Push 보다 만들기 쉽고, 앱을 안 여는 사람에게는 더 잘 닿습니다.

**백엔드**: `@Scheduled` 로 매일 아침, 안 읽은 알림을 사용자별로 모아 한 통
**프론트**: 설정에서 켜기/끄기만

**품**: 백 1일. 메일 발송 수단(SES/SendGrid)이 필요합니다.

---

# 4부. 권장 순서

```
1. ①  마감 알림 서버로            ← 한계 ②③ 해소. 프론트 코드는 오히려 줄어듦
2. ⑥  unread-count 엔드포인트만    ← 반나절, 효과 큼
3.    백엔드 3종 (BACKEND_NOTES 3차 요청)  ← TASK_CREATED → COMPLETED → UPDATED
4. ②  SSE                        ← 30초 지연 제거
5. ③  브라우저 알림               ← 프론트만, 반나절
6. ⑤  알림 설정                   ← 여기서부터는 끄는 수단이 꼭 필요해짐
7. ④  Web Push  또는  ⑧ 이메일     ← 사용자가 앱을 안 연다는 게 확인되면
8. ⑦  그룹핑                      ← 시끄럽다는 말이 나오면
```

**1~3번까지만 해도 지금 아쉬운 것의 대부분이 없어집니다.**
4번 이후는 "앱을 닫아 둔 사람에게도 닿아야 하나?" 에 답이 서고 나서 판단하세요.

---

# 부록. 어디를 건드려야 하나

| 하고 싶은 것 | 고칠 파일 |
| --- | --- |
| 알림 종류 추가 | `useNotifications.ts` 의 `NotificationKind` · `KIND_LABEL`, `NotificationBell.tsx` 의 `KIND_ICON` · `KIND_COLOR` |
| 마감 예고 시작일 바꾸기 | `useNotifications.ts` 의 `DUE_SOON_NOTICE_DAYS` |
| "마감 임박" 뱃지 기준 바꾸기 | `lib/date.ts` 의 `DUE_SOON_DAYS` |
| 폴링 간격 | `useNotifications.ts` 의 `POLL_MS` |
| 알림 문구 | `useNotifications.ts` 의 `KIND_LABEL` |
| 종 모양·배치 | `NotificationBell.tsx` |
