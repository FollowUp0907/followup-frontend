/*
 * 웹 푸시 서비스워커 — 앱이 꺼져 있는 동안 알림을 받는다.
 *
 * 이 파일은 빌드를 거치지 않는 정적 파일이라 환경변수를 읽을 수 없다.
 * 그래서 등록할 때 주소에 설정값을 실어 보내고(src/lib/push.ts), 여기서 꺼내 쓴다.
 */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

const params = new URLSearchParams(self.location.search)
const config = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
}

/**
 * 알림에 붙어 온 data 를 꺼낸다.
 *
 * 여기가 한 번 틀렸던 곳이다. 백엔드가 notification 을 함께 보내면 **브라우저가
 * 배너를 자동으로 띄우는데**, 그때 payload 는 그대로 들어오지 않고
 * `notification.data.FCM_MSG.data` 안에 들어간다. 우리가 직접 띄운 알림만
 * `notification.data` 에 그대로 있다. 둘 다 받아야 클릭이 동작한다.
 */
function readData(notification) {
  const raw = (notification && notification.data) || {}
  if (raw.FCM_MSG) return (raw.FCM_MSG.data || raw.FCM_MSG.notification || {})
  if (raw.data) return raw.data
  return raw
}

/** 업무가 있으면 업무 화면, 프로젝트만 있으면 프로젝트 화면. (actionItemId 는 없으면 빈 문자열로 온다) */
function pathFor(data) {
  const projectId = data.projectId
  const actionItemId = data.actionItemId
  if (projectId && actionItemId) return '/projects/' + projectId + '/tasks/' + actionItemId
  if (projectId) return '/projects/' + projectId
  return '/projects'
}

if (config.apiKey && config.messagingSenderId && config.appId) {
  firebase.initializeApp(config)
  const messaging = firebase.messaging()

  /*
   * 백그라운드 메시지.
   * 백엔드가 notification 을 함께 보내므로 브라우저가 배너를 알아서 띄운다.
   * 여기서 또 띄우면 두 번 뜨기 때문에, data 만 온 경우에만 직접 띄운다.
   */
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return
    const data = payload.data || {}
    self.registration.showNotification(data.taskTitle || '새 알림', {
      body: data.taskTitle || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.notificationId || undefined,
      data: data,
    })
  })
}

/** 알림을 누르면 해당 화면으로 — 이미 열린 탭이 있으면 그 탭을 쓴다. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = readData(event.notification)
  const path = pathFor(data)
  const url = new URL(path, self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue
        if ('focus' in client) await client.focus()
        try {
          // 서비스워커가 제어 중인 탭이면 그대로 이동시킨다.
          await client.navigate(url)
        } catch (e) {
          // 아직 제어하지 않는 탭(등록 직후 첫 세션 등)은 새로고침 없이 앱에 맡긴다.
          client.postMessage({ type: 'followup:navigate', path: path })
        }
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
