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
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

// Projects table (Extended)
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  projectOverview: text("project_overview"),
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
  areasOfExpertise: text("areas_of_expertise").array(),
  industry: text("industry").notNull(),
  company: text("company"), // Current employer
  pastEmployers: text("past_employers").array(), // List of past employer names
  jobTitle: text("job_title"),
  yearsOfExperience: integer("years_of_experience").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  bio: text("bio"),
  workHistory: jsonb("work_history").$type<Array<{ company: string; jobTitle: string; fromYear: number; toYear: number }>>(), // Work history entries
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

// Expert Invitation Links table (Extended with types)
export const expertInvitationLinks = pgTable("expert_invitation_links", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  raId: integer("ra_id").references(() => users.id), // RA user ID for RA-specific links
  expertId: integer("expert_id").references(() => experts.id), // For existing expert invites
  angleIds: integer("angle_ids").array(), // Angles this expert is being invited for
  inviteType: text("invite_type").notNull().default("general"), // general, ra, existing
  recruitedBy: text("recruited_by").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  managedOrganizations: many(clientOrganizations),
  createdProjects: many(projects, { relationName: "createdBy" }),
  assistedProjects: many(projects, { relationName: "assignedRa" }),
}));

export const clientOrganizationsRelations = relations(clientOrganizations, ({ one, many }) => ({
  mainPm: one(users, {
    fields: [clientOrganizations.mainPmId],
    references: [users.id],
  }),
  pocs: many(clientPocs),
  projects: many(projects),
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

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertClientOrganizationSchema = createInsertSchema(clientOrganizations).omit({
  id: true,
  createdAt: true,
  totalCuUsed: true,
});

export const insertClientPocSchema = createInsertSchema(clientPocs).omit({
  id: true,
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

export const insertExpertInvitationLinkSchema = createInsertSchema(expertInvitationLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usedAt: true,
}).extend({
  expiresAt: coerceDate.optional(),
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

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;

export type ClientOrganization = typeof clientOrganizations.$inferSelect;
export type InsertClientOrganization = z.infer<typeof insertClientOrganizationSchema>;

export type ClientPoc = typeof clientPocs.$inferSelect;
export type InsertClientPoc = z.infer<typeof insertClientPocSchema>;

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

export type ExpertInvitationLink = typeof expertInvitationLinks.$inferSelect;
export type InsertExpertInvitationLink = z.infer<typeof insertExpertInvitationLinkSchema>;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;

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
