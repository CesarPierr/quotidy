/**
 * Client-side POST helper for fetch-based mutations that need the JSON response
 * back (to update local state) rather than a navigation. Attaches the CSRF
 * double-submit token and the `x-requested-with: fetch` marker, exactly like
 * `useFormAction` does. Throws on a non-2xx response.
 *
 * Use this for live local-state surfaces (notes board, checklist editor) where
 * `useFormAction`'s router.refresh()/redirect behaviour would be disruptive.
 */
export async function postForm(
  url: string,
  data: FormData | Record<string, string>,
): Promise<Response> {
  const body = data instanceof FormData ? data : new URLSearchParams(data);
  const headers: Record<string, string> = { "x-requested-with": "fetch" };
  if (!(data instanceof FormData)) {
    headers["content-type"] = "application/x-www-form-urlencoded";
  }
  const csrf = document.cookie.match(/(?:^|;\s*)__csrf=([^;]+)/)?.[1];
  if (csrf) headers["x-csrf-token"] = csrf;

  const response = await fetch(url, { method: "POST", body, headers });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response;
}
