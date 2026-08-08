import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} cols={4} />
    </div>
  )
}
