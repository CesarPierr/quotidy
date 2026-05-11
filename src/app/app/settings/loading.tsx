export default function SettingsLoading() {
  return (
    <section className="app-surface rounded-[2rem] p-5 sm:p-6 space-y-5">
      {/* Panel title skeleton */}
      <div>
        <div className="shimmer-line h-3 w-20 rounded-full bg-black/8" />
        <div className="shimmer-line mt-3 h-7 w-44 rounded-2xl bg-black/8" />
        <div className="shimmer-line mt-2 h-4 w-64 rounded-full bg-black/6" />
      </div>

      {/* Content rows skeleton */}
      <div className="space-y-3 pt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-line bg-white/60 dark:bg-[#262830]/60 p-4">
            <div className="shimmer-line size-10 shrink-0 rounded-xl bg-black/8" />
            <div className="flex-1 space-y-2">
              <div className="shimmer-line h-4 w-36 rounded-lg bg-black/8" />
              <div className="shimmer-line h-3 w-52 rounded-full bg-black/6" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
