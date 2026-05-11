export default function PlanifierLoading() {
  return (
    <section className="space-y-4">
      {/* Page header skeleton */}
      <div className="px-1">
        <div className="shimmer-line h-8 w-44 rounded-2xl bg-black/8" />
        <div className="shimmer-line mt-2 h-4 w-64 rounded-full bg-black/6" />
      </div>

      {/* Hub cards grid skeleton */}
      <div className="grid gap-4 xl:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="app-surface rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="shimmer-line size-12 shrink-0 rounded-2xl bg-black/8" />
              <div className="flex-1 space-y-2">
                <div className="shimmer-line h-4 w-32 rounded-lg bg-black/8" />
                <div className="shimmer-line h-3 w-56 rounded-full bg-black/6" />
                <div className="shimmer-line mt-3 h-8 w-20 rounded-full bg-black/8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
