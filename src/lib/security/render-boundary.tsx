import "server-only";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { SystemState } from "@/components/system/system-state";
import { requestId, logFailure } from "./request-id";

/** Catch database work before Next receives credential-bearing exceptions. */
export function safePage<P>(render: (props: P) => Promise<ReactNode>) {
  return async function SafePage(props: P) {
    const id = requestId((await headers()).get("x-request-id"));
    try {
      return await render(props);
    } catch (error) {
      unstable_rethrow(error);
      logFailure({ requestId: id, code: "RENDER_UNAVAILABLE", status: 503 });
      return <SystemState kind="unexpected" reference={id} reload />;
    }
  };
}
