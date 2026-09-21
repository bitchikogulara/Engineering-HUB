"use client";

export function ThemeToggle() {
  function toggle() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("eh-theme", next);
    } catch {
      // private mode — theme just won't persist
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme"
      className="rounded-md border border-border px-2.5 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
    >
      ☾ / ☀
    </button>
  );
}
