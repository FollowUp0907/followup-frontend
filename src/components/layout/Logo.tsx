import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import symbolMask from '@/assets/logo-symbol.png'
import wordmarkMask from '@/assets/logo-wordmark.png'

/**
 * 로고는 알파 채널만 담은 PNG 를 CSS mask 로 찍고 배경색을 currentColor 로 준다.
 * 검정용/흰색용 파일을 따로 두지 않아도 놓인 자리의 글자색을 그대로 따라간다.
 * (원본 락업의 검정본과 흰색본은 알파가 완전히 동일해서 마스크 하나로 충분하다)
 */
const SYMBOL_RATIO = 280 / 128
const WORDMARK_RATIO = 726 / 96

function Mask({ src, height, ratio, className }: { src: string; height: number; ratio: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block shrink-0 bg-current', className)}
      style={{
        height,
        width: height * ratio,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: '100% 100%',
        WebkitMaskSize: '100% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
      }}
    />
  )
}

export interface LogoProps {
  /** symbol = 심볼만 (앱 내비), full = 심볼 + 워드마크 (마케팅·인증 화면) */
  variant?: 'symbol' | 'full'
  /** 심볼 높이(px). full 이면 워드마크는 이 값에 맞춰 비율로 줄어든다. */
  height?: number
  to?: string
  className?: string
}

export function Logo({ variant = 'full', height = 22, to, className }: LogoProps) {
  const content = (
    <>
      <Mask src={symbolMask} height={height} ratio={SYMBOL_RATIO} />
      {variant === 'full' && (
        <Mask src={wordmarkMask} height={height * 0.62} ratio={WORDMARK_RATIO} className="ml-[0.42em]" />
      )}
      <span className="sr-only">FollowUp</span>
    </>
  )

  const classes = cn('inline-flex items-center text-ink', className)

  if (!to) return <span className={classes}>{content}</span>

  return (
    <Link to={to} className={cn(classes, 'rounded-md transition-opacity hover:opacity-70')} aria-label="FollowUp">
      {content}
    </Link>
  )
}
