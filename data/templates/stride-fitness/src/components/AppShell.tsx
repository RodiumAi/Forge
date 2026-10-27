import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";

type Props = { onboarded: boolean; top: ReactNode; bottom: ReactNode };

/** Layout route: top bar, the current screen (<Outlet />), then the tab bar.
 *  Sends first-time visitors to /onboarding until they finish it. */
export default function AppShell({ onboarded, top, bottom }: Props) {
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return (
    <div className="app-shell">
      {top}
      <Outlet />
      {bottom}
    </div>
  );
}
