export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col h-full">
          <div className="p-4">
            <div className="flex justify-end">
              <div className="bg-muted animate-pulse rounded-lg h-9 w-16 ml-auto"></div>
            </div>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-muted animate-pulse aspect-[4/3] rounded-lg"></div>
            <div className="space-y-2">
              <div className="bg-muted animate-pulse h-4 w-3/4 rounded"></div>
              <div className="bg-muted animate-pulse h-4 w-1/2 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 