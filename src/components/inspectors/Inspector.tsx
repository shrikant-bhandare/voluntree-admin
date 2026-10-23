"use client";

import { useConsole } from "../shell/ConsoleContext";
import { UserDrawer } from "./UserDrawer";
import { EventDrawer } from "./EventDrawer";
import { ReportDrawer } from "./ReportDrawer";

/**
 * One drawer at a time, opened from anywhere via useConsole(): openUser(id),
 * openEvent(id, row?), openReport(report). Opening another record replaces
 * the current one, so a report can lead to the reported person and back.
 */
export function Inspector() {
  const { inspecting, closeInspector } = useConsole();
  if (!inspecting) return null;
  // Keyed by record so switching from one person/drive/report to another
  // starts the drawer fresh instead of carrying over its state.
  if (inspecting.kind === "user")
    return <UserDrawer key={`u-${inspecting.id}`} userId={inspecting.id} onClose={closeInspector} />;
  if (inspecting.kind === "event")
    return (
      <EventDrawer key={`e-${inspecting.id}`} eventId={inspecting.id} initial={inspecting.row} onClose={closeInspector} />
    );
  return <ReportDrawer key={`r-${inspecting.report.id}`} report={inspecting.report} onClose={closeInspector} />;
}
