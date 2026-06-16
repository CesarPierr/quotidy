import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ household?: string; tab?: string }> };

/** Legacy route. Task list → Tâches/Aujourd'hui; catalog/wizard → Tâches/Routines. */
export default async function MyTasksRedirect({ searchParams }: Props) {
  const { household, tab } = await searchParams;
  const suffix = household ? `?household=${household}` : "";

  if (tab === "templates" || tab === "wizard") {
    redirect(`/app/taches/routines${suffix}${tab === "wizard" ? `${suffix ? "&" : "?"}tab=wizard` : ""}`);
  }
  redirect(`/app/taches/aujourd-hui${suffix}`);
}
