import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ household?: string }> };

export default async function TachesIndexPage({ searchParams }: Props) {
  const { household } = await searchParams;
  redirect(`/app/taches/aujourd-hui${household ? `?household=${household}` : ""}`);
}
