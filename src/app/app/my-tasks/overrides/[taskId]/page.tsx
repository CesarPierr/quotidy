import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ household?: string }>;
};

export default async function OverrideRedirect({ params, searchParams }: Props) {
  const { taskId } = await params;
  const { household } = await searchParams;
  redirect(`/app/taches/routines/overrides/${taskId}${household ? `?household=${household}` : ""}`);
}
