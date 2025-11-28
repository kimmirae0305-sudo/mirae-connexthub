import {
  projects,
  experts,
  vettingQuestions,
  projectExperts,
  usageRecords,
  type Project,
  type InsertProject,
  type Expert,
  type InsertExpert,
  type VettingQuestion,
  type InsertVettingQuestion,
  type ProjectExpert,
  type InsertProjectExpert,
  type UsageRecord,
  type InsertUsageRecord,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Experts
  getExperts(): Promise<Expert[]>;
  getExpert(id: number): Promise<Expert | undefined>;
  createExpert(expert: InsertExpert): Promise<Expert>;
  updateExpert(id: number, expert: Partial<InsertExpert>): Promise<Expert | undefined>;
  deleteExpert(id: number): Promise<boolean>;

  // Vetting Questions
  getVettingQuestions(): Promise<VettingQuestion[]>;
  getVettingQuestionsByProject(projectId: number): Promise<VettingQuestion[]>;
  createVettingQuestion(question: InsertVettingQuestion): Promise<VettingQuestion>;
  updateVettingQuestion(id: number, question: Partial<InsertVettingQuestion>): Promise<VettingQuestion | undefined>;
  deleteVettingQuestion(id: number): Promise<boolean>;

  // Project Experts
  getProjectExperts(): Promise<ProjectExpert[]>;
  getProjectExpertsByProject(projectId: number): Promise<ProjectExpert[]>;
  createProjectExpert(assignment: InsertProjectExpert): Promise<ProjectExpert>;
  deleteProjectExpert(id: number): Promise<boolean>;

  // Usage Records
  getUsageRecords(): Promise<UsageRecord[]>;
  createUsageRecord(record: InsertUsageRecord): Promise<UsageRecord>;
  deleteUsageRecord(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Projects
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined> {
    const [updated] = await db
      .update(projects)
      .set(project)
      .where(eq(projects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProject(id: number): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Experts
  async getExperts(): Promise<Expert[]> {
    return db.select().from(experts).orderBy(desc(experts.createdAt));
  }

  async getExpert(id: number): Promise<Expert | undefined> {
    const [expert] = await db.select().from(experts).where(eq(experts.id, id));
    return expert || undefined;
  }

  async createExpert(expert: InsertExpert): Promise<Expert> {
    const [newExpert] = await db.insert(experts).values(expert).returning();
    return newExpert;
  }

  async updateExpert(id: number, expert: Partial<InsertExpert>): Promise<Expert | undefined> {
    const [updated] = await db
      .update(experts)
      .set(expert)
      .where(eq(experts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExpert(id: number): Promise<boolean> {
    const result = await db.delete(experts).where(eq(experts.id, id)).returning();
    return result.length > 0;
  }

  // Vetting Questions
  async getVettingQuestions(): Promise<VettingQuestion[]> {
    return db.select().from(vettingQuestions).orderBy(vettingQuestions.orderIndex);
  }

  async getVettingQuestionsByProject(projectId: number): Promise<VettingQuestion[]> {
    return db
      .select()
      .from(vettingQuestions)
      .where(eq(vettingQuestions.projectId, projectId))
      .orderBy(vettingQuestions.orderIndex);
  }

  async createVettingQuestion(question: InsertVettingQuestion): Promise<VettingQuestion> {
    const [newQuestion] = await db.insert(vettingQuestions).values(question).returning();
    return newQuestion;
  }

  async updateVettingQuestion(
    id: number,
    question: Partial<InsertVettingQuestion>
  ): Promise<VettingQuestion | undefined> {
    const [updated] = await db
      .update(vettingQuestions)
      .set(question)
      .where(eq(vettingQuestions.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteVettingQuestion(id: number): Promise<boolean> {
    const result = await db.delete(vettingQuestions).where(eq(vettingQuestions.id, id)).returning();
    return result.length > 0;
  }

  // Project Experts
  async getProjectExperts(): Promise<ProjectExpert[]> {
    return db.select().from(projectExperts).orderBy(desc(projectExperts.assignedAt));
  }

  async getProjectExpertsByProject(projectId: number): Promise<ProjectExpert[]> {
    return db
      .select()
      .from(projectExperts)
      .where(eq(projectExperts.projectId, projectId));
  }

  async createProjectExpert(assignment: InsertProjectExpert): Promise<ProjectExpert> {
    const [newAssignment] = await db.insert(projectExperts).values(assignment).returning();
    return newAssignment;
  }

  async deleteProjectExpert(id: number): Promise<boolean> {
    const result = await db.delete(projectExperts).where(eq(projectExperts.id, id)).returning();
    return result.length > 0;
  }

  // Usage Records
  async getUsageRecords(): Promise<UsageRecord[]> {
    return db.select().from(usageRecords).orderBy(desc(usageRecords.callDate));
  }

  async createUsageRecord(record: InsertUsageRecord): Promise<UsageRecord> {
    const [newRecord] = await db.insert(usageRecords).values(record).returning();
    return newRecord;
  }

  async deleteUsageRecord(id: number): Promise<boolean> {
    const result = await db.delete(usageRecords).where(eq(usageRecords.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
