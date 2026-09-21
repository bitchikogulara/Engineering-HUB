"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";

export function SignInForm({ githubEnabled }: { githubEnabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Sign-in failed");
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 font-medium text-card-foreground text-sm">Sign in</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-muted-foreground text-xs">
            Email
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-muted-foreground text-xs">
            Password
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {error && <p className="text-destructive text-xs">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      {githubEnabled && (
        <>
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-muted-foreground text-xs">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            onClick={() =>
              signIn.social({ provider: "github", callbackURL: "/dashboard" })
            }
            className="w-full rounded-md border border-border bg-secondary py-2 font-medium text-secondary-foreground text-sm hover:bg-accent"
          >
            Continue with GitHub
          </button>
        </>
      )}
      <p className="mt-4 text-muted-foreground text-xs">
        Invite-only. Ask an admin for an invitation link.
      </p>
    </div>
  );
}
