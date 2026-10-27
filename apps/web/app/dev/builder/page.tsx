import { notFound } from "next/navigation";

import { BuilderStates } from "./BuilderStates";

/**
 * Development only: the builder chat cards and stage in every state (empty,
 * generating, done, stopped on empty FRODI), driven by a recorded stream
 * replayed through the real reducer. Live generation needs a working gateway;
 * this page does not.
 */
export const dynamic = "force-dynamic";

export default function BuilderStatesPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BuilderStates />;
}
