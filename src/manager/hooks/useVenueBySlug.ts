import { useMemo } from "react";
import { useManagerScope, ManagerVenue } from "./useManagerScope";
import { slugify } from "@/manager/utils/slug";

export function useVenueBySlug(slug: string | undefined): {
  venue: ManagerVenue | null;
  isLoading: boolean;
  notFound: boolean;
  scope: ReturnType<typeof useManagerScope>;
} {
  const scope = useManagerScope();
  const venue = useMemo(() => {
    if (!slug) return null;
    const target = slug.toLowerCase();
    return scope.venues.find((v) => slugify(v.name) === target) ?? null;
  }, [slug, scope.venues]);

  return {
    venue,
    isLoading: scope.isLoading,
    notFound: !scope.isLoading && !venue,
    scope,
  };
}
