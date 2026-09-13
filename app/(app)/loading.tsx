import { Skeleton } from '@/components/ui/skeleton'

// Instant shell while a page's server data loads; also lets Link prefetch cache the route.
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-3 w-96" /></div>
      <div className="flex gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 flex-1" />)}</div>
      <Skeleton className="h-80 w-full" />
    </div>
  )
}
