import { redirect } from "next/navigation";

type FoyerPageProps = {
  searchParams: Promise<{ household?: string }>;
};

/**
 * The Foyer view is now handled client-side in the main dashboard page
 * via the Moi/Foyer toggle. This route redirects for backward compatibility
 * (bookmarks, shared links).
 */
export default async function FoyerPage({ searchParams }: FoyerPageProps) {
  const params = await searchParams;
  const suffix = params.household ? `?household=${params.household}&view=foyer` : "?view=foyer";
  redirect(`/app${suffix}`);
}
