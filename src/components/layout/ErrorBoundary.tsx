import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'

interface State {
  error: Error | null
}

/** 렌더링 중 예외가 나도 흰 화면 대신 복구 가능한 안내를 보여준다. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-lg">
        <div className="max-w-md text-center">
          <h1 className="text-display-sm text-ink">문제가 발생했습니다</h1>
          <p className="mt-sm text-body-md text-muted">{this.state.error.message}</p>
          <div className="mt-xl flex justify-center gap-sm">
            <Button variant="secondary" onClick={() => this.setState({ error: null })}>
              다시 시도
            </Button>
            <Button onClick={() => window.location.assign('/')}>처음으로</Button>
          </div>
        </div>
      </div>
    )
  }
}
