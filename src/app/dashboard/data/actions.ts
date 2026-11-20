"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { runBackgroundSync } from "@/lib/history/capture";
import { deleteAllUserData, deleteImportedHistory } from "@/lib/history/store";

/**
 * Server Actions for the Data page. Each one re-reads the session itself:
 * a Server Action is a public endpoint, so it must authorize on every call.
 */

export type ActionState = { ok: boolean; message: string } | null;

async function requireUserId() {
  const session = await getSession();
  if (!session) redirect("/?error=signed_out");
  return session;
}

export async function syncNow(): Promise<ActionState> {
  const session = await requireUserId();
  try {
    const result = await runBackgroundSync(session.accessToken, session.userId, { force: true });
    refresh();
    return {
      ok: true,
      message:
        result.playsInserted > 0
          ? `Saved ${result.playsInserted} new play${result.playsInserted === 1 ? "" : "s"}.`
          : "Up to date — no new plays since the last sync.",
    };
  } catch (error) {
    console.error("[sync] manual sync failed:", error instanceof Error ? error.message : error);
    return { ok: false, message: "Couldn't reach Spotify. Try again in a moment." };
  }
}

export async function deleteImported(): Promise<ActionState> {
  const session = await requireUserId();
  deleteImportedHistory(session.userId);
  refresh();
  return { ok: true, message: "Imported history deleted. Plays captured by the app were kept." };
}

export async function deleteEverything(): Promise<ActionState> {
  const session = await requireUserId();
  deleteAllUserData(session.userId);
  refresh();
  return { ok: true, message: "All stored data for your account was deleted." };
}
