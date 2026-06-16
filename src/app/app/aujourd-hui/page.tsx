import { redirect } from "next/navigation";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function RedirectStub({ searchParams }: Props) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v) qs.set(k, String(v));
  const q = qs.toString();
  redirect(`/app/taches/aujourd-hui${q ? `?${q}` : ""}`);
}
