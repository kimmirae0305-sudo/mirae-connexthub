import {
  projects,
  experts,
  vettingQuestions,
  projectExperts,
  usageRecords,
  users,
  clientOrganizations,
  clientPocs,
  callRecords,
  expertInvitationLinks,
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
  type User,
  type InsertUser,
  type ClientOrganization,
  type InsertClientOrganization,
  type ClientPoc,
  type InsertClientPoc,
  type CallRecord,
  type InsertCallRecord,
  type ExpertInvitationLink,
  type InsertExpertInvitationLink,
  calculateCU,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, or, and, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Client Organizations
  getClientOrganizations(): Promise<ClientOrganization[]>;
  getClientOrganization(id: number): Promise<ClientOrganization | undefined>;
  createClientOrganization(org: InsertClientOrganization): Promise<ClientOrganization>;
  updateClientOrganization(id: number, org: Partial<InsertClientOrganization>): Promise<ClientOrganization | undefined>;
  deleteClientOrganization(id: number): Promise<boolean>;

  // Client POCs
  getClientPocs(): Promise<ClientPoc[]>;
  getClientPocsByOrganization(organizationId: number): Promise<ClientPoc[]>;
  createClientPoc(poc: InsertClientPoc): Promise<ClientPoc>;
  updateClientPoc(id: number, poc: Partial<InsertClientPoc>): Promise<ClientPoc | undefined>;
  deleteClientPoc(id: number): Promise<boolean>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  getProjectsByOrganization(organizationId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Experts
  getExperts(): Promise<Expert[]>;
  getExpert(id: number): Promise<Expert | undefined>;
  getExpertByEmail(email: string): Promise<Expert | undefined>;
  searchExperts(query: string): Promise<Expert[]>;
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
  getProjectExpert(id: number): Promise<ProjectExpert | undefined>;
  getProjectExpertsByProject(projectId: number): Promise<ProjectExpert[]>;
  getProjectExpertsByExpert(expertId: number): Promise<ProjectExpert[]>;
  createProjectExpert(assignment: InsertProjectExpert): Promise<ProjectExpert>;
  updateProjectExpert(id: number, assignment: Partial<InsertProjectExpert>): Promise<ProjectExpert | undefined>;
  deleteProjectExpert(id: number): Promise<boolean>;

  // Call Records
  getCallRecords(): Promise<CallRecord[]>;
  getCallRecord(id: number): Promise<CallRecord | undefined>;
  getCallRecordsByProject(projectId: number): Promise<CallRecord[]>;
  getCallRecordsByExpert(expertId: number): Promise<CallRecord[]>;
  createCallRecord(record: InsertCallRecord): Promise<CallRecord>;
  updateCallRecord(id: number, record: Partial<InsertCallRecord>): Promise<CallRecord | undefined>;
  deleteCallRecord(id: number): Promise<boolean>;

  // Expert Invitation Links
  getExpertInvitationLinks(): Promise<ExpertInvitationLink[]>;
  getExpertInvitationLinkByToken(token: string): Promise<ExpertInvitationLink | undefined>;
  createExpertInvitationLink(link: InsertExpertInvitationLink): Promise<ExpertInvitationLink>;
  markInvitationLinkUsed(token: string): Promise<ExpertInvitationLink | undefined>;

  // Usage Records (legacy)
  getUsageRecords(): Promise<UsageRecord[]>;
  createUsageRecord(record: InsertUsageRecord): Promise<UsageRecord>;
  deleteUsageRecord(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.fullName);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // Client Organizations
  async getClientOrganizations(): Promise<ClientOrganization[]> {
    return db.select().from(clientOrganizations).orderBy(clientOrganizations.name);
  }

  async getClientOrganization(id: number): Promise<ClientOrganization | undefined> {
    const [org] = await db.select().from(clientOrganizations).where(eq(clientOrganizations.id, id));
    return org || undefined;
  }

  async createClientOrganization(org: InsertClientOrganization): Promise<ClientOrganization> {
    const [newOrg] = await db.insert(clientOrganizations).values(org).returning();
    return newOrg;
  }

  async updateClientOrganization(id: number, org: Partial<InsertClientOrganization>): Promise<ClientOrganization | undefined> {
    const [updated] = await db.update(clientOrganizations).set(org).where(eq(clientOrganizations.id, id)).returning();
    return updated || undefined;
  }

  async deleteClientOrganization(id: number): Promise<boolean> {
    const result = await db.delete(clientOrganizations).where(eq(clientOrganizations.id, id)).returning();
    return result.length > 0;
  }

  // Client POCs
  async getClientPocs(): Promise<ClientPoc[]> {
    return db.select().from(clientPocs).orderBy(clientPocs.name);
  }

  async getClientPocsByOrganization(organizationId: number): Promise<ClientPoc[]> {
    return db.select().from(clientPocs).where(eq(clientPocs.organizationId, organizationId));
  }

  async createClientPoc(poc: InsertClientPoc): Promise<ClientPoc> {
    const [newPoc] = await db.insert(clientPocs).values(poc).returning();
    return newPoc;
  }

  async updateClientPoc(id: number, poc: Partial<InsertClientPoc>): Promise<ClientPoc | undefined> {
    const [updated] = await db.update(clientPocs).set(poc).where(eq(clientPocs.id, id)).returning();
    return updated || undefined;
  }

  async deleteClientPoc(id: number): Promise<boolean> {
    const result = await db.delete(clientPocs).where(eq(clientPocs.id, id)).returning();
    return result.length > 0;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsByOrganization(organizationId: number): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.clientOrganizationId, organizationId)).orderBy(desc(projects.createdAt));
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

  async getExpertByEmail(email: string): Promise<Expert | undefined> {
    const [expert] = await db.select().from(experts).where(eq(experts.email, email));
    return expert || undefined;
  }

  async searchExperts(query: string): Promise<Expert[]> {
    const searchPattern = `%${query}%`;
    return db
      .select()
      .from(experts)
      .where(
        or(
          ilike(experts.name, searchPattern),
          ilike(experts.expertise, searchPattern),
          ilike(experts.industry, searchPattern),
          ilike(experts.company, searchPattern),
          ilike(experts.jobTitle, searchPattern),
          ilike(experts.bio, searchPattern)
        )
      )
      .orderBy(experts.name);
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

  async getProjectExpert(id: number): Promise<ProjectExpert | undefined> {
    const [pe] = await db.select().from(projectExperts).where(eq(projectExperts.id, id));
    return pe || undefined;
  }

  async getProjectExpertsByProject(projectId: number): Promise<ProjectExpert[]> {
    return db
      .select()
      .from(projectExperts)
      .where(eq(projectExperts.projectId, projectId));
  }

  async getProjectExpertsByExpert(expertId: number): Promise<ProjectExpert[]> {
    return db
      .select()
      .from(projectExperts)
      .where(eq(projectExperts.expertId, expertId));
  }

  async createProjectExpert(assignment: InsertProjectExpert): Promise<ProjectExpert> {
    const [newAssignment] = await db.insert(projectExperts).values(assignment as any).returning();
    return newAssignment;
  }

  async updateProjectExpert(id: number, assignment: Partial<InsertProjectExpert>): Promise<ProjectExpert | undefined> {
    const [updated] = await db
      .update(projectExperts)
      .set(assignment as any)
      .where(eq(projectExperts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProjectExpert(id: number): Promise<boolean> {
    const result = await db.delete(projectExperts).where(eq(projectExperts.id, id)).returning();
    return result.length > 0;
  }

  // Call Records
  async getCallRecords(): Promise<CallRecord[]> {
    return db.select().from(callRecords).orderBy(desc(callRecords.callDate));
  }

  async getCallRecord(id: number): Promise<CallRecord | undefined> {
    const [record] = await db.select().from(callRecords).where(eq(callRecords.id, id));
    return record || undefined;
  }

  async getCallRecordsByProject(projectId: number): Promise<CallRecord[]> {
    return db
      .select()
      .from(callRecords)
      .where(eq(callRecords.projectId, projectId))
      .orderBy(desc(callRecords.callDate));
  }

  async getCallRecordsByExpert(expertId: number): Promise<CallRecord[]> {
    return db
      .select()
      .from(callRecords)
      .where(eq(callRecords.expertId, expertId))
      .orderBy(desc(callRecords.callDate));
  }

  async createCallRecord(record: InsertCallRecord): Promise<CallRecord> {
    const cuUsed = calculateCU(record.durationMinutes);
    const [newRecord] = await db.insert(callRecords).values({
      ...record,
      cuUsed: cuUsed.toString(),
    }).returning();
    
    // Update project total CU
    await db.update(projects).set({
      totalCuUsed: sql`COALESCE(${projects.totalCuUsed}, 0) + ${cuUsed}`,
    }).where(eq(projects.id, record.projectId));
    
    return newRecord;
  }

  async updateCallRecord(id: number, record: Partial<InsertCallRecord>): Promise<CallRecord | undefined> {
    const existing = await this.getCallRecord(id);
    if (!existing) return undefined;
    
    let updateData: any = { ...record };
    if (record.durationMinutes !== undefined) {
      updateData.cuUsed = calculateCU(record.durationMinutes).toString();
    }
    
    const [updated] = await db
      .update(callRecords)
      .set(updateData)
      .where(eq(callRecords.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCallRecord(id: number): Promise<boolean> {
    const result = await db.delete(callRecords).where(eq(callRecords.id, id)).returning();
    return result.length > 0;
  }

  // Expert Invitation Links
  async getExpertInvitationLinks(): Promise<ExpertInvitationLink[]> {
    return db.select().from(expertInvitationLinks).orderBy(desc(expertInvitationLinks.createdAt));
  }

  async getExpertInvitationLinkByToken(token: string): Promise<ExpertInvitationLink | undefined> {
    const [link] = await db.select().from(expertInvitationLinks).where(eq(expertInvitationLinks.token, token));
    return link || undefined;
  }

  async createExpertInvitationLink(link: InsertExpertInvitationLink): Promise<ExpertInvitationLink> {
    const [newLink] = await db.insert(expertInvitationLinks).values(link).returning();
    return newLink;
  }

  async markInvitationLinkUsed(token: string): Promise<ExpertInvitationLink | undefined> {
    const [updated] = await db
      .update(expertInvitationLinks)
      .set({ usedAt: new Date() })
      .where(eq(expertInvitationLinks.token, token))
      .returning();
    return updated || undefined;
  }

  // Usage Records (legacy)
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
