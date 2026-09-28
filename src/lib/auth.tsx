import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./crm";

type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  branch: string | null;
  is_active: boolean;
  access_status: "active" | "locked" | "disabled" | "login_removed";
  last_active_at: string | null;
  last_login_at: string | null;
};

type AuthValue = {
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  roles: AppRole[];
  role: AppRole;
  isOwner: boolean;
  isManager: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  session: null,
  loading: true,
  profile: null,
  roles: [],
  role: "employee",
  isOwner: false,
  isManager: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;

  const { data } = useQuery({
    queryKey: ["me", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId!),
      ]);
      return {
        profile: (profileRes.data as Profile | null) ?? null,
        roles: (rolesRes.data ?? []).map((r) => r.role as AppRole),
      };
    },
  });

  useEffect(() => {
    if (!userId || !data?.profile || data.profile.access_status !== "active") return;
    void supabase
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", userId);
  }, [data?.profile, userId]);

  const roles = data?.roles ?? [];
  const role: AppRole = roles.includes("owner")
    ? "owner"
    : roles.includes("supervisor")
      ? "supervisor"
      : "employee";

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        profile: data?.profile ?? null,
        roles,
        role,
        isOwner: role === "owner",
        isManager: role === "owner" || role === "supervisor",
        signOut: async () => {
          await queryClient.cancelQueries();
          queryClient.clear();
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
