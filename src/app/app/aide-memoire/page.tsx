import { AideMemoireClient } from "@/components/aide-memoire/aide-memoire-client";
import { listChecklists, listHouseholdNotes } from "@/lib/aide-memoire";
import { requireUser } from "@/lib/auth";
import { requireHouseholdContext } from "@/lib/households";

type AideMemoirePageProps = {
  searchParams: Promise<{ household?: string }>;
};

export default async function AideMemoirePage({ searchParams }: AideMemoirePageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const context = await requireHouseholdContext(user.id, params.household);
  const householdId = context.household.id;
  const retentionDays = context.household.noteRetentionDays;

  const [notes, checklists] = await Promise.all([
    listHouseholdNotes(householdId, retentionDays),
    listChecklists(householdId),
  ]);

  const tasks = context.tasks.map((task) => ({ id: task.id, title: task.title }));

  return (
    <AideMemoireClient
      activeNotes={notes.active}
      checklists={checklists}
      doneNotes={notes.done}
      householdId={householdId}
      retentionDays={retentionDays}
      tasks={tasks}
    />
  );
}
