import { useQuery } from "@tanstack/react-query";

export interface PlanUsage {
  planName: string;
  limits: Record<string, number>;
  usage: Record<string, number>;
}

async function fetchMyUsage(): Promise<PlanUsage> {
  const r = await fetch("/api/commerce/my", { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch usage");
  const data = await r.json();
  return {
    planName: data.subscription?.planName ?? "free",
    limits: data.limits ?? {},
    usage: data.usage ?? {},
  };
}

export function usePlanLimits() {
  const { data, isLoading, refetch } = useQuery<PlanUsage>({
    queryKey: ["plan-limits"],
    queryFn: fetchMyUsage,
    staleTime: 60_000,
    retry: false,
  });

  function isAtLimit(resource: string): boolean {
    if (!data) return false;
    const limit = data.limits[resource];
    const used = data.usage[resource] ?? 0;
    return limit !== undefined && used >= limit;
  }

  function getUsagePercent(resource: string): number {
    if (!data) return 0;
    const limit = data.limits[resource];
    const used = data.usage[resource] ?? 0;
    if (!limit || limit === 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  function getRemaining(resource: string): number {
    if (!data) return 999;
    const limit = data.limits[resource];
    const used = data.usage[resource] ?? 0;
    if (limit === undefined) return 999;
    return Math.max(0, limit - used);
  }

  return {
    planUsage: data,
    isLoading,
    refetch,
    isAtLimit,
    getUsagePercent,
    getRemaining,
    planName: data?.planName ?? "free",
  };
}
