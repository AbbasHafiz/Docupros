/** Client-side document routes (query params) — works with static export hosts. */

export function documentHref(
  id: string,
  view?: "edit" | "form" | "pdf-form",
  pageId?: string,
): string {
  const path = view ? `/document/${view}` : "/document";
  const q = new URLSearchParams({ id });
  if (pageId) q.set("page", pageId);
  return `${path}?${q.toString()}`;
}
