/**
 * Response shapes of the admin API, as the backend returns them. Dates are ISO
 * strings. Keep these in step with backend/src (admin, reports, auth, events,
 * ngos, payments, attendance, posts, notifications).
 */

export type UserRole = "VOLUNTEER" | "ORGANIZER" | "ADMIN";

export type EventStatus =
  | "DRAFT"
  | "ACTIVE"
  | "CLOSED"
  | "FULL"
  | "COMPLETED"
  | "CANCELLED"
  | "FEATURED"
  | "SUSPENDED";

export type ApplicationStatus = "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WAITLISTED";
export type VerificationStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";
export type PaymentType = "DONATION" | "PREMIUM_SUBSCRIBER" | "FEATURED_EVENT_FEE";
export type ResolutionAction = "DISMISSED" | "ACTION_TAKEN" | "BANNED_TARGET";

/** GET /admin/stats — exact platform-wide counts. */
export interface AdminStats {
  generatedAt: string;
  users: { total: number; volunteers: number; organizers: number; admins: number; banned: number };
  events: { total: number; active: number; upcoming: number; suspended: number };
  ngos: { pending: number };
  reports: { open: number; resolved: number };
  payments: { pending: number; successful: number; revenue: number };
  attendance: { totalHours: number; completedSessions: number };
}

/** A person as shown in a report: age instead of date of birth. */
export interface ReportParty {
  id: string;
  fullName: string;
  email: string;
  userType: UserRole;
  isBanned: boolean;
  age: number | null;
  isMinor: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  fileUrl: string | null;
  isDeleted: boolean;
  createdAt: string;
}

/** GET /reports — one row of the moderation queue. */
export interface SafetyReport {
  id: string;
  targetType: "EVENT" | "USER";
  eventId: string | null;
  targetUserId: string | null;
  messageId: string | null;
  reporterId: string;
  category: string;
  reason: string;
  resolved: boolean;
  resolutionNote: string | null;
  resolutionAction: ResolutionAction | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  reporter: ReportParty;
  targetUser: ReportParty | null;
  event: {
    id: string;
    title: string;
    category: string;
    status: EventStatus;
    organizer: ReportParty;
  } | null;
  resolvedBy: { id: string; fullName: string } | null;
  message: ChatMessage | null;
  involvesMinor: boolean;
  /** Other reports (any status) about the same person or drive. */
  otherReportsAgainstTarget: number;
}

/** GET /reports/:id/context */
export interface ReportContext {
  reportId: string;
  reportedMessageId: string | null;
  reporter: { id: string; fullName: string };
  targetUser: { id: string; fullName: string };
  messages: ChatMessage[];
}

/** GET /auth/users — one row. */
export interface UserRow {
  id: string;
  email: string;
  phoneNumber: string | null;
  fullName: string;
  userType: UserRole;
  isBanned: boolean;
  createdAt: string;
  lastSeen: string;
  dateOfBirth: string | null;
  profile: { reputationScore: number; reputationLevel: string } | null;
  _count: { reportsAgainst: number };
}

export interface AdminActionRow {
  id: string;
  adminId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  admin: { id: string; fullName: string; email?: string } | null;
}

