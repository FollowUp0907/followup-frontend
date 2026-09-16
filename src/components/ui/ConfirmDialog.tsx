import type { ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '삭제',
  cancelLabel = '취소',
  /** 되돌릴 수 없는 작업이면 true. 생성·저장처럼 안전한 확인은 false. */
  destructive = true,
  loading,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} type="button">
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
