import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { readJSON } from "./storage";

export const ADMIN_TOKEN_KEY = "evac:admin";

/** The admin session token when this device is logged in as admin, otherwise undefined. */
export function useAdminToken(): string | undefined {
  const token = readJSON<string>(ADMIN_TOKEN_KEY, "");
  const ok = useQuery(api.admin.me, token ? { token } : "skip");
  return ok ? token : undefined;
}
