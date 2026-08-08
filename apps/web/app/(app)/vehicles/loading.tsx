import {
  PageHeaderSkeleton,
  CardGridSkeleton,
} from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  )
}
