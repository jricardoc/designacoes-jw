import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { qk } from "@/api/queryKeys";
import type { Territorio } from "@/api/types";

export function useTerritorios() {
  return useQuery({
    queryKey: qk.territorios,
    queryFn: () => apiRequest<{ territorios: Territorio[] }>("/territorios"),
    // Os cartões só mudam com re-extração + deploy; não precisa reconsultar a
    // cada abertura da tela.
    staleTime: 30 * 60_000,
  });
}
