import type { ReactNode } from "react";

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-10 animate-rise">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-3">{eyebrow}</p>
      <h1 className="mt-2 font-display text-5xl leading-none tracking-tight sm:text-6xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-sm text-ink-2">{children}</div>}
    </header>
  );
}
