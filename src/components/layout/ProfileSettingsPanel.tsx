import { useState } from 'react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { accountApiMissing, deleteMyAccount, updateMyName } from '@/api/userApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'

/**
 * 프로필 팝오버 안의 계정 설정.
 *
 * 이름 수정과 회원 탈퇴를 그 자리에서 한다. 탈퇴는 되돌릴 수 없으므로 한 번 더 묻는다.
 * 백엔드에 계정 API 가 아직 없으면 그대로 알려 준다 — 되는 척하지 않는다.
 */
export function ProfileSettingsPanel({
  currentName,
  email,
  onBack,
  onRenamed,
  onDeleted,
}: {
  currentName: string
  /** 탈퇴를 확인할 때 그대로 입력해야 하는 주소 */
  email: string
  onBack: () => void
  onRenamed: (name: string) => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // 프로젝트 삭제처럼, 자기 이메일을 그대로 적어야 탈퇴된다.
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase() && !!email

  const changed = name.trim().length > 0 && name.trim() !== currentName

  const fail = (e: unknown) =>
    setError(accountApiMissing(e) ? '이 기능은 서버에 아직 준비되지 않았습니다.' : errorMessage(e))

  const save = async () => {
    setSaving(true)
    setError(null)
    setDone(null)
    try {
      await updateMyName(name.trim())
      onRenamed(name.trim())
      setDone('이름을 바꿨습니다.')
    } catch (e) {
      fail(e)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteMyAccount()
      onDeleted()
    } catch (e) {
      fail(e)
      setDeleting(false)
    }
  }

  return (
    <div className="p-xxs">
      <button
        type="button"
        onClick={onBack}
        className="mb-xxs flex items-center gap-xxs rounded-sm px-sm py-xs text-caption text-muted transition-colors hover:bg-surface-card"
      >
        <ArrowLeft size={13} /> 프로필
      </button>

      <div className="px-sm pb-xs">
        <label htmlFor="profile-name" className="mb-xxs block text-caption text-body">
          이름
        </label>
        <div className="flex items-center gap-xs">
          <Input
            id="profile-name"
            value={name}
            maxLength={50}
            className="h-9 flex-1"
            onChange={(e) => {
              setName(e.target.value)
              setDone(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && changed) {
                e.preventDefault()
                void save()
              }
            }}
          />
          <Button size="sm" className="shrink-0" disabled={!changed} loading={saving} onClick={() => void save()}>
            저장
          </Button>
        </div>
        {done && <p className="mt-xxs text-caption font-normal text-success">{done}</p>}
      </div>

      <div className="my-xxs h-px bg-hairline-soft" />

      {!confirming ? (
        <button
          type="button"
          onClick={() => {
            setConfirming(true)
            setTyped('')
            setError(null)
          }}
          className="flex w-full items-center gap-xs rounded-sm px-sm py-xs text-left text-body-sm text-error transition-colors hover:bg-error/5"
        >
          <AlertTriangle size={14} /> 계정 탈퇴
        </button>
      ) : (
        <div className="rounded-sm bg-error/5 p-sm">
          <p className="flex items-start gap-xxs text-caption font-semibold text-error">
            <AlertTriangle size={13} className="mt-[2px] shrink-0" />
            정말 탈퇴하시겠습니까?
          </p>
          <p className="mt-xxs text-caption font-normal leading-relaxed text-muted">
            계정이 삭제되고 되돌릴 수 없습니다. 내가 만든 프로젝트와 회의록도 함께 사라집니다. 맡고 있던 업무는
            담당자 없이 남습니다.
          </p>

          <label htmlFor="delete-confirm" className="mt-sm block text-caption leading-relaxed text-body">
            확인을 위해 <b className="font-semibold text-ink">{email}</b> 을 그대로 입력해 주세요.
          </label>
          <Input
            id="delete-confirm"
            type="email"
            autoComplete="off"
            value={typed}
            placeholder={email}
            className="mt-xxs h-9"
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && matches) {
                e.preventDefault()
                void remove()
              }
            }}
          />

          <div className="mt-sm flex gap-xs">
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => setConfirming(false)}>
              취소
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="flex-1"
              disabled={!matches}
              loading={deleting}
              onClick={() => void remove()}
            >
              탈퇴
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-xs rounded-sm bg-error/10 px-sm py-xs text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
