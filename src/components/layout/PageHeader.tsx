import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: ReactNode
}) {
  return (
    <div className="mb-sm shrink-0">
      {breadcrumb && <div className="mb-sm">{breadcrumb}</div>}
      <div className="flex flex-wrap items-start justify-between gap-md">
        <div className="min-w-0">
          <h1 className="text-title-lg text-ink">{title}</h1>
          {description && <p className="mt-xxs max-w-2xl text-body-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-sm">{actions}</div>}
      </div>
    </div>
  )
}
