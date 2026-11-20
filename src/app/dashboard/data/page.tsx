import { Suspense, type ReactNode } from "react";
import { DangerButton, SyncButton } from "@/components/data-actions";
import { HistoryImporter } from "@/components/history-importer";
import { PageTitle } from "@/components/page-title";
import { SectionHeader, Skeleton } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/format";
import { getHistoryStatus, type PlaySource } from "@/lib/history/queries";
import { getViewerTimeZone } from "@/lib/history/viewer";
import { deleteEverything, deleteImported, syncNow } from "./actions";

export const metadata = { title: "Your data" };

const SOURCE_INFO: Record<PlaySource, { label: string; detail: string }> = {
  extended: {
    label: "Extended streaming history",
    detail: "Imported from your Spotify export · lifetime, includes skips & shuffle",
  },
  account: {
    label: "Account data",
    detail: "Imported from your Spotify export · about one year",
  },
  api: {
    label: "Captured by this app",
    detail: "Saved from your recently played list each time you use the app",
  },
};

export default function DataPage() {
  return (
    <>
      <PageTitle eyebrow="Library & privacy" title="Your data">
        Spotify’s API only shows your last 50 plays. To analyze your full listening history, import
        the data export Spotify makes available to every user. Everything is stored in a local
        database on this computer.
      </PageTitle>

      <div className="space-y-16">
        <section className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <SectionHeader title="Get your export" />
            <ol className="space-y-4 text-sm text-ink-2">
              <Step n={1}>
                Open{" "}
                <a
                  href="https://www.spotify.com/account/privacy/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-accent"
                >
                  spotify.com/account/privacy
                </a>{" "}
                and scroll to <em>Download your data</em>.
              </Step>
              <Step n={2}>
                Tick <strong className="text-ink">Extended streaming history</strong> (your whole
                account history, richest detail). <em>Account data</em> covers only the last year but
                arrives faster.
              </Step>
              <Step n={3}>
                Confirm the email from Spotify. The download link arrives by email — about 5 days for
                account data, up to 30 days for extended history.
              </Step>
              <Step n={4}>Drop the downloaded zip here. Re-importing is safe; duplicates are skipped.</Step>
            </ol>
          </div>
          <div>
            <SectionHeader title="Import" />
            <HistoryImporter />
          </div>
        </section>

        <section>
          <SectionHeader
            title="What’s stored"
            description="Overlapping sources are reconciled automatically: an export takes precedence over plays the app captured for the same period, so nothing is counted twice."
          />
          <Suspense fallback={<Skeleton className="h-48 rounded-2xl" />}>
            <StoredData />
          </Suspense>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-display text-2xl text-ink">Privacy</h2>
            <ul className="mt-4 space-y-2 text-sm text-ink-2">
              <li>Stored: time played, duration, track, artist and album names, Spotify ids, and skip / shuffle / offline flags.</li>
              <li>Never stored: IP addresses, device and user-agent details, country, or your Spotify username from the export — these are stripped in your browser before upload.</li>
              <li>The database is a file on this computer (data/curator.db). Nothing is sent to third parties.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-danger/20 p-6">
            <h2 className="font-display text-2xl text-ink">Delete data</h2>
            <p className="mt-2 text-sm text-ink-2">
              This removes data from this app only — your Spotify account is not affected.
            </p>
            <div className="mt-5 space-y-4">
              <DangerButton
                action={deleteImported}
                label="Delete imported history"
                confirmLabel="Yes, delete imports"
              />
              <DangerButton
                action={deleteEverything}
                label="Delete everything"
                confirmLabel="Yes, delete all my data"
              />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line-strong font-mono text-xs text-ink-2">
        {n}
      </span>
      <span className="pt-0.5 leading-relaxed">{children}</span>
    </li>
  );
}

async function StoredData() {
  const [status, tz] = await Promise.all([getHistoryStatus(), getViewerTimeZone()]);
  const order: PlaySource[] = ["extended", "account", "api"];

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-surface text-left text-xs uppercase tracking-[0.12em] text-ink-3">
            <tr>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 text-right font-medium">Streams</th>
              <th className="px-5 py-3 font-medium">Covers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {order.map((source) => {
              const row = status.coverage.find((c) => c.source === source);
              return (
                <tr key={source}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-ink">{SOURCE_INFO[source].label}</p>
                    <p className="text-xs text-ink-3">{SOURCE_INFO[source].detail}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-mono tabular-nums text-ink">
                    {row ? formatNumber(row.plays) : "—"}
                  </td>
                  <td className="px-5 py-4 text-ink-2">
                    {row ? `${formatDate(row.first, tz)} – ${formatDate(row.last, tz)}` : "Not imported yet"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-ink-2">
        <p>
          {status.lastSyncAt
            ? `Last synced ${new Date(status.lastSyncAt).toLocaleString("en-US", {
                timeZone: tz,
                dateStyle: "medium",
                timeStyle: "short",
              })} · `
            : ""}
          Top-item snapshots on {status.snapshotDays} day{status.snapshotDays === 1 ? "" : "s"}
          {status.firstSnapshotOn ? ` since ${status.firstSnapshotOn}` : ""}
        </p>
        <SyncButton action={syncNow} />
      </div>
    </div>
  );
}
