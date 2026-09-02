export type TabType =
  | "dashboard"
  | "analytics"
  | "ngos"
  | "events"
  | "moderation"
  | "payments"
  | "users"
  | "broadcast"
  | "attendance"
  | "settings";

export interface NGO {
  id: string;
  name: string;
  /** Account holder submitting on behalf of the organization. */
  contactName: string;
  email: string;
  phone: string;
  /** Free-text contact details supplied with the request (not a registration number). */
  contactDetails: string;
  /** Private-bucket URL of the registration certificate. */
  registrationDocs: string;
  /** Private-bucket URL of the identity proof. Both must be reviewed before approval. */
  identityProof: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
}

/** Mirrors the Prisma EventStatus enum. */
export type EventStatusValue =
  | "DRAFT"
  | "ACTIVE"
  | "CLOSED"
  | "FULL"
  | "COMPLETED"
  | "CANCELLED"
  | "FEATURED"
  | "SUSPENDED";

export interface EventItem {
  id: string;
  name: string;
  description?: string;
  organizer: string;
  organizerId?: string;
  organizerEmail?: string;
  isOrganizerVerified?: boolean;
  category: string;
  location: string;
  /** Every application regardless of status. */
  volunteersApplied: number;
  /** Applications in APPROVED status — what actually fills a slot. */
  approvedCount: number;
  volunteersNeeded: number;
  minAge?: number;
  isPaid?: boolean;
  compensationDetails?: string;
  startTime?: string;
  endTime?: string;
  status: EventStatusValue;
  openPositions?: string[];
  perks?: string[];
  bannerUrl?: string;
  applications?: any[];
  /** undefined = not loaded yet; a string = the load failed. */
  applicationsError?: string;
  attendanceLog?: any[];
  reports?: any[];
  reportsCount?: number;
  /** Sum of hoursLogged over completed sessions, from the API. */
  hoursLoggedTotal?: number;
  attendanceCount?: number;
}

export interface SafetyReport {
  id: string;
  eventId: string;
  eventName: string;
  /** Free-form on the backend (CreateReportDto only bounds the length). */
  category: string;
  reporter: string;
  reason: string;
  resolved: boolean;
  date: string;
}

export interface PaymentTransaction {
  id: string;
  donor: string;
  type: "DONATION" | "PREMIUM_SUBSCRIBER" | "FEATURED_EVENT_FEE";
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  txRef: string;
  date: string;
  eventName?: string;
}

export interface PlatformUser {
  id: string;
  email: string;
  phoneNumber?: string;
  fullName: string;
  userType: "VOLUNTEER" | "ORGANIZER" | "ADMIN";
  isBanned: boolean;
  createdAt: string;
  profile?: any;
}

export interface AttendanceLog {
  id: string;
  checkIn: string;
  checkOut?: string;
  hoursLogged?: number;
  verifiedByOrganizer: boolean;
  event?: {
    id: string;
    title: string;
    category: string;
  };
  volunteer?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface BroadcastNotification {
  id?: string;
  title: string;
  body: string;
  targetRole?: string;
  recipientCount?: number;
  createdAt: string;
  /** Acting admin, as returned by GET /notifications/history. */
  sentBy?: {
    fullName: string;
    email?: string;
  };
}

/** Exact platform-wide counts from GET /admin/stats. */
export interface AdminStats {
  generatedAt: string;
  users: {
    total: number;
    volunteers: number;
    organizers: number;
    admins: number;
    banned: number;
  };
  events: {
    total: number;
    active: number;
    upcoming: number;
    suspended: number;
  };
  ngos: { pending: number };
  reports: { open: number; resolved: number };
  payments: { pending: number; successful: number; revenue: number };
  attendance: { totalHours: number; completedSessions: number };
}

/** Page size the dashboard requests; lists longer than this are truncated. */
export const LIST_PAGE_SIZE = 100;
