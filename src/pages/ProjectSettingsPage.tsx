import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageWidth } from '@/components/layout/PageWidth'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useProjectContext } from '@/features/projects/ProjectContext'
import { useDeleteProject, useUpdateProject } from '@/features/projects/queries'
import { formatServerDateTime } from '@/lib/date'

export default function ProjectSettingsPage() {
  const { projectId, project, isOwner } = useProjectContext()
  const navigate = useNavigate()
  const toast = useToast()
  const updateProject = useUpdateProject(projectId)
  const deleteProject = useDeleteProject()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  useEffect(() => {
    setName(project.name)
    setDescription(project.description ?? '')
  }, [project])

  const dirty = name !== project.name || description !== (project.description ?? '')

  const save = async () => {
    if (!name.trim()) {
      toast.error('프로젝트명을 입력해 주세요.')
      return
    }
    try {
      await updateProject.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      })
      toast.success('프로젝트 정보를 저장했습니다.')
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const remove = async () => {
    try {
      await deleteProject.mutateAsync(projectId)
      toast.success('프로젝트를 삭제했습니다.')
      navigate('/projects', { replace: true })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <PageWidth size={800}>
      <PageHeader title="프로젝트 설정" description="프로젝트 기본 정보를 관리합니다." />

      <div className="grid gap-lg lg:grid-cols-12">
        <div className="space-y-lg lg:col-span-8">
          <SurfaceCard className="p-xl">
            <h2 className="mb-md text-title-md text-ink">기본 정보</h2>
            <div className="space-y-md">
              <FormRow label="프로젝트명">
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} maxLength={150} />
              </FormRow>
              <FormRow label="설명" hint="선택">
                <Textarea
                  className="min-h-[120px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isOwner}
                />
              </FormRow>
            </div>
            {isOwner ? (
              <div className="mt-lg flex justify-end">
                <Button onClick={save} disabled={!dirty} loading={updateProject.isPending}>
                  저장
                </Button>
              </div>
            ) : (
              <p className="mt-lg rounded-md bg-surface-soft px-md py-sm text-body-sm text-muted">
                프로젝트 정보는 OWNER만 수정할 수 있습니다.
              </p>
            )}
          </SurfaceCard>

          {isOwner && (
            <SurfaceCard className="border-error/30 p-xl">
              <h2 className="text-title-md text-error">프로젝트 삭제</h2>
              <p className="mt-xs text-body-sm text-muted">
                회의, 회의록, 결정 사항, 후속 업무가 모두 삭제됩니다. 되돌릴 수 없습니다.
              </p>
              <div className="mt-lg">
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  프로젝트 삭제
                </Button>
              </div>
            </SurfaceCard>
          )}
        </div>

        <div className="lg:col-span-4">
          <SurfaceCard className="p-xl">
            <h2 className="mb-md text-title-md text-ink">프로젝트 정보</h2>
            <dl className="space-y-sm text-body-sm">
              <div className="flex justify-between gap-md">
                <dt className="text-muted">프로젝트 ID</dt>
                <dd className="tabular-nums text-ink">{project.id}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-muted">생성일</dt>
                <dd className="text-ink">{formatServerDateTime(project.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-muted">수정일</dt>
                <dd className="text-ink">{formatServerDateTime(project.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-md">
                <dt className="text-muted">내 권한</dt>
                <dd className="text-ink">{isOwner ? 'OWNER' : 'MEMBER'}</dd>
              </div>
            </dl>
          </SurfaceCard>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="프로젝트를 삭제할까요?"
        description={`확인을 위해 프로젝트명 "${project.name}" 을 입력해 주세요.`}
        loading={deleteProject.isPending}
        onConfirm={() => {
          if (confirmText !== project.name) {
            toast.error('프로젝트명이 일치하지 않습니다.')
            return
          }
          void remove()
        }}
        onClose={() => {
          setConfirmDelete(false)
          setConfirmText('')
        }}
      >
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={project.name} />
      </ConfirmDialog>
    </PageWidth>
  )
}
