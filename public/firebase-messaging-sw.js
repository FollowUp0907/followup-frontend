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
    const title = data.taskTitle || '새 알림'
    self.registration.showNotification(title, {
      body: data.taskTitle || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.notificationId || undefined,
      data,
    })
  })
}

/** 알림을 누르면 해당 화면으로 — 이미 열린 탭이 있으면 그 탭을 쓴다. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const projectId = data.projectId
  const actionItemId = data.actionItemId
  let path = '/projects'
  if (projectId && actionItemId) path = `/projects/${projectId}/tasks/${actionItemId}`
  else if (projectId) path = `/projects/${projectId}`

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(new URL(path, self.location.origin).href)
          return client.focus()
        }
      }
      return self.clients.openWindow(path)
    }),
  )
})
