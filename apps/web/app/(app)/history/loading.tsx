import { PageHeaderSkeleton, TableSkeleton } from "@repo/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} cols={5} />
    </div>
  )
}
