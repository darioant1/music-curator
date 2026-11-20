import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "./session";

/**
 * The signed-in user for this request, or a redirect to the landing page.
 *
 * Every Data Access Layer function (Spotify and database alike) starts here,
 * so callers can never ask for another user's data. `cache()` makes repeated
 * calls within one request free.
 */
export const requireSession = cache(async (): Promise<{ token: string; userId: string }> => {
  const session = await getSession();
  if (!session) redirect("/?error=signed_out");
  return { token: session.accessToken, userId: session.userId };
});
