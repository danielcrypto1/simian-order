import { redirect } from "next/navigation";

/**
 * /backroom — legacy entry surface.
 *
 * The passphrase + wallet flow has been replaced with auto-claim at
 * /void/deep. Anyone landing here (old bookmarks, shared links from
 * the previous flow) is sent through the void instead.
 */
export default function BackroomPage(): never {
  redirect("/void");
}
