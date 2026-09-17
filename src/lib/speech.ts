import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 브라우저 받아쓰기 (Web Speech API).
 *
 * 서버가 필요 없다. 크롬·엣지·사파리에 들어 있는 인식기를 그대로 쓴다.
 * 파이어폭스에는 없어서 STT_SUPPORTED 가 false 로 떨어지고, 화면에서는 버튼을 숨긴다.
 *
 * 인식 결과는 두 가지로 나온다.
 *   final   말이 끝나 확정된 문장 — onText 로 넘겨 회의록에 적는다
 *   interim 아직 다듬는 중인 조각 — 화면에만 잠깐 보여 주고 버린다
 *
 * 크롬은 continuous 를 켜도 조용하면 제멋대로 끝낸다. 그래서 사용자가 중지를
 * 누르기 전까지는 onend 에서 다시 붙여 준다. (keepAlive)
 */

interface SpeechAlternative {
  transcript: string
}
interface SpeechResult {
  readonly length: number
  isFinal: boolean
  [index: number]: SpeechAlternative
}
interface SpeechResultList {
  readonly length: number
  [index: number]: SpeechResult
}
interface SpeechResultEvent {
  resultIndex: number
  results: SpeechResultList
}
interface SpeechErrorEvent {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechResultEvent) => void) | null
  onerror: ((e: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

const Recognition: SpeechRecognitionCtor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as Record<string, SpeechRecognitionCtor | undefined>).SpeechRecognition ??
      (window as unknown as Record<string, SpeechRecognitionCtor | undefined>).webkitSpeechRecognition)

export const STT_SUPPORTED = !!Recognition

/** 인식기가 주는 코드는 그대로 보여 줄 만한 말이 아니라 옮겨 둔다. */
export function speechErrorMessage(code: string) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '마이크 사용이 차단되어 있습니다. 주소창의 자물쇠에서 마이크를 허용해 주세요.'
    case 'audio-capture':
      return '마이크를 찾지 못했습니다. 연결을 확인해 주세요.'
    case 'network':
      return '음성 인식 서버에 연결하지 못했습니다. 네트워크를 확인해 주세요.'
    default:
      return '받아쓰기에 문제가 생겼습니다. 다시 시도해 주세요.'
  }
}

export function useSpeechToText({
  onText,
  onError,
  lang = 'ko-KR',
}: {
  /** 확정된 문장 하나 */
  onText: (text: string) => void
  onError?: (message: string) => void
  lang?: string
}) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  // 사용자가 중지를 누를 때까지 붙잡아 둔다.
  const keepAlive = useRef(false)
  const onTextRef = useRef(onText)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onTextRef.current = onText
    onErrorRef.current = onError
  })

  const stop = useCallback(() => {
    keepAlive.current = false
    recRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    if (!Recognition || recRef.current) return
    const rec = new Recognition()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let confirmed = ''
      let draft = ''
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i]
        if (r.isFinal) confirmed += r[0].transcript
        else draft += r[0].transcript
      }
      if (confirmed.trim()) onTextRef.current(confirmed.trim())
      setInterim(draft)
    }

    rec.onerror = (e) => {
      // 잠깐 조용했거나 우리가 끈 것 — 알릴 일이 아니다.
      if (e.error === 'no-speech' || e.error === 'aborted') return
      keepAlive.current = false
      onErrorRef.current?.(speechErrorMessage(e.error))
    }

    rec.onend = () => {
      setInterim('')
      if (keepAlive.current) {
        // 조용해서 저 혼자 끝난 것뿐이다. 이어서 듣는다.
        try {
          rec.start()
          return
        } catch {
          keepAlive.current = false
        }
      }
      recRef.current = null
      setListening(false)
    }

    try {
      rec.start()
      keepAlive.current = true
      recRef.current = rec
      setListening(true)
    } catch {
      onErrorRef.current?.(speechErrorMessage('unknown'))
    }
  }, [lang])

  // 페이지를 떠나면 마이크를 놓아 준다.
  useEffect(
    () => () => {
      keepAlive.current = false
      recRef.current?.abort()
      recRef.current = null
    },
    [],
  )

  return { supported: STT_SUPPORTED, listening, interim, start, stop }
}
