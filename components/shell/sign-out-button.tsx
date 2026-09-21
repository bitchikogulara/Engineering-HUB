"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/sign-in");
        router.refresh();
      }}
      className="rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
    >
      Sign out
    </button>
  );
}
