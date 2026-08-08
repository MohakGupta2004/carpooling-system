import {
  PageHeaderSkeleton,
  ListSkeleton,
  PanelSkeleton,
} from "@repo/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <PanelSkeleton className="h-80 lg:col-span-2" />
        <ListSkeleton rows={4} />
      </div>
    </div>
  )
}
