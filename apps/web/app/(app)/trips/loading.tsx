import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={7} cols={5} />
    </div>
  )
}
