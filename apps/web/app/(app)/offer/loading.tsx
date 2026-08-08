import { PageHeaderSkeleton, FormSkeleton } from "@/components/ui/page-skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={6} />
    </div>
  )
}
