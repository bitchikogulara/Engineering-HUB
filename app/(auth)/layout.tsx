export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground">
            E
          </div>
          <div>
            <h1 className="font-semibold text-foreground leading-tight">
              Engineering Hub
            </h1>
            <p className="text-muted-foreground text-xs">Transporter Group</p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
