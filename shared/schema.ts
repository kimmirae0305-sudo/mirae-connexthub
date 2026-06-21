import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, serial, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (Admin, PM, RA, Finance roles - internal employees only)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("pm"), // admin, pm, ra, finance
  signatureName: text("signature_name"),
  jobTitle: text("job_title"),
  mobilePhone: text("mobile_phone"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userEmailConnections = pgTable("user_email_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("zoho_mail"),
  providerEmail: text("provider_email"),
  providerAccountId: text("provider_account_id"),
  providerUserId: text("provider_user_id"),
  providerOrgId: text("provider_org_id"),
  encryptedRefreshToken: text("encrypted_refresh_token"),
  encryptedAccessToken: text("encrypted_access_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  scopes: text("scopes"),
  status: text("status").notNull().default("disconnected"),
  lastConnectedAt: timestamp("last_connected_at"),
  lastValidatedAt: timestamp("last_validated_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailOauthStates = pgTable("email_oauth_states", {
  id: serial("id").primaryKey(),
  state: text("state").notNull().unique(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull().default("zoho_mail"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  templateType: text("template_type").notNull(),
  language: text("language").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: integer("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clients table (Internal CRM - managed by employees)
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  country: text("country"),
  region: text("region"),
  industry: text("industry"),
  mainContactName: text("main_contact_name"),
  mainContactEmail: text("main_contact_email"),
  mainContactPhone: text("main_contact_phone"),
  notes: text("notes"),
  status: text("status").notNull().default("prospect"), // active, inactive, prospect
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Client Organizations table
export const clientOrganizations = pgTable("client_organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  clientType: text("client_type"),
  legalEntityName: text("legal_entity_name"),
  contractType: text("contract_type"),
  pricingModel: text("pricing_model"),
  currency: text("currency").default("USD"),
  defaultCuRate: decimal("default_cu_rate", { precision: 10, scale: 2 }),
  purchasedCu: decimal("purchased_cu", { precision: 10, scale: 2 }),
  retainerCuAllowance: decimal("retainer_cu_allowance", { precision: 10, scale: 2 }),
  retainerPeriod: text("retainer_period"),
  contractedCu: decimal("contracted_cu", { precision: 10, scale: 2 }),
  paymentTerms: text("payment_terms"),
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  creditBalance: decimal("credit_balance", { precision: 10, scale: 2 }),
  retainerBalance: decimal("retainer_balance", { precision: 10, scale: 2 }),
  commercialNotes: text("commercial_notes"),
  billingAddress: text("billing_address"),
  mainPmId: integer("main_pm_id").references(() => users.id),
  totalCuUsed: decimal("total_cu_used", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Client POCs (Points of Contact)
export const clientPocs = pgTable("client_pocs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => clientOrganizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  jobTitle: text("job_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Companies referenced by expert work history (reviewed internally after onboarding)
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  legalName: text("legal_name"),
  officialWebsite: text("official_website"),
  linkedinUrl: text("linkedin_url"),
  country: text("country").notNull(),
  companyType: text("company_type").notNull(),
  industry: text("industry"),
  city: text("city"),
  description: text("description"),
  ownershipNotes: text("ownership_notes"),
  notes: text("notes"),
  status: text("status").notNull().default("active"), // active, restricted, dnc, archived
  dncStatus: text("dnc_status").notNull().default("none"), // none, do_not_contact, consent_required, legal_hold
  verificationStatus: text("verification_status").notNull().default("unverified"), // unverified, verified, needs_review
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyAliases = pgTable("company_aliases", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  normalizedAlias: text("normalized_alias").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Projects table (Extended)
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectOverview: text("project_overview"),
  externalAdvisorBrief: text("external_advisor_brief"),
  clientOrganizationId: integer("client_organization_id").references(() => clientOrganizations.id),
  clientName: text("client_name").notNull(),
  clientCompany: text("client_company"),
  clientPocName: text("client_poc_name"),
  clientPocEmail: text("client_poc_email"),
  clientRequestNotes: text("client_request_notes"), // Free-text notes summarizing original email request
  description: text("description"),
  industry: text("industry").notNull(),
  region: text("region"),
  status: text("status").notNull().default("new"), // new, sourcing, shortlisted, confirmed, completed, cancelled
  budget: decimal("budget", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  dueDate: timestamp("due_date"),
  createdByPmId: integer("created_by_pm_id").references(() => users.id),
  assignedRaId: integer("assigned_ra_id").references(() => users.id), // Legacy single RA
  assignedRaIds: integer("assigned_ra_ids").array(), // Multiple RAs for sourcing
  totalCuUsed: decimal("total_cu_used", { precision: 10, scale: 2 }).default("0"),
  cuRatePerCU: decimal("cu_rate_per_cu", { precision: 10, scale: 2 }).default("1150"), // USD 1,150 default
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Experts table (Extended)
export const experts = pgTable("experts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  country: text("country"),
  city: text("city"), // City for geographic filtering
  timezone: text("timezone"),
  whatsapp: text("whatsapp"),
  expertise: text("expertise").notNull(),
  sectorExpertise: text("sector_expertise"),
  regionalExpertise: text("regional_expertise"),
  areasOfExpertise: text("areas_of_expertise").array(),
  industry: text("industry").notNull(),
  company: text("company"), // Current employer
  pastEmployers: text("past_employers").array(), // List of past employer names
  jobTitle: text("job_title"),
  yearsOfExperience: integer("years_of_experience").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  bio: text("bio"),
  workHistory: jsonb("work_history").$type<Array<{
    company: string;
    rawCompanyName?: string;
    companyId?: number | null;
    companyLinkStatus?: "pending_review" | "suggested" | "linked" | "unclear" | "ignored";
    reviewedBy?: number | null;
    reviewedAt?: string | null;
    jobTitle: string;
    fromMonth?: number;
    fromYear: number;
    toMonth?: number;
    toYear?: number;
    isCurrent?: boolean;
  }>>(), // Work history entries
  biography: text("biography"), // Detailed biography for RA review/editing
  status: text("status").notNull().default("available"), // available, busy, inactive
  availableNow: boolean("available_now").default(true), // Whether expert is currently available
  nextAvailableDate: timestamp("next_available_date"), // When expert becomes available next
  totalHoursWorked: decimal("total_hours_worked", { precision: 10, scale: 2 }).default("0"), // Total hours in past projects
  recruitedBy: text("recruited_by"),
  sourcedByRaId: integer("sourced_by_ra_id").references(() => users.id),
  sourcedAt: timestamp("sourced_at"),
  termsAccepted: boolean("terms_accepted").default(false),
  lgpdAccepted: boolean("lgpd_accepted").default(false),
  billingInfo: text("billing_info"),
  languages: text("languages").array(), // Languages spoken by expert (e.g., ["en", "pt", "es"])
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project Angles table (groups of vetting questions per project)
export const projectAngles = pgTable("project_angles", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Vetting Questions table (linked to Angles)
export const vettingQuestions = pgTable("vetting_questions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  angleId: integer("angle_id").references(() => projectAngles.id, { onDelete: "cascade" }), // Optional: null = project-level, set = angle-specific
  question: text("question").notNull(),
  questionType: text("question_type").notNull().default("text"), // text, yes_no, scale
  orderIndex: integer("order_index").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project-Expert Assignments table (Extended with invitation flow and angle support)
export const projectExperts = pgTable("project_experts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "cascade" }),
  angleIds: integer("angle_ids").array(), // Array of angle IDs this expert is relevant for
  status: text("status").notNull().default("assigned"), // assigned, invited, accepted, declined, client_selected, scheduled, completed
  invitationStatus: text("invitation_status").notNull().default("not_invited"), // not_invited, invited, opened, accepted, declined
  pipelineStatus: text("pipeline_status").notNull().default("interested"), // interested, shortlisted, accepted, declined, completed
  sourceType: text("source_type").notNull().default("internal_db"), // internal_db, ra_external
  sourcedByRaId: integer("sourced_by_ra_id").references(() => users.id), // RA who sourced this expert for this project
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  invitedAt: timestamp("invited_at"),
  openedAt: timestamp("opened_at"), // When expert opened the invite link
  respondedAt: timestamp("responded_at"),
  invitationToken: text("invitation_token").unique(),
  vqAnswers: jsonb("vq_answers").$type<{ questionId: number; questionText: string; answerText: string }[]>(),
  availabilityNote: text("availability_note"),
  availabilitySlots: jsonb("availability_slots").$type<{ date: string; startTime: string; endTime: string; timezone: string }[]>(), // Structured time slots for consultations
  expectedHourlyRateUsd: decimal("expected_hourly_rate_usd", { precision: 10, scale: 2 }),
  termsAccepted: boolean("terms_accepted").default(false),
  lgpdAccepted: boolean("lgpd_accepted").default(false),
  acceptedAt: timestamp("accepted_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  consentLanguage: text("consent_language"),
  termsVersion: text("terms_version"),
  privacyPolicyVersion: text("privacy_policy_version"),
  conflictCheck: text("conflict_check"),
  applicationStatus: text("application_status").notNull().default("pending_review"),
  notes: text("notes"),
  lastActivityAt: timestamp("last_activity_at"),
});

// Call Records table (CU Usage with scheduling)
export const callRecords = pgTable("call_records", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "cascade" }),
  projectExpertId: integer("project_expert_id").references(() => projectExperts.id),
  pmId: integer("pm_id").references(() => users.id),
  raId: integer("ra_id").references(() => users.id),
  callDate: timestamp("call_date").notNull(),
  scheduledStartTime: timestamp("scheduled_start_time"),
  scheduledEndTime: timestamp("scheduled_end_time"),
  timezone: text("timezone"),
  actualDurationMinutes: integer("actual_duration_minutes"),
  durationMinutes: integer("duration_minutes").notNull(),
  cuUsed: decimal("cu_used", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, scheduled, completed, cancelled, no_show
  completedAt: timestamp("completed_at"),
  zoomLink: text("zoom_link"),
  recordingUrl: text("recording_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insight Hub table (structured market signals from consultations)
export const insights = pgTable("insights", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  consultationId: text("consultation_id").notNull(),
  callRecordId: integer("call_record_id").references(() => callRecords.id, { onDelete: "set null" }),
  month: text("month").notNull(),
  callDate: timestamp("call_date").notNull(),
  clientType: text("client_type").notNull(),
  industry: text("industry").notNull(),
  market: text("market").notNull(),
  geography: text("geography").notNull(),
  clientQuestion: text("client_question").notNull(),
  observedTrend: text("observed_trend").notNull(),
  keyTags: text("key_tags").array(),
  signalStrength: text("signal_strength").notNull(),
  companyMentioned: text("company_mentioned"),
  expertSeniority: text("expert_seniority"),
  callDurationMin: integer("call_duration_min"),
  recordingLink: text("recording_link"),
  transcriptLink: text("transcript_link"),
  pmNotes: text("pm_notes"),
  insightTitle: text("insight_title"),
  coreObservation: text("core_observation"),
  evidenceSummary: text("evidence_summary"),
  businessImplication: text("business_implication"),
  signalType: text("signal_type"),
  confidenceLevel: text("confidence_level"),
  confidenceReason: text("confidence_reason"),
  recommendedFollowUpQuestions: text("recommended_follow_up_questions").array(),
  reportVisibility: text("report_visibility").default("internal"),
  reviewStatus: text("review_status").notNull().default("pm_reviewed"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  sourceType: text("source_type").notNull().default("manual"),
  generatedAt: timestamp("generated_at"),
  internalNotes: text("internal_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Expert Invitation Links table (Extended with types)
// Each invitation generates a UNIQUE token - tokens are never reused
export const expertInvitationLinks = pgTable("expert_invitation_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  raId: integer("ra_id").references(() => users.id), // RA user ID for RA-specific links
  expertId: integer("expert_id").references(() => experts.id), // For existing expert invites
  angleIds: integer("angle_ids").array(), // Angles this expert is being invited for
  inviteType: text("invite_type").notNull().default("general"), // general, ra, existing
  candidateName: text("candidate_name"), // Optional: Name of candidate invite was created for
  candidateEmail: text("candidate_email"), // Optional: Email of candidate invite was created for
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  recruitedBy: text("recruited_by").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Advisor Project Invitations table (internal draft/status foundation; no email sending yet)
export const advisorProjectInvitations = pgTable("advisor_project_invitations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token"),
  status: text("status").notNull().default("not_sent"), // not_sent, draft, sent, submitted, failed, expired
  sentAt: timestamp("sent_at"),
  submittedAt: timestamp("submitted_at"),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const advisorProjectResponses = pgTable("advisor_project_responses", {
  id: serial("id").primaryKey(),
  invitationId: integer("invitation_id").notNull().references(() => advisorProjectInvitations.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Array<{
    questionId: number;
    questionText: string;
    answer: string;
  }>>().notNull(),
  consentAccepted: boolean("consent_accepted").notNull().default(false),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const advisorProjectInvitationEmailSends = pgTable("advisor_project_invitation_email_sends", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  invitationId: integer("invitation_id").notNull().references(() => advisorProjectInvitations.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").references(() => experts.id, { onDelete: "set null" }),
  sentByUserId: integer("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  emailType: text("email_type").notNull().default("initial_invite"),
  provider: text("provider").notNull().default("zoho"),
  providerMessageId: text("provider_message_id"),
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project Activities table (for activity log)
export const projectActivities = pgTable("project_activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id),
  expertId: integer("expert_id").references(() => experts.id),
  activityType: text("activity_type").notNull(), // expert_assigned, expert_invited, expert_accepted, expert_declined, ra_assigned, status_changed, note_added
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Legacy usage records (keeping for backward compatibility)
export const usageRecords = pgTable("usage_records", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "cascade" }),
  callDate: timestamp("call_date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  creditsUsed: decimal("credits_used", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Billable Usage table (Finance review layer generated from completed call records)
export const billableUsage = pgTable("billable_usage", {
  id: serial("id").primaryKey(),
  callRecordId: integer("call_record_id").notNull().references(() => callRecords.id, { onDelete: "restrict" }).unique(),
  clientOrganizationId: integer("client_organization_id").references(() => clientOrganizations.id),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "restrict" }),
  callDate: timestamp("call_date").notNull(),
  cuUsed: decimal("cu_used", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  cuRate: decimal("cu_rate", { precision: 10, scale: 2 }),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("unbilled"), // unbilled, draft, invoiced, void
  source: text("source").notNull().default("completed_call_record"),
  adjustmentReason: text("adjustment_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const expertPayables = pgTable("expert_payables", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id").notNull().references(() => callRecords.id, { onDelete: "restrict" }).unique(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "restrict" }),
  clientOrganizationId: integer("client_organization_id").references(() => clientOrganizations.id, { onDelete: "set null" }),
  serviceDate: timestamp("service_date").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  expertHourlyRateSnapshot: decimal("expert_hourly_rate_snapshot", { precision: 10, scale: 2 }).notNull(),
  payoutCurrency: text("payout_currency").notNull().default("USD"),
  payableAmount: decimal("payable_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending_review"),
  approvedAt: timestamp("approved_at"),
  approvedByUserId: integer("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  paidAt: timestamp("paid_at"),
  paidByUserId: integer("paid_by_user_id").references(() => users.id, { onDelete: "set null" }),
  paymentMethod: text("payment_method"),
  paymentReferenceNumber: text("payment_reference_number"),
  paymentNotes: text("payment_notes"),
  voidedAt: timestamp("voided_at"),
  voidedByUserId: integer("voided_by_user_id").references(() => users.id, { onDelete: "set null" }),
  voidReason: text("void_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoices table (Finance invoice lifecycle)
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  draftNumber: text("draft_number").notNull().unique(),
  invoiceNumber: text("invoice_number").unique(),
  clientOrganizationId: integer("client_organization_id").notNull().references(() => clientOrganizations.id, { onDelete: "restrict" }),
  invoiceDate: timestamp("invoice_date").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  currency: text("currency").notNull().default("USD"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"), // draft, issued, sent, paid, canceled, void
  notes: text("notes"),
  issuedAt: timestamp("issued_at"),
  issuedByUserId: integer("issued_by_user_id").references(() => users.id),
  sentAt: timestamp("sent_at"),
  sentByUserId: integer("sent_by_user_id").references(() => users.id),
  sentMethod: text("sent_method"),
  sentRecipientEmail: text("sent_recipient_email"),
  sentNotes: text("sent_notes"),
  paidAt: timestamp("paid_at"),
  paidByUserId: integer("paid_by_user_id").references(() => users.id),
  paymentMethod: text("payment_method"),
  paymentReferenceNumber: text("payment_reference_number"),
  paymentNotes: text("payment_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Invoice line items table (one billable usage row can appear in one invoice only)
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  billableUsageId: integer("billable_usage_id").notNull().references(() => billableUsage.id, { onDelete: "restrict" }),
  description: text("description").notNull(),
  serviceDate: timestamp("service_date").notNull(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "restrict" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "restrict" }),
  cuUsed: decimal("cu_used", { precision: 10, scale: 2 }).notNull(),
  cuRate: decimal("cu_rate", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Expenses table (Finance operating expense tracking)
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  expenseId: text("expense_id").notNull().unique(),
  vendor: text("vendor").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  billingType: text("billing_type").notNull(),
  expenseDate: timestamp("expense_date").notNull(),
  renewalDate: timestamp("renewal_date"),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("Active"),
  ownerId: integer("owner_id").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  accountingStatus: text("accounting_status").notNull().default("Pending"),
  notes: text("notes"),
  receiptFileName: text("receipt_file_name"),
  receiptMimeType: text("receipt_mime_type"),
  receiptFileSize: integer("receipt_file_size"),
  receiptUploadedBy: integer("receipt_uploaded_by").references(() => users.id),
  receiptUploadedAt: timestamp("receipt_uploaded_at"),
  receiptData: text("receipt_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  managedOrganizations: many(clientOrganizations),
  createdProjects: many(projects, { relationName: "createdBy" }),
  assistedProjects: many(projects, { relationName: "assignedRa" }),
  emailConnections: many(userEmailConnections),
  emailOauthStates: many(emailOauthStates),
}));

export const userEmailConnectionsRelations = relations(userEmailConnections, ({ one }) => ({
  user: one(users, {
    fields: [userEmailConnections.userId],
    references: [users.id],
  }),
}));

export const emailOauthStatesRelations = relations(emailOauthStates, ({ one }) => ({
  user: one(users, {
    fields: [emailOauthStates.userId],
    references: [users.id],
  }),
}));

export const clientOrganizationsRelations = relations(clientOrganizations, ({ one, many }) => ({
  mainPm: one(users, {
    fields: [clientOrganizations.mainPmId],
    references: [users.id],
  }),
  pocs: many(clientPocs),
  projects: many(projects),
  invoices: many(invoices),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  aliases: many(companyAliases),
}));

export const companyAliasesRelations = relations(companyAliases, ({ one }) => ({
  company: one(companies, {
    fields: [companyAliases.companyId],
    references: [companies.id],
  }),
}));

export const clientPocsRelations = relations(clientPocs, ({ one }) => ({
  organization: one(clientOrganizations, {
    fields: [clientPocs.organizationId],
    references: [clientOrganizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  clientOrganization: one(clientOrganizations, {
    fields: [projects.clientOrganizationId],
    references: [clientOrganizations.id],
  }),
  createdBy: one(users, {
    fields: [projects.createdByPmId],
    references: [users.id],
    relationName: "createdBy",
  }),
  assignedRa: one(users, {
    fields: [projects.assignedRaId],
    references: [users.id],
    relationName: "assignedRa",
  }),
  angles: many(projectAngles),
  vettingQuestions: many(vettingQuestions),
  projectExperts: many(projectExperts),
  callRecords: many(callRecords),
  usageRecords: many(usageRecords),
  invitationLinks: many(expertInvitationLinks),
  advisorProjectInvitations: many(advisorProjectInvitations),
  advisorProjectResponses: many(advisorProjectResponses),
}));

export const projectAnglesRelations = relations(projectAngles, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectAngles.projectId],
    references: [projects.id],
  }),
  vettingQuestions: many(vettingQuestions),
}));

export const expertsRelations = relations(experts, ({ one, many }) => ({
  sourcedByRa: one(users, {
    fields: [experts.sourcedByRaId],
    references: [users.id],
    relationName: "sourcedExperts",
  }),
  projectExperts: many(projectExperts),
  callRecords: many(callRecords),
  usageRecords: many(usageRecords),
  advisorProjectInvitations: many(advisorProjectInvitations),
  advisorProjectResponses: many(advisorProjectResponses),
}));

export const vettingQuestionsRelations = relations(vettingQuestions, ({ one }) => ({
  project: one(projects, {
    fields: [vettingQuestions.projectId],
    references: [projects.id],
  }),
  angle: one(projectAngles, {
    fields: [vettingQuestions.angleId],
    references: [projectAngles.id],
  }),
}));

export const projectExpertsRelations = relations(projectExperts, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectExperts.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [projectExperts.expertId],
    references: [experts.id],
  }),
  sourcedByRa: one(users, {
    fields: [projectExperts.sourcedByRaId],
    references: [users.id],
    relationName: "sourcedProjectExperts",
  }),
  callRecords: many(callRecords),
}));

export const callRecordsRelations = relations(callRecords, ({ one }) => ({
  project: one(projects, {
    fields: [callRecords.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [callRecords.expertId],
    references: [experts.id],
  }),
  projectExpert: one(projectExperts, {
    fields: [callRecords.projectExpertId],
    references: [projectExperts.id],
  }),
  pm: one(users, {
    fields: [callRecords.pmId],
    references: [users.id],
    relationName: "pmCalls",
  }),
  ra: one(users, {
    fields: [callRecords.raId],
    references: [users.id],
    relationName: "raCalls",
  }),
}));

export const insightsRelations = relations(insights, ({ one }) => ({
  callRecord: one(callRecords, {
    fields: [insights.callRecordId],
    references: [callRecords.id],
  }),
}));

export const expertInvitationLinksRelations = relations(expertInvitationLinks, ({ one }) => ({
  project: one(projects, {
    fields: [expertInvitationLinks.projectId],
    references: [projects.id],
  }),
  ra: one(users, {
    fields: [expertInvitationLinks.raId],
    references: [users.id],
    relationName: "raInviteLinks",
  }),
  expert: one(experts, {
    fields: [expertInvitationLinks.expertId],
    references: [experts.id],
  }),
}));

export const advisorProjectInvitationsRelations = relations(advisorProjectInvitations, ({ one }) => ({
  project: one(projects, {
    fields: [advisorProjectInvitations.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [advisorProjectInvitations.expertId],
    references: [experts.id],
  }),
  createdByUser: one(users, {
    fields: [advisorProjectInvitations.createdBy],
    references: [users.id],
  }),
}));

export const advisorProjectResponsesRelations = relations(advisorProjectResponses, ({ one }) => ({
  invitation: one(advisorProjectInvitations, {
    fields: [advisorProjectResponses.invitationId],
    references: [advisorProjectInvitations.id],
  }),
  project: one(projects, {
    fields: [advisorProjectResponses.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [advisorProjectResponses.expertId],
    references: [experts.id],
  }),
}));

export const advisorProjectInvitationEmailSendsRelations = relations(advisorProjectInvitationEmailSends, ({ one }) => ({
  project: one(projects, {
    fields: [advisorProjectInvitationEmailSends.projectId],
    references: [projects.id],
  }),
  invitation: one(advisorProjectInvitations, {
    fields: [advisorProjectInvitationEmailSends.invitationId],
    references: [advisorProjectInvitations.id],
  }),
  expert: one(experts, {
    fields: [advisorProjectInvitationEmailSends.expertId],
    references: [experts.id],
  }),
  sentByUser: one(users, {
    fields: [advisorProjectInvitationEmailSends.sentByUserId],
    references: [users.id],
  }),
}));

export const projectActivitiesRelations = relations(projectActivities, ({ one }) => ({
  project: one(projects, {
    fields: [projectActivities.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectActivities.userId],
    references: [users.id],
  }),
  expert: one(experts, {
    fields: [projectActivities.expertId],
    references: [experts.id],
  }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  project: one(projects, {
    fields: [usageRecords.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [usageRecords.expertId],
    references: [experts.id],
  }),
}));

export const billableUsageRelations = relations(billableUsage, ({ one }) => ({
  callRecord: one(callRecords, {
    fields: [billableUsage.callRecordId],
    references: [callRecords.id],
  }),
  clientOrganization: one(clientOrganizations, {
    fields: [billableUsage.clientOrganizationId],
    references: [clientOrganizations.id],
  }),
  project: one(projects, {
    fields: [billableUsage.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [billableUsage.expertId],
    references: [experts.id],
  }),
}));

export const expertPayablesRelations = relations(expertPayables, ({ one }) => ({
  consultation: one(callRecords, {
    fields: [expertPayables.consultationId],
    references: [callRecords.id],
  }),
  project: one(projects, {
    fields: [expertPayables.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [expertPayables.expertId],
    references: [experts.id],
  }),
  clientOrganization: one(clientOrganizations, {
    fields: [expertPayables.clientOrganizationId],
    references: [clientOrganizations.id],
  }),
  approver: one(users, {
    fields: [expertPayables.approvedByUserId],
    references: [users.id],
  }),
  paidBy: one(users, {
    fields: [expertPayables.paidByUserId],
    references: [users.id],
  }),
  voidedBy: one(users, {
    fields: [expertPayables.voidedByUserId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  clientOrganization: one(clientOrganizations, {
    fields: [invoices.clientOrganizationId],
    references: [clientOrganizations.id],
  }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  billableUsage: one(billableUsage, {
    fields: [invoiceLineItems.billableUsageId],
    references: [billableUsage.id],
  }),
  project: one(projects, {
    fields: [invoiceLineItems.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [invoiceLineItems.expertId],
    references: [experts.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  owner: one(users, {
    fields: [expenses.ownerId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [expenses.approvedBy],
    references: [users.id],
  }),
  receiptUploader: one(users, {
    fields: [expenses.receiptUploadedBy],
    references: [users.id],
  }),
}));

// Helper for coercing date strings to Date objects
const coerceDate = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return val;
  if (typeof val === "string") return new Date(val);
  return val;
}, z.date().nullable());

const coerceDateRequired = z.preprocess((val) => {
  if (val instanceof Date) return val;
  if (typeof val === "string") return new Date(val);
  return val;
}, z.date());

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  mustChangePassword: z.boolean().default(false),
});

export const insertUserEmailConnectionSchema = createInsertSchema(userEmailConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  accessTokenExpiresAt: coerceDate.optional(),
  lastConnectedAt: coerceDate.optional(),
  lastValidatedAt: coerceDate.optional(),
  revokedAt: coerceDate.optional(),
});

export const insertEmailOauthStateSchema = createInsertSchema(emailOauthStates).omit({
  id: true,
  createdAt: true,
}).extend({
  expiresAt: coerceDateRequired,
  usedAt: coerceDate.optional(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertClientOrganizationSchema = createInsertSchema(clientOrganizations).omit({
  id: true,
  createdAt: true,
  totalCuUsed: true,
}).extend({
  contractStartDate: coerceDate.optional(),
  contractEndDate: coerceDate.optional(),
});

export const insertClientPocSchema = createInsertSchema(clientPocs).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  normalizedName: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyAliasSchema = createInsertSchema(companyAliases).omit({
  id: true,
  normalizedAlias: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalCuUsed: true,
}).extend({
  startDate: coerceDate.optional(),
  endDate: coerceDate.optional(),
  dueDate: coerceDate.optional(),
});

export const insertExpertSchema = createInsertSchema(experts).omit({
  id: true,
  createdAt: true,
}).extend({
  sourcedAt: coerceDate.optional(),
});

export const insertProjectAngleSchema = createInsertSchema(projectAngles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVettingQuestionSchema = createInsertSchema(vettingQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertProjectExpertSchema = createInsertSchema(projectExperts).omit({
  id: true,
  assignedAt: true,
}).extend({
  invitedAt: coerceDate.optional(),
  openedAt: coerceDate.optional(),
  respondedAt: coerceDate.optional(),
  lastActivityAt: coerceDate.optional(),
});

export const insertCallRecordSchema = createInsertSchema(callRecords).omit({
  id: true,
  createdAt: true,
}).extend({
  callDate: coerceDateRequired,
  scheduledStartTime: coerceDate.optional(),
  scheduledEndTime: coerceDate.optional(),
  completedAt: coerceDate.optional(),
});

export const insertInsightSchema = createInsertSchema(insights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  callDate: coerceDateRequired,
  keyTags: z.array(z.string()).optional(),
  recommendedFollowUpQuestions: z.array(z.string()).optional(),
  reviewedAt: coerceDate.optional(),
  approvedAt: coerceDate.optional(),
  generatedAt: coerceDate.optional(),
});

export const insertExpertInvitationLinkSchema = createInsertSchema(expertInvitationLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usedAt: true,
}).extend({
  expiresAt: coerceDate.optional(),
});

export const insertAdvisorProjectInvitationSchema = createInsertSchema(advisorProjectInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  sentAt: coerceDate.optional(),
  submittedAt: coerceDate.optional(),
  expiresAt: coerceDate.optional(),
});

export const insertAdvisorProjectResponseSchema = createInsertSchema(advisorProjectResponses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  submittedAt: coerceDate.optional(),
});

export const insertAdvisorProjectInvitationEmailSendSchema = createInsertSchema(advisorProjectInvitationEmailSends).omit({
  id: true,
  createdAt: true,
}).extend({
  sentAt: coerceDate.optional(),
});

export const insertProjectActivitySchema = createInsertSchema(projectActivities).omit({
  id: true,
  createdAt: true,
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true,
}).extend({
  callDate: coerceDateRequired,
});

export const insertBillableUsageSchema = createInsertSchema(billableUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  callDate: coerceDateRequired,
});

export const insertExpertPayableSchema = createInsertSchema(expertPayables).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  serviceDate: coerceDateRequired,
  approvedAt: coerceDate.optional(),
  paidAt: coerceDate.optional(),
  voidedAt: coerceDate.optional(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  invoiceDate: coerceDateRequired,
  periodStart: coerceDate.optional(),
  periodEnd: coerceDate.optional(),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
}).extend({
  serviceDate: coerceDateRequired,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  expenseId: true,
  receiptFileName: true,
  receiptMimeType: true,
  receiptFileSize: true,
  receiptUploadedBy: true,
  receiptUploadedAt: true,
  receiptData: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expenseDate: coerceDateRequired,
  renewalDate: coerceDate.optional(),
  approvedAt: coerceDate.optional(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserEmailConnection = typeof userEmailConnections.$inferSelect;
export type InsertUserEmailConnection = z.infer<typeof insertUserEmailConnectionSchema>;
export type EmailOauthState = typeof emailOauthStates.$inferSelect;
export type InsertEmailOauthState = z.infer<typeof insertEmailOauthStateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type ClientOrganization = typeof clientOrganizations.$inferSelect;
export type InsertClientOrganization = z.infer<typeof insertClientOrganizationSchema>;

export type ClientPoc = typeof clientPocs.$inferSelect;
export type InsertClientPoc = z.infer<typeof insertClientPocSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type CompanyAlias = typeof companyAliases.$inferSelect;
export type InsertCompanyAlias = z.infer<typeof insertCompanyAliasSchema>;

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Expert = typeof experts.$inferSelect;
export type InsertExpert = z.infer<typeof insertExpertSchema>;

export type ProjectAngle = typeof projectAngles.$inferSelect;
export type InsertProjectAngle = z.infer<typeof insertProjectAngleSchema>;

export type VettingQuestion = typeof vettingQuestions.$inferSelect;
export type InsertVettingQuestion = z.infer<typeof insertVettingQuestionSchema>;

export type ProjectExpert = typeof projectExperts.$inferSelect;
export type InsertProjectExpert = z.infer<typeof insertProjectExpertSchema>;

export type CallRecord = typeof callRecords.$inferSelect;
export type InsertCallRecord = z.infer<typeof insertCallRecordSchema>;

export type Insight = typeof insights.$inferSelect;
export type InsertInsight = z.infer<typeof insertInsightSchema>;

export type ExpertInvitationLink = typeof expertInvitationLinks.$inferSelect;
export type InsertExpertInvitationLink = z.infer<typeof insertExpertInvitationLinkSchema>;

export type AdvisorProjectInvitation = typeof advisorProjectInvitations.$inferSelect;
export type InsertAdvisorProjectInvitation = z.infer<typeof insertAdvisorProjectInvitationSchema>;
export type AdvisorProjectResponse = typeof advisorProjectResponses.$inferSelect;
export type InsertAdvisorProjectResponse = z.infer<typeof insertAdvisorProjectResponseSchema>;
export type AdvisorProjectInvitationEmailSend = typeof advisorProjectInvitationEmailSends.$inferSelect;
export type InsertAdvisorProjectInvitationEmailSend = z.infer<typeof insertAdvisorProjectInvitationEmailSendSchema>;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;

export type BillableUsage = typeof billableUsage.$inferSelect;
export type InsertBillableUsage = z.infer<typeof insertBillableUsageSchema>;
export type ExpertPayable = typeof expertPayables.$inferSelect;
export type InsertExpertPayable = z.infer<typeof insertExpertPayableSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export type ProjectActivity = typeof projectActivities.$inferSelect;
export type InsertProjectActivity = z.infer<typeof insertProjectActivitySchema>;

// CU Calculation Helper (1 CU = 60 minutes, 0.25 CU increments, min 1 CU if > 52 min)
export function calculateCU(durationMinutes: number): number {
  if (durationMinutes <= 0) return 0;
  if (durationMinutes > 52) {
    return Math.max(1, Math.ceil((durationMinutes / 60) * 4) / 4);
  }
  return Math.ceil((durationMinutes / 60) * 4) / 4;
}

// Project status flow
export const PROJECT_STATUSES = [
  "new",
  "sourcing",
  "shortlisted",
  "confirmed",
  "scheduled",
  "completed",
  "cancelled",
] as const;

export const PROJECT_EXPERT_STATUSES = [
  "assigned",
  "invited",
  "accepted",
  "declined",
  "client_selected",
  "scheduled",
  "completed",
] as const;

// Expert invitation status for project participation
export const INVITATION_STATUSES = [
  "not_invited",
  "invited",
  "opened",
  "accepted",
  "declined",
] as const;

// Expert pipeline status within a project
export const PIPELINE_STATUSES = [
  "interested",
  "shortlisted",
  "accepted",
  "declined",
  "completed",
] as const;

// Source type for how expert was added to project
export const SOURCE_TYPES = [
  "internal_db",
  "ra_external",
] as const;

// Invite link types
export const INVITE_TYPES = [
  "general",
  "ra",
  "existing",
] as const;

// Activity types for project activity log
export const ACTIVITY_TYPES = [
  "project_created",
  "expert_assigned",
  "expert_invited",
  "expert_opened",
  "expert_accepted",
  "expert_declined",
  "ra_assigned",
  "status_changed",
  "note_added",
] as const;

export const CALL_STATUSES = [
  "pending",
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

// Internal employee roles only (no client/expert login)
export const USER_ROLES = [
  "admin",
  "pm",
  "ra",
  "finance",
] as const;

export const CLIENT_STATUSES = [
  "active",
  "inactive", 
  "prospect",
] as const;
