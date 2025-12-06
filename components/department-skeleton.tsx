import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function DepartmentCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 bg-muted w-3/4" />
            <Skeleton className="h-4 bg-muted w-full" />
          </div>
          <Skeleton className="h-8 w-8 bg-muted rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 bg-muted w-20" />
            <Skeleton className="h-4 bg-muted w-8" />
          </div>
          <div className="flex justify-between text-sm">
            <Skeleton className="h-4 bg-muted w-16" />
            <Skeleton className="h-4 bg-muted w-8" />
          </div>
          <div>
            <Skeleton className="h-4 bg-muted w-24 mb-2" />
            <Skeleton className="h-3 bg-muted w-full" />
            <Skeleton className="h-3 bg-muted w-2/3 mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
