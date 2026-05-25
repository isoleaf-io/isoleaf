import { useQuery } from "@tanstack/react-query";
import { getHealth } from "@/api/workspace";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 30_000,
    retry: false,
  });
}
