import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from "@/lib/auth-domain";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In | Merchant Risk Engine" },
      {
        name: "description",
        content:
          "Trustap staff sign-in for the merchant onboarding risk assessment console. Access is restricted to @trustap.com accounts.",
      },
      { property: "og:title", content: "Staff Sign In | Merchant Risk Engine" },
      {
        property: "og:description",
        content: "Restricted access — Trustap employees only.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { denied?: string } =>
    typeof s['denied'] === "string" ? { denied: s['denied'] } : {},

  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (denied) toast.error(`Access is restricted to @${ALLOWED_EMAIL_DOMAIN} accounts.`);
  }, [denied]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user.email ?? "";
      if (e && isAllowedEmail(e)) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowedEmail(email)) {
      toast.error(`Only @${ALLOWED_EMAIL_DOMAIN} email addresses are permitted.`);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created — check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        if (!isAllowedEmail(data.user?.email ?? "")) {
          await supabase.auth.signOut();
          toast.error(`Access is restricted to @${ALLOWED_EMAIL_DOMAIN} accounts.`);
          return;
        }
        navigate({ to: "/", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="panel w-full max-w-md p-8">
        <p className="label-caps flex items-center gap-2">
          <ShieldCheck className="size-3.5 text-primary" /> Restricted console
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {mode === "signin" ? "Staff sign in" : "Create staff account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trustap employees only. Access requires an @{ALLOWED_EMAIL_DOMAIN} email address.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="label-caps">Work email</Label>
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="label-caps">Password</Label>
            <Input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "No account yet? Register with your work email"
            : "Already registered? Sign in"}
        </button>
      </div>
    </main>
  );
}
