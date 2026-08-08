import {
  PageHeaderSkeleton,
  StatCardsSkeleton,
  PanelSkeleton,
} from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={4} />
      <PanelSkeleton />
    </div>
  )
}
