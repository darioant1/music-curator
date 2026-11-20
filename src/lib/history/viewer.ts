import "server-only";
import { cookies } from "next/headers";
import { TZ_COOKIE, resolveTimeZone } from "./time";

/** The viewer's IANA time zone (from the mmc_tz cookie), or UTC until the browser reports it. */
export async function getViewerTimeZone(): Promise<string> {
  return resolveTimeZone((await cookies()).get(TZ_COOKIE)?.value);
}
