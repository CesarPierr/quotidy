export default function BudgetLoading() {
  return (
    <section className="space-y-3 sm:space-y-4">
      <div className="px-1">
        <div className="h-3 w-16 rounded bg-black/10" />
        <div className="mt-2 h-7 w-40 rounded bg-black/10" />
      </div>
      <div className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
        <div className="h-3 w-28 rounded bg-black/10" />
        <div className="mt-3 h-9 w-44 rounded bg-black/10" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl border border-line bg-white/60 dark:bg-surface/60" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="app-surface rounded-[1.4rem] p-4 sm:rounded-[1.6rem] sm:p-5">
            <div className="h-4 w-24 rounded bg-black/10" />
            <div className="mt-3 h-2 w-full rounded-full bg-black/10" />
            <div className="mt-2 h-3 w-20 rounded bg-black/10" />
          </div>
        ))}
      </div>
    </section>
  );
}
