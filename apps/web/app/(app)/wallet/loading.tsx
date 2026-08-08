import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  ListSkeleton,
} from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <ListSkeleton rows={6} />
    </div>
  )
}
