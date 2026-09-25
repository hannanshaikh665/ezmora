import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LockKeyhole } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandStrap } from "@/components/Brand";
import { DropletField } from "@/components/DropletField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { bootstrapOwner, ownerExists } from "@/lib/team.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ezmora Realty CRM — Sign in" },
      {
        name: "description",
        content:
          "Secure sign in to the Ezmora Realty CRM. Owner-managed logins for sales employees and supervisors.",
      },
      { property: "og:title", content: "Ezmora Realty CRM — Sign in" },
      { property: "og:description", content: "Driven by Vision · Defined by Ezmora." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const checkOwner = useServerFn(ownerExists);
  const createOwner = useServerFn(bootstrapOwner);
  const ownerQuery = useQuery({ queryKey: ["owner-exists"], queryFn: () => checkOwner({}) });
  const needsOwner = ownerQuery.data?.exists === false;

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Welcome back to Ezmora Realty");
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setupOwner = useMutation({
    mutationFn: async () => {
      await createOwner({ data: { email, password, fullName } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Owner account created");
      void navigate({ to: "/dashboard", replace: true });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = signIn.isPending || setupOwner.isPending;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <DropletField />

      <div className="glass-panel rise w-full max-w-md overflow-hidden">
        <BrandStrap />

        <form
          className="space-y-4 p-6 sm:p-8"
          onSubmit={(event) => {
            event.preventDefault();
            if (needsOwner) setupOwner.mutate();
            else signIn.mutate();
          }}
        >
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              {needsOwner ? "Create the owner login" : "Sign in to your workspace"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {needsOwner
                ? "This one-time setup creates the master account that manages every other login."
                : "Logins are created and managed by the owner."}
            </p>
          </div>

          {needsOwner && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={80}
                required
                placeholder="Owner name"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Login ID (email)</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              required
              placeholder="you@ezmorarealty.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={needsOwner ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              required
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" className="press w-full" size="lg" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LockKeyhole className="size-4" />
            )}
            {needsOwner ? "Create owner account" : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs tracking-wide text-muted-foreground uppercase">
        Ezmora Realty · Sales, Operations &amp; Business Growth
      </p>
    </div>
  );
}
