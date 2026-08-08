import {
  PageHeaderSkeleton,
  CardGridSkeleton,
  FormSkeleton,
} from "@repo/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={3} />
      <CardGridSkeleton count={6} />
    </div>
  )
}
