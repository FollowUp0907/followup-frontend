import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { ChevronRight, Plus } from 'lucide-react'
import { errorMessage } from '@/api/client'
import { TopNav } from '@/components/layout/TopNav'
import { Footer } from '@/components/layout/Footer'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton, SurfaceCard } from '@/components/ui/Card'
import { FormRow, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useCreateProject, useProjects } from '@/features/projects/queries'
import { formatServerRelative } from '@/lib/date'

const schema = z.object({
  name: z.string().min(1, '프로젝트명을 입력해 주세요.').max(150, '150자 이하로 입력해 주세요.'),
  description: z.string().max(1000, '1000자 이하로 입력해 주세요.').optional(),
})
type FormValues = z.infer<typeof schema>

export default function ProjectsPage() {
  const { data: projects, isLoading, isError, error, refetch } = useProjects()
  const createProject = useCreateProject()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await createProject.mutateAsync({
        name: values.name,
        description: values.description?.trim() || undefined,
      })
      toast.success('프로젝트를 만들었습니다.')
      setOpen(false)
      reset()
      navigate(`/projects/${created.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  })

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav variant="plain" />

      <main className="flex-1">
        <div className="mx-auto w-full max-w-[800px] px-lg py-[64px]">
          <PageHeader
            title="프로젝트"
            description="참여 중인 프로젝트를 선택하세요."
            actions={
              <Button onClick={() => setOpen(true)}>
                <Plus size={16} /> 새 프로젝트
              </Button>
            }
          />

          {isLoading && (
            <div className="flex flex-col gap-sm">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-[104px]" />
              ))}
            </div>
          )}

          {isError && (
            <EmptyState
              title="프로젝트를 불러오지 못했습니다"
              description={errorMessage(error)}
              action={
                <Button variant="secondary" onClick={() => refetch()}>
                  다시 시도
                </Button>
              }
            />
          )}

          {!isLoading && !isError && projects?.length === 0 && (
            <EmptyState
              title="아직 프로젝트가 없습니다"
              description="프로젝트를 만들고 첫 회의록을 넣어 보세요."
              action={<Button onClick={() => setOpen(true)}>프로젝트 생성</Button>}
            />
          )}

          {!!projects?.length && (
            <ul className="flex flex-col gap-sm">
              {projects.map((p) => (
                <SurfaceCard as="li" key={p.id} className="shadow-none transition-shadow hover:shadow-card">
                  <Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-md p-xl">
                    <div className="min-w-0">
                      <h2 className="truncate text-title-md text-ink">{p.name}</h2>
                      <p className="mt-xxs line-clamp-1 text-body-sm text-body">
                        {p.description || '설명이 없습니다.'}
                      </p>
                      <p className="mt-xs text-caption font-normal text-muted-soft">
                        최근 업데이트 {formatServerRelative(p.updatedAt)}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-muted" />
                  </Link>
                </SurfaceCard>
              ))}
            </ul>
          )}

          <Modal
            open={open}
            onClose={() => setOpen(false)}
            title="새 프로젝트"
            description="프로젝트를 만들면 자동으로 OWNER 권한을 갖습니다."
            footer={
              <>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  취소
                </Button>
                <Button type="submit" form="create-project-form" loading={createProject.isPending}>
                  생성
                </Button>
              </>
            }
          >
            <form id="create-project-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-md">
              <FormRow label="프로젝트명" htmlFor="name" error={errors.name?.message}>
                <Input id="name" placeholder="FollowUp 프론트엔드" invalid={!!errors.name} {...register('name')} />
              </FormRow>
              <FormRow label="설명" htmlFor="description" hint="선택" error={errors.description?.message}>
                <Textarea
                  id="description"
                  className="min-h-[100px]"
                  placeholder="이 프로젝트에서 다루는 내용을 적어 주세요."
                  {...register('description')}
                />
              </FormRow>
            </form>
          </Modal>
        </div>
      </main>

      <Footer />
    </div>
  )
}
