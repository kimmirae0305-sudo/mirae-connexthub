import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, decimal, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull(),
  description: text("description"),
  industry: text("industry").notNull(),
  status: text("status").notNull().default("pending"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Experts table
export const experts = pgTable("experts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  expertise: text("expertise").notNull(),
  industry: text("industry").notNull(),
  yearsOfExperience: integer("years_of_experience").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  bio: text("bio"),
  status: text("status").notNull().default("available"),
  linkedinUrl: text("linkedin_url"),
  company: text("company"),
  jobTitle: text("job_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Vetting Questions table
export const vettingQuestions = pgTable("vetting_questions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  isRequired: boolean("is_required").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Project-Expert Assignments table
export const projectExperts = pgTable("project_experts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  expertId: integer("expert_id").notNull().references(() => experts.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("assigned"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  notes: text("notes"),
});

// CU Usage Records table
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
export const projectsRelations = relations(projects, ({ many }) => ({
  vettingQuestions: many(vettingQuestions),
  projectExperts: many(projectExperts),
  usageRecords: many(usageRecords),
}));

export const expertsRelations = relations(experts, ({ many }) => ({
  projectExperts: many(projectExperts),
  usageRecords: many(usageRecords),
}));

export const vettingQuestionsRelations = relations(vettingQuestions, ({ one }) => ({
  project: one(projects, {
    fields: [vettingQuestions.projectId],
    references: [projects.id],
  }),
}));

export const projectExpertsRelations = relations(projectExperts, ({ one }) => ({
  project: one(projects, {
    fields: [projectExperts.projectId],
    references: [projects.id],
  }),
  expert: one(experts, {
    fields: [projectExperts.expertId],
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
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: coerceDate.optional(),
  endDate: coerceDate.optional(),
});

export const insertExpertSchema = createInsertSchema(experts).omit({
  id: true,
  createdAt: true,
});

export const insertVettingQuestionSchema = createInsertSchema(vettingQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertProjectExpertSchema = createInsertSchema(projectExperts).omit({
  id: true,
  assignedAt: true,
});

export const insertUsageRecordSchema = createInsertSchema(usageRecords).omit({
  id: true,
  createdAt: true,
}).extend({
  callDate: coerceDateRequired,
});

// Types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type Expert = typeof experts.$inferSelect;
export type InsertExpert = z.infer<typeof insertExpertSchema>;

export type VettingQuestion = typeof vettingQuestions.$inferSelect;
export type InsertVettingQuestion = z.infer<typeof insertVettingQuestionSchema>;

export type ProjectExpert = typeof projectExperts.$inferSelect;
export type InsertProjectExpert = z.infer<typeof insertProjectExpertSchema>;

export type UsageRecord = typeof usageRecords.$inferSelect;
export type InsertUsageRecord = z.infer<typeof insertUsageRecordSchema>;
