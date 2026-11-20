"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { unzip } from "fflate";
import {
  IMPORT_CHUNK_SIZE,
  classifyExportFile,
  parseExportFile,
  type ImportRecord,
  type ImportSource,
} from "@/lib/history/normalize";

/**
 * Import Spotify's "Download your data" export.
 *
 * Everything heavy happens here in the browser: the .zip is unpacked, the
 * streaming-history JSON files are found and parsed, and each stream is
 * reduced to the fields we use. IP addresses, user agents and other personal
 * fields in the export never leave your computer. Records are then uploaded in
 * chunks so progress can be shown and no single request is large.
 */

type FileSummary = { name: string; source: ImportSource; streams: number };

type State =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "uploading"; files: FileSummary[]; total: number; sent: number; inserted: number }
  | { phase: "done"; files: FileSummary[]; total: number; inserted: number; rejected: number }
  | { phase: "error"; message: string };

const SOURCE_LABEL: Record<ImportSource, string> = {
  extended: "Extended streaming history",
  account: "Account data (past year)",
};

function unzipAsync(data: Uint8Array) {
  return new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, { filter: (f) => classifyExportFile(f.name) !== null }, (err, files) =>
      err ? reject(err) : resolve(files),
    ),
  );
}

/** Fall back to sniffing the content when a file was renamed. */
function detectSource(name: string, json: unknown): ImportSource | null {
  const byName = classifyExportFile(name);
  if (byName) return byName;
  const first = Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined) : undefined;
  if (first && "ts" in first && "ms_played" in first) return "extended";
  if (first && "endTime" in first && "msPlayed" in first) return "account";
  return null;
}

async function readExport(selected: File[]) {
  const decoder = new TextDecoder();
  const files: { name: string; text: string }[] = [];
  for (const file of selected) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const entries = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
      for (const [name, bytes] of Object.entries(entries)) files.push({ name, text: decoder.decode(bytes) });
    } else {
      files.push({ name: file.name, text: await file.text() });
    }
  }

  const summaries: FileSummary[] = [];
  const batches: { source: ImportSource; records: ImportRecord[] }[] = [];
  for (const { name, text } of files) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      continue; // not JSON — ignore
    }
    const source = detectSource(name, json);
    if (!source) continue;
    const records = parseExportFile(source, json);
    summaries.push({ name: name.split("/").pop() ?? name, source, streams: records.length });
    batches.push({ source, records });
  }
  return { summaries, batches };
}

export function HistoryImporter() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const busy = state.phase === "reading" || state.phase === "uploading";

  async function handleFiles(list: FileList | null) {
    const selected = Array.from(list ?? []);
    if (selected.length === 0 || busy) return;
    setState({ phase: "reading" });

    try {
      const { summaries, batches } = await readExport(selected);
      if (summaries.length === 0) {
        setState({
          phase: "error",
          message:
            "No Spotify streaming history found. Choose the my_spotify_data.zip from Spotify, or the StreamingHistory / Streaming_History_Audio JSON files inside it.",
        });
        return;
      }

      const total = batches.reduce((n, b) => n + b.records.length, 0);
      let sent = 0;
      let inserted = 0;
      let rejected = 0;
      setState({ phase: "uploading", files: summaries, total, sent, inserted });

      for (const { source, records } of batches) {
        for (let i = 0; i < records.length; i += IMPORT_CHUNK_SIZE) {
          const chunk = records.slice(i, i + IMPORT_CHUNK_SIZE);
          const res = await fetch("/api/history/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, records: chunk }),
          });
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(err.error ?? `Upload failed (${res.status})`);
          }
          const result = (await res.json()) as { inserted: number; rejected: number };
          sent += chunk.length;
          inserted += result.inserted;
          rejected += result.rejected;
          setState({ phase: "uploading", files: summaries, total, sent, inserted });
        }
      }

      setState({ phase: "done", files: summaries, total, inserted, rejected });
      router.refresh();
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof Error ? error.message : "Import failed. Please try again.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? "border-accent bg-accent-soft" : "border-line-strong hover:border-ink-3"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-display text-2xl text-ink">Drop your Spotify export here</span>
        <span className="text-sm text-ink-2">
          my_spotify_data.zip, or the streaming-history .json files — processed in your browser
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          className="sr-only"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {state.phase === "reading" && <p className="text-sm text-ink-2">Reading your export…</p>}

      {(state.phase === "uploading" || state.phase === "done") && (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <ul className="space-y-1 text-sm text-ink-2">
            {state.files.map((f) => (
              <li key={f.name} className="flex justify-between gap-4">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-ink-3">
                  {SOURCE_LABEL[f.source]} · {f.streams.toLocaleString("en-US")} streams
                </span>
              </li>
            ))}
          </ul>
          {state.phase === "uploading" ? (
            <div className="mt-4">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${(state.sent / Math.max(state.total, 1)) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-ink-3">
                Uploaded {state.sent.toLocaleString("en-US")} of {state.total.toLocaleString("en-US")}
              </p>
            </div>
          ) : (
            <p role="status" className="mt-4 text-sm text-ink">
              Done — {state.inserted.toLocaleString("en-US")} new streams saved
              {state.total - state.inserted - state.rejected > 0 &&
                `, ${(state.total - state.inserted - state.rejected).toLocaleString("en-US")} already imported`}
              {state.rejected > 0 && `, ${state.rejected.toLocaleString("en-US")} invalid rows skipped`}.
            </p>
          )}
        </div>
      )}

      {state.phase === "error" && (
        <p role="alert" className="rounded-2xl border border-danger/25 bg-danger/[0.06] px-5 py-4 text-sm text-ink-2">
          {state.message}
        </p>
      )}
    </div>
  );
}