/** GET /admin/users/:id */
export interface UserDetail {
  id: string;
  email: string;
  phoneNumber: string | null;
  fullName: string;
  userType: UserRole;
  isBanned: boolean;
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
  dateOfBirth: string | null;
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  age: number | null;
  isMinor: boolean;
  profile: {
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    skills: string[];
    interests: string[];
    experienceLevel: string;
    reputationScore: number;
    reputationLevel: string;
    emergencyName: string | null;
    emergencyContact: string | null;
  } | null;
  ngoVerification: {
    ngoName: string;
    status: VerificationStatus;
    contactDetails: string;
    verifiedAt: string | null;
    createdAt: string;
  } | null;
  counts: {
    applications: Partial<Record<ApplicationStatus, number>>;
    sessionsCompleted: number;
    hoursLogged: number;
    openSessions: number;
    eventsCreated: number;
    reportsAgainstOpen: number;
    reportsAgainstTotal: number;
    reportsSubmitted: number;
    blockedBy: number;
    blocking: number;
    posts: number;
    comments: number;
  };
  recentApplications: {
    id: string;
    status: ApplicationStatus;
    createdAt: string;
    event: { id: string; title: string; status: EventStatus; startTime: string };
  }[];
  recentAttendance: {
    id: string;
    checkIn: string;
    checkOut: string | null;
    hoursLogged: number | null;
    event: { id: string; title: string };
  }[];
  reportsAgainst: {
    id: string;
    category: string;
    reason: string;
    resolved: boolean;
    resolutionAction: ResolutionAction | null;
    messageId: string | null;
    createdAt: string;
    reporter: { id: string; fullName: string };
  }[];
  recentEvents: { id: string; title: string; status: EventStatus; startTime: string }[];
  recentComments: {
    id: string;
    content: string;
    createdAt: string;
    post: { id: string; event: { id: string; title: string } };
  }[];
  adminHistory: AdminActionRow[];
}

/** GET /events/admin/all — one row. */
export interface AdminEvent {
  id: string;
  organizerId: string;
  title: string;
  description: string;
  category: string;
  bannerUrl: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean;
  startTime: string;
  endTime: string;
  volunteersNeeded: number;
  minAge: number;
  isPaid: boolean;
  compensationDetails: string | null;
  openPositions: string[];
  perks: string[];
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  organizer: { id: string; fullName: string; email?: string };
  isOrganizerVerified: boolean;
  applicationCount: number;
  attendanceCount: number;
  approvedCount: number;
  hoursLoggedTotal: number;
}

/** GET /applications/event/:eventId — contact details only once approved. */
export interface Applicant {
  id: string;
  eventId: string;
  volunteerId: string;
  roleRequested: string | null;
  message: string | null;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  volunteer: {
    id: string;
    fullName: string;
    email?: string;
    phoneNumber?: string | null;
    profile: { reputationScore?: number; reputationLevel?: string; skills?: string[] } | null;
  };
}

/** GET /ngos?status= — one verification request. */
export interface NgoVerification {
  id: string;
  ngoName: string;
  registrationDocs: string;
  contactDetails: string;
  identityProof: string;
  status: VerificationStatus;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: { email: string; phoneNumber: string | null; fullName: string };
}

/** GET /payments — one ledger row. */
export interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  type: PaymentType;
  status: PaymentStatus;
  txRef: string;
  userId: string | null;
  eventId: string | null;
  gatewayReference: string | null;
  createdAt: string;
  updatedAt: string;
  event: { title: string } | null;
  user: { fullName: string; email: string } | null;
}

/** GET /attendance/admin/all — one session. */
export interface AttendanceRow {
  id: string;
  eventId: string;
  volunteerId: string;
  checkIn: string;
  checkOut: string | null;
  verifiedByOrganizer: boolean;
  hoursLogged: number | null;
  createdAt: string;
  event: { id: string; title: string; category: string };
  volunteer: { id: string; fullName: string; email: string };
}

/** GET /admin/posts */
export interface PostRow {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  event: { id: string; title: string };
  organizer: { id: string; fullName: string; email: string };
  _count: { likes: number; comments: number };
}

/** GET /admin/comments */
export interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; fullName: string; email: string; isBanned: boolean };
  post: { id: string; imageUrl: string; caption: string | null; event: { id: string; title: string } };
}

/** GET /notifications/history */
export interface BroadcastRow {
  id: string;
  title: string;
  body: string;
  targetRole: "ALL" | UserRole;
  recipientCount: number;
  sentById: string | null;
  createdAt: string;
  sentBy: { fullName: string; email: string } | null;
}
