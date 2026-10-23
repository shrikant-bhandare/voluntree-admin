import type { ComponentType } from "react";
import type { ViewId } from "../components/shell/nav";
import OverviewView from "./OverviewView";
import ReportsView from "./ReportsView";
import NgosView from "./NgosView";
import PaymentsView from "./PaymentsView";
import DrivesView from "./DrivesView";
import PeopleView from "./PeopleView";
import HoursView from "./HoursView";
import FeedView from "./FeedView";
import BroadcastsView from "./BroadcastsView";
import AnalyticsView from "./AnalyticsView";
import AuditView from "./AuditView";
import SettingsView from "./SettingsView";

export const VIEWS: Record<ViewId, ComponentType> = {
  overview: OverviewView,
  reports: ReportsView,
  ngos: NgosView,
  payments: PaymentsView,
  drives: DrivesView,
  people: PeopleView,
  hours: HoursView,
  feed: FeedView,
  broadcasts: BroadcastsView,
  analytics: AnalyticsView,
  audit: AuditView,
  settings: SettingsView,
};
