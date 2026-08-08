import { PageHeaderSkeleton, FormSkeleton } from "@repo/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={5} />
    </div>
  )
}
