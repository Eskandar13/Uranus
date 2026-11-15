import { notFound } from "next/navigation";

/**
 * Catch-all for URLs that match no route. Calling notFound() here makes Next
 * render app/[lang]/not-found.tsx inside the [lang] root layout (correct
 * <html lang dir>, app styling) instead of the plain built-in English 404.
 * Params are deliberately not read.
 */
export default function MissingPage() {
  notFound();
}
