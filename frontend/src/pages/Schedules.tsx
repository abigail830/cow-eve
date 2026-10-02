import { Navigate } from "react-router-dom";

/** Legacy route — schedules live inside omni chat content area. */
export function SchedulesPage() {
  return (
    <Navigate to="/agents/omni?view=customize&tab=schedules" replace />
  );
}
