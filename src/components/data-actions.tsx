"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/dashboard/data/actions";

type Action = () => Promise<ActionState>;

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-ink-2" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

export function SyncButton({ action }: { action: Action }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-full border border-line-strong px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-2 disabled:opacity-50"
      >
        {pending ? "Syncing…" : "Sync recent plays now"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/** Destructive action with an inline two-step confirmation (no browser dialogs). */
export function DangerButton({
  action,
  label,
  confirmLabel,
}: {
  action: Action;
  label: string;
  confirmLabel: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  const [armed, setArmed] = useState(false);

  return (
    <div className="space-y-2">
      {armed ? (
        <form action={run} className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50"
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="rounded-full px-4 py-2 text-sm text-ink-2 hover:text-ink"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="rounded-full border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
        >
          {label}
        </button>
      )}
      <Feedback state={state} />
    </div>
  );
}
