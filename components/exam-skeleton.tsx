import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ExamCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 bg-muted w-3/4" />
            <Skeleton className="h-4 bg-muted w-1/2" />
          </div>
          <Skeleton className="h-8 w-8 bg-muted rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <div className="space-y-2 border-t border-b py-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 bg-muted w-20" />
            <Skeleton className="h-4 bg-muted w-32" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-4 bg-muted w-20" />
            <Skeleton className="h-4 bg-muted w-32" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 bg-muted mx-auto" />
            <Skeleton className="h-6 w-8 bg-muted mx-auto" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 bg-muted mx-auto" />
            <Skeleton className="h-6 w-8 bg-muted mx-auto" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 bg-muted mx-auto" />
            <Skeleton className="h-6 w-8 bg-muted mx-auto" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between bg-muted/50 py-3 px-6">
        <Skeleton className="h-4 bg-muted w-24" />
        <Skeleton className="h-6 bg-muted w-11 rounded-full" />
      </CardFooter>
    </Card>
  )
}

export function StatsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 bg-muted w-24" />
        <Skeleton className="h-5 bg-muted w-5 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 bg-muted w-16" />
      </CardContent>
    </Card>
  )
}
