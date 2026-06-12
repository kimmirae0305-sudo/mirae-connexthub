import {
  projects,
  experts,
  vettingQuestions,
  projectExperts,
  usageRecords,
  billableUsage,
  invoices,
  invoiceLineItems,
  expenses,
  users,
  clients,
  clientOrganizations,
  companies,
  companyAliases,
  clientPocs,
  callRecords,
  insights,
  expertInvitationLinks,
  projectActivities,
  projectAngles,
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
  type Client,
  type InsertClient,
  type ClientOrganization,
  type InsertClientOrganization,
  type Company,
  type InsertCompany,
  type ClientPoc,
  type InsertClientPoc,
  type CallRecord,
  type InsertCallRecord,
  type Insight,
  type InsertInsight,
  type ExpertInvitationLink,
  type InsertExpertInvitationLink,
  type ProjectActivity,
  type InsertProjectActivity,
  type ProjectAngle,
  type InsertProjectAngle,
  type Expense,
  type InsertExpense,
  type BillableUsage,
  calculateCU,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, ilike, or, and, sql, gte, lte, inArray } from "drizzle-orm";

export interface CuLedgerFilters {
  startDate?: Date;
  endDate?: Date;
  projectId?: number;
  expertId?: number;
  pmId?: number;
  raId?: number;
  clientOrganizationId?: number;
}

export interface CuLedgerRow {
  callRecordId: number;
  callDate: Date;
  projectId: number;
  projectName: string;
  clientName: string;
  clientOrganizationId: number | null;
  expertId: number;
  expertName: string;
  pmId: number | null;
  pmName: string | null;
  raId: number | null;
  raName: string | null;
  durationMinutes: number;
  actualDurationMinutes: number | null;
  cuUsed: string;
  completedAt: Date | null;
  recordingUrl: string | null;
  source: "Completed Call Record";
}

export interface BillableUsageFilters {
  startDate?: Date;
  endDate?: Date;
  status?: string;
  clientOrganizationId?: number;
  projectId?: number;
}

export interface BillableUsageRow {
  id: number;
  callRecordId: number;
  clientOrganizationId: number | null;
  billableUsageClientOrganizationId: number | null;
  projectClientOrganizationId: number | null;
  clientLinkSource: "billable_usage" | "project" | "fallback";
  activeInvoiceId: number | null;
  activeInvoiceStatus: string | null;
  clientName: string;
  projectId: number;
  projectName: string;
  expertId: number;
  expertName: string;
  callDate: Date;
  cuUsed: string;
  currency: string;
  cuRate: string | null;
  amount: string | null;
  status: string;
  source: string;
  adjustmentReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillableUsageReport {
  summary: {
    unbilledItems: number;
    totalCU: number;
    billableAmount: number;
    missingRateItems: number;
  };
  rows: BillableUsageRow[];
}

export interface BillableUsageSyncResult {
  createdCount: number;
  skippedCount: number;
  clientOrganizationBackfilledCount?: number;
}

export interface BillableUsageRateRefreshResult {
  updatedCount: number;
  skippedCount: number;
  stillMissingRateCount: number;
}

export interface InvoiceListRow {
  id: number;
  draftNumber: string;
  invoiceNumber: string | null;
  clientOrganizationId: number;
  clientName: string;
  invoiceDate: Date;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  subtotal: string;
  total: string;
  status: string;
  notes: string | null;
  issuedAt: Date | null;
  issuedByUserId: number | null;
  sentAt: Date | null;
  sentByUserId: number | null;
  sentMethod: string | null;
  sentRecipientEmail: string | null;
  sentNotes: string | null;
  paidAt: Date | null;
  paidByUserId: number | null;
  paymentMethod: string | null;
  paymentReferenceNumber: string | null;
  paymentNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  lineItemCount: number;
}

export interface InvoiceLineItemRow {
  id: number;
  invoiceId: number;
  billableUsageId: number;
  description: string;
  serviceDate: string;
  projectId: number;
  projectName: string;
  expertId: number;
  expertName: string;
  cuUsed: string;
  cuRate: string;
  amount: string;
  createdAt: Date;
}

export interface InvoiceDetail {
  invoice: InvoiceListRow;
  lineItems: InvoiceLineItemRow[];
}

export interface CreateInvoiceDraftResult extends InvoiceDetail {
  billableUsageUpdatedCount: number;
}

export interface CancelInvoiceDraftResult extends InvoiceDetail {
  billableUsageUpdatedCount: number;
}

export interface IssueInvoiceResult extends InvoiceDetail {
  billableUsageUpdatedCount: number;
}

export interface MarkInvoiceSentInput {
  sentMethod?: string | null;
  sentRecipientEmail?: string | null;
  sentNotes?: string | null;
}

export interface MarkInvoiceSentResult extends InvoiceDetail {}

export interface MarkInvoicePaidInput {
  paymentMethod?: string | null;
  paymentReferenceNumber?: string | null;
  paymentNotes?: string | null;
}

export interface MarkInvoicePaidResult extends InvoiceDetail {}

export interface ExpenseFilters {
  search?: string;
  category?: string;
  status?: string;
  currency?: string;
  billingType?: string;
  accountingStatus?: string;
  fromDate?: Date;
  toDate?: Date;
}

export interface ExpenseRow {
  id: number;
  expenseId: string;
  vendor: string;
  category: string;
  description: string | null;
  amount: string;
  currency: string;
  billingType: string;
  expenseDate: Date;
  renewalDate: Date | null;
  paymentMethod: string | null;
  status: string;
  ownerId: number | null;
  ownerName: string | null;
  approvedBy: number | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  accountingStatus: string;
  notes: string | null;
  receiptFileName: string | null;
  receiptMimeType: string | null;
  receiptFileSize: number | null;
  receiptUploadedBy: number | null;
  receiptUploadedByName: string | null;
  receiptUploadedAt: Date | null;
  hasReceipt: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseReport {
  summary: {
    monthlyOperatingExpenses: number;
    activeSubscriptions: number;
    freePlanTools: number;
    annualizedSoftwareCost: number;
  };
  rows: ExpenseRow[];
}

export interface ExpenseReceipt {
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
}

export interface ExpenseReceiptInput {
  fileName: string;
  mimeType: string;
  fileSize: number;
  data: Buffer;
  uploadedBy?: number | null;
}

export interface OperationsAnalyticsFilters {
  startDate?: Date;
  endDate?: Date;
  granularity?: "month" | "week" | "day";
}

export interface OperationsAnalytics {
  summary: {
    activeProjects: number;
    completedCalls: number;
    totalCUUsed: number;
    totalCompletedMinutes: number;
    avgCUPerCall: number;
  };
  charts: {
    callsOverTime: Array<{ period: string; completedCalls: number; cuUsed: number }>;
    cuByIndustry: Array<{ industry: string; cuUsed: number; completedCalls: number }>;
    cuByProject: Array<{ projectId: number; projectName: string; cuUsed: number; completedCalls: number }>;
    completedCallsByExpert: Array<{ expertId: number; expertName: string; completedCalls: number; cuUsed: number }>;
    completedCallsByPM: Array<{ pmId: number | null; pmName: string; completedCalls: number; cuUsed: number }>;
    projectPipeline: Array<{ status: string; count: number }>;
  };
}

export type PmPerformanceSortBy = "totalCUUsed" | "completedCalls" | "activeProjects" | "cuPerRequest";

export interface PmPerformanceFilters {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  sortBy?: PmPerformanceSortBy;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export interface PmPerformanceRow {
  pmId: number;
  pmName: string;
  pmEmail: string;
  activeProjects: number;
  requestsHandled: number;
  completedCalls: number;
  totalCUUsed: number;
  cuPerRequest: number;
  callsPerRequest: number;
  totalCompletedMinutes: number;
  avgCUPerCall: number;
  signalsCaptured: number;
  lastCompletedCallDate: Date | null;
}

export interface PmPerformanceReport {
  summary: {
    totalPMs: number;
    requestsHandled: number;
    completedCalls: number;
    totalCUUsed: number;
  };
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
  rows: PmPerformanceRow[];
}

export type CompanyLinkStatus = "pending_review" | "suggested" | "linked" | "unclear" | "ignored";

export interface CompanySuggestion {
  company: Company;
  matchReason: "exact_name" | "alias" | "fuzzy_name" | "website_domain";
  score: number;
}

export interface ExpertWorkHistoryCompanyReviewItem {
  index: number;
  rawCompanyName: string;
  companyId: number | null;
  companyLinkStatus: CompanyLinkStatus;
  reviewedBy: number | null;
  reviewedAt: string | null;
  suggestions: CompanySuggestion[];
}

export interface ExpertCompanyReview {
  expertId: number;
  items: ExpertWorkHistoryCompanyReviewItem[];
  linkedCompanies: Array<{
    index: number;
    rawCompanyName: string;
    company: Company;
  }>;
}

export interface CreateAndLinkCompanyInput extends InsertCompany {
  alias?: string;
}

export interface CompanyFilters {
  search?: string;
  country?: string;
  companyType?: string;
  status?: string;
  dncStatus?: string;
  verificationStatus?: string;
}

export interface CompanyListRow extends Company {
  linkedExpertsCount: number;
}

export interface CompanyLinkedExpertRow {
  expertId: number;
  expertName: string;
  expertEmail: string;
  workHistoryIndex: number;
  rawCompanyName: string;
  jobTitle: string | null;
  fromYear: string | null;
  toYear: string | null;
}

export interface CompanyDetail {
  company: CompanyListRow;
  linkedExperts: CompanyLinkedExpertRow[];
}

export interface IStorage {
  // Users (Employees)
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Clients (CRM)
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  searchClients(params: { query?: string; industry?: string; status?: string }): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: number): Promise<boolean>;

  // Client Organizations
  getClientOrganizations(): Promise<ClientOrganization[]>;
  getClientOrganization(id: number): Promise<ClientOrganization | undefined>;
  createClientOrganization(org: InsertClientOrganization): Promise<ClientOrganization>;
  updateClientOrganization(id: number, org: Partial<InsertClientOrganization>): Promise<ClientOrganization | undefined>;
  deleteClientOrganization(id: number): Promise<boolean>;

  // Companies (expert work history review)
  getCompanies(queryOrFilters?: string | CompanyFilters): Promise<CompanyListRow[]>;
  getCompany(id: number): Promise<Company | undefined>;
  getCompanyDetail(id: number): Promise<CompanyDetail | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined>;
  getExpertCompanyReview(expertId: number): Promise<ExpertCompanyReview | undefined>;
  linkExpertWorkHistoryCompany(expertId: number, workHistoryIndex: number, companyId: number, reviewedBy: number): Promise<Expert | undefined>;
  createCompanyAndLinkExpertWorkHistory(
    expertId: number,
    workHistoryIndex: number,
    company: CreateAndLinkCompanyInput,
    reviewedBy: number
  ): Promise<{ expert: Expert; company: Company } | undefined>;
  updateExpertWorkHistoryCompanyStatus(
    expertId: number,
    workHistoryIndex: number,
    status: Extract<CompanyLinkStatus, "unclear" | "ignored">,
    reviewedBy: number
  ): Promise<Expert | undefined>;

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
  getProjectsByPm(pmId: number): Promise<Project[]>;
  getProjectsByAssignedRa(raId: number): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: number, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: number): Promise<boolean>;

  // Experts
  getExperts(): Promise<Expert[]>;
  getExpert(id: number): Promise<Expert | undefined>;
  getExpertByEmail(email: string): Promise<Expert | undefined>;
  searchExperts(query: string): Promise<Expert[]>;
  searchExpertsAdvanced(params: {
    query?: string;
    country?: string;
    companyName?: string;
    companyScope?: "current" | "past" | "any";
    currentEmployer?: string;
    pastEmployers?: string;
    minRate?: number;
    maxRate?: number;
    minYearsExperience?: number;
    maxYearsExperience?: number;
    employmentFromMonth?: number;
    employmentFromYear?: number;
    employmentToMonth?: number;
    employmentToYear?: number;
    jobTitle?: string;
    industry?: string;
    language?: string;
    hasPriorProjects?: boolean;
    minAcceptanceRate?: number;
    minHoursWorked?: number;
    availableOnly?: boolean;
    excludeProjectId?: number;
  }): Promise<(Expert & { priorProjectCount?: number; acceptanceRate?: number; matchedWorkHistory?: any[] })[]>;
  createExpert(expert: InsertExpert): Promise<Expert>;
  updateExpert(id: number, expert: Partial<InsertExpert>): Promise<Expert | undefined>;
  deleteExpert(id: number): Promise<boolean>;

  // Project Angles
  getProjectAngles(projectId: number): Promise<ProjectAngle[]>;
  getProjectAngle(id: number): Promise<ProjectAngle | undefined>;
  createProjectAngle(angle: InsertProjectAngle): Promise<ProjectAngle>;
  updateProjectAngle(id: number, angle: Partial<InsertProjectAngle>): Promise<ProjectAngle | undefined>;
  deleteProjectAngle(id: number): Promise<boolean>;
  reorderProjectAngles(projectId: number, angleIds: number[]): Promise<ProjectAngle[]>;

  // Vetting Questions
  getVettingQuestions(): Promise<VettingQuestion[]>;
  getVettingQuestionsByProject(projectId: number): Promise<VettingQuestion[]>;
  getVettingQuestionsByAngle(angleId: number): Promise<VettingQuestion[]>;
  createVettingQuestion(question: InsertVettingQuestion): Promise<VettingQuestion>;
  updateVettingQuestion(id: number, question: Partial<InsertVettingQuestion>): Promise<VettingQuestion | undefined>;
  deleteVettingQuestion(id: number): Promise<boolean>;
  deleteVettingQuestionsByAngle(angleId: number): Promise<boolean>;

  // Project Experts
  getProjectExperts(): Promise<ProjectExpert[]>;
  getProjectExpert(id: number): Promise<ProjectExpert | undefined>;
  getProjectExpertByToken(token: string): Promise<ProjectExpert | undefined>;
  getProjectExpertsByProject(projectId: number): Promise<ProjectExpert[]>;
  getProjectExpertsByExpert(expertId: number): Promise<ProjectExpert[]>;
  createProjectExpert(assignment: InsertProjectExpert): Promise<ProjectExpert>;
  createProjectExpertsBulk(assignments: InsertProjectExpert[]): Promise<ProjectExpert[]>;
  updateProjectExpert(id: number, assignment: Partial<InsertProjectExpert>): Promise<ProjectExpert | undefined>;
  deleteProjectExpert(id: number): Promise<boolean>;

  // Call Records
  getCallRecords(): Promise<CallRecord[]>;
  getCallRecord(id: number): Promise<CallRecord | undefined>;
  getCallRecordsByProject(projectId: number): Promise<CallRecord[]>;
  getCallRecordsByExpert(expertId: number): Promise<CallRecord[]>;
  getCuLedgerRows(filters: CuLedgerFilters): Promise<CuLedgerRow[]>;
  getOperationsAnalytics(filters: OperationsAnalyticsFilters): Promise<OperationsAnalytics>;
  getPmPerformance(filters: PmPerformanceFilters): Promise<PmPerformanceReport>;
  createCallRecord(record: InsertCallRecord): Promise<CallRecord>;
  updateCallRecord(id: number, record: Partial<InsertCallRecord>): Promise<CallRecord | undefined>;
  deleteCallRecord(id: number): Promise<boolean>;

  // Insights
  getInsights(): Promise<Insight[]>;
  getInsight(id: number): Promise<Insight | undefined>;
  getInsightsByProjectId(projectId: number): Promise<Insight[]>;
  getInsightByCallRecordId(callRecordId: number): Promise<Insight | undefined>;
  createInsight(insight: InsertInsight): Promise<Insight>;

  // Expert Invitation Links
  getExpertInvitationLinks(): Promise<ExpertInvitationLink[]>;
  getExpertInvitationLinkByToken(token: string): Promise<ExpertInvitationLink | undefined>;
  getExpertInvitationLinkByProjectAndRa(projectId: number, raId: number): Promise<ExpertInvitationLink | undefined>;
  getExpertInvitationLinkByProjectAndExpert(projectId: number, expertId: number): Promise<ExpertInvitationLink | undefined>;
  getExpertInvitationLinksByProject(projectId: number): Promise<ExpertInvitationLink[]>;
  getExpertInvitationLinksByRa(raId: number): Promise<ExpertInvitationLink[]>;
  createExpertInvitationLink(link: InsertExpertInvitationLink): Promise<ExpertInvitationLink>;
  updateExpertInvitationLink(id: number, link: Partial<InsertExpertInvitationLink>): Promise<ExpertInvitationLink | undefined>;
  markInvitationLinkUsed(token: string, expertId?: number, status?: string): Promise<ExpertInvitationLink | undefined>;
  updateInvitationLinkStatus(token: string, status: string): Promise<ExpertInvitationLink | undefined>;

  // Project Activities
  getProjectActivities(projectId: number): Promise<ProjectActivity[]>;
  createProjectActivity(activity: InsertProjectActivity): Promise<ProjectActivity>;

  // Usage Records (legacy)
  getUsageRecords(): Promise<UsageRecord[]>;
  createUsageRecord(record: InsertUsageRecord): Promise<UsageRecord>;
  deleteUsageRecord(id: number): Promise<boolean>;

  // Billable Usage (Finance)
  getBillableUsage(filters: BillableUsageFilters): Promise<BillableUsageReport>;
  syncBillableUsageForCallRecord(callRecordId: number): Promise<BillableUsage | undefined>;
  syncBillableUsageFromCompletedCalls(): Promise<BillableUsageSyncResult>;
  refreshMissingBillableUsageRates(): Promise<BillableUsageRateRefreshResult>;

  // Invoices (Finance draft layer)
  getInvoices(): Promise<InvoiceListRow[]>;
  getInvoiceById(id: number): Promise<InvoiceDetail | undefined>;
  createInvoiceDraft(
    billableUsageIds: number[],
    billingPeriod?: { periodStart?: Date | null; periodEnd?: Date | null }
  ): Promise<CreateInvoiceDraftResult>;
  cancelInvoiceDraft(invoiceId: number): Promise<CancelInvoiceDraftResult>;
  issueInvoice(invoiceId: number, issuedByUserId?: number): Promise<IssueInvoiceResult>;
  markInvoiceSent(
    invoiceId: number,
    input?: MarkInvoiceSentInput,
    sentByUserId?: number
  ): Promise<MarkInvoiceSentResult>;
  markInvoicePaid(
    invoiceId: number,
    input?: MarkInvoicePaidInput,
    paidByUserId?: number
  ): Promise<MarkInvoicePaidResult>;

  // Expenses (Finance operating expense tracking)
  getExpenses(filters: ExpenseFilters): Promise<ExpenseReport>;
  getExpense(id: number): Promise<ExpenseRow | undefined>;
  createExpense(expense: InsertExpense, createdByUserId?: number): Promise<ExpenseRow>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<ExpenseRow | undefined>;
  archiveExpense(id: number): Promise<ExpenseRow | undefined>;
  saveExpenseReceipt(id: number, receipt: ExpenseReceiptInput): Promise<ExpenseRow | undefined>;
  getExpenseReceipt(id: number): Promise<ExpenseReceipt | undefined>;
  deleteExpenseReceipt(id: number): Promise<ExpenseRow | undefined>;
}

const COMPANY_LINK_STATUSES = new Set<CompanyLinkStatus>([
  "pending_review",
  "suggested",
  "linked",
  "unclear",
  "ignored",
]);

function normalizeCompanyName(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(incorporated|inc|ltd|limited|llc|corp|corporation|company|co|sa|s\.a\.|s\/a|plc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDomain(value: unknown) {
  const rawValue = String(value || "").trim().toLowerCase();
  if (!rawValue) return "";
  try {
    const withProtocol = rawValue.startsWith("http://") || rawValue.startsWith("https://") ? rawValue : `https://${rawValue}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "");
  } catch {
    return rawValue.replace(/^www\./, "").split("/")[0];
  }
}

function normalizeExpertWorkHistory(workHistory: unknown) {
  if (!Array.isArray(workHistory)) return workHistory as any;
  return workHistory.map((item: any) => {
    const rawCompanyName = String(item?.rawCompanyName || item?.company || "").trim();
    const companyId = Number(item?.companyId);
    const linkStatus = COMPANY_LINK_STATUSES.has(item?.companyLinkStatus)
      ? item.companyLinkStatus
      : companyId > 0
        ? "linked"
        : rawCompanyName
          ? "pending_review"
          : "ignored";

    return {
      ...item,
      company: String(item?.company || rawCompanyName || "").trim(),
      rawCompanyName,
      companyId: companyId > 0 ? companyId : null,
      companyLinkStatus: linkStatus,
      reviewedBy: Number(item?.reviewedBy) > 0 ? Number(item.reviewedBy) : null,
      reviewedAt: item?.reviewedAt || null,
    };
  });
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

  // Clients (CRM)
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async searchClients(params: { query?: string; industry?: string; status?: string }): Promise<Client[]> {
    const conditions = [];
    
    if (params.query) {
      const searchPattern = `%${params.query}%`;
      conditions.push(
        or(
          ilike(clients.clientName, searchPattern),
          ilike(clients.mainContactName, searchPattern),
          ilike(clients.mainContactEmail, searchPattern),
          ilike(clients.country, searchPattern)
        )
      );
    }
    
    if (params.industry) {
      conditions.push(ilike(clients.industry, `%${params.industry}%`));
    }
    
    if (params.status) {
      conditions.push(eq(clients.status, params.status));
    }
    
    if (conditions.length === 0) {
      return db.select().from(clients).orderBy(desc(clients.createdAt));
    }
    
    return db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt));
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: number, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set(client).where(eq(clients.id, id)).returning();
    return updated || undefined;
  }

  async deleteClient(id: number): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
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

  private async getLinkedExpertsByCompanyId(companyId?: number): Promise<Map<number, CompanyLinkedExpertRow[]>> {
    const expertRows = await db
      .select({
        id: experts.id,
        name: experts.name,
        email: experts.email,
        workHistory: experts.workHistory,
      })
      .from(experts)
      .orderBy(experts.name);

    const linkedByCompanyId = new Map<number, CompanyLinkedExpertRow[]>();
    for (const expert of expertRows) {
      const workHistory = normalizeExpertWorkHistory(expert.workHistory) as any[];
      for (const [index, item] of workHistory.entries()) {
        const linkedCompanyId = Number(item.companyId || 0);
        if (!linkedCompanyId || (companyId && linkedCompanyId !== companyId)) continue;

        const row: CompanyLinkedExpertRow = {
          expertId: expert.id,
          expertName: expert.name,
          expertEmail: expert.email,
          workHistoryIndex: index,
          rawCompanyName: String(item.rawCompanyName || item.company || "").trim(),
          jobTitle: item.jobTitle ? String(item.jobTitle) : null,
          fromYear: item.fromYear ? String(item.fromYear) : null,
          toYear: item.toYear ? String(item.toYear) : null,
        };
        linkedByCompanyId.set(linkedCompanyId, [...(linkedByCompanyId.get(linkedCompanyId) || []), row]);
      }
    }

    return linkedByCompanyId;
  }

  // Companies (expert work history review)
  async getCompanies(queryOrFilters?: string | CompanyFilters): Promise<CompanyListRow[]> {
    const filters: CompanyFilters = typeof queryOrFilters === "string" ? { search: queryOrFilters } : (queryOrFilters || {});
    const conditions = [];
    if (filters.search?.trim()) {
      const normalizedQuery = normalizeCompanyName(filters.search);
      const pattern = `%${filters.search.trim()}%`;
      const normalizedPattern = `%${normalizedQuery}%`;
      conditions.push(
        or(
          ilike(companies.name, pattern),
          ilike(companies.legalName, pattern),
          ilike(companies.officialWebsite, pattern),
          ilike(companies.normalizedName, normalizedPattern)
        )
      );
    }
    if (filters.country?.trim()) conditions.push(eq(companies.country, filters.country.trim()));
    if (filters.companyType?.trim()) conditions.push(eq(companies.companyType, filters.companyType.trim()));
    if (filters.status?.trim()) conditions.push(eq(companies.status, filters.status.trim()));
    if (filters.dncStatus?.trim()) conditions.push(eq(companies.dncStatus, filters.dncStatus.trim()));
    if (filters.verificationStatus?.trim()) conditions.push(eq(companies.verificationStatus, filters.verificationStatus.trim()));

    const companyRows = conditions.length > 0
      ? await db.select().from(companies).where(and(...conditions)).orderBy(companies.name)
      : await db.select().from(companies).orderBy(companies.name);

    const linkedByCompanyId = await this.getLinkedExpertsByCompanyId();
    return companyRows.map((company) => ({
      ...company,
      linkedExpertsCount: linkedByCompanyId.get(company.id)?.length || 0,
    }));
  }

  async getCompany(id: number): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyDetail(id: number): Promise<CompanyDetail | undefined> {
    const company = await this.getCompany(id);
    if (!company) return undefined;
    const linkedByCompanyId = await this.getLinkedExpertsByCompanyId(id);
    return {
      company: {
        ...company,
        linkedExpertsCount: linkedByCompanyId.get(company.id)?.length || 0,
      },
      linkedExperts: linkedByCompanyId.get(company.id) || [],
    };
  }

  async createCompany(company: InsertCompany): Promise<Company> {
    if (String(company.verificationStatus || "").toLowerCase() === "verified" && !String(company.officialWebsite || "").trim()) {
      throw new Error("Official website is required for verified companies.");
    }

    const [createdCompany] = await db
      .insert(companies)
      .values({
        ...company,
        normalizedName: normalizeCompanyName(company.name),
        officialWebsite: company.officialWebsite?.trim() || null,
        linkedinUrl: company.linkedinUrl?.trim() || null,
        legalName: company.legalName?.trim() || null,
        industry: company.industry?.trim() || null,
        city: company.city?.trim() || null,
        description: company.description?.trim() || null,
        ownershipNotes: company.ownershipNotes?.trim() || null,
        notes: company.notes?.trim() || null,
        status: company.status || "active",
        dncStatus: company.dncStatus || "none",
        verificationStatus: company.verificationStatus || "unverified",
      })
      .returning();

    return createdCompany;
  }

  async updateCompany(id: number, company: Partial<InsertCompany>): Promise<Company | undefined> {
    if (String(company.verificationStatus || "").toLowerCase() === "verified" && !String(company.officialWebsite || "").trim()) {
      const existing = await this.getCompany(id);
      if (!String(existing?.officialWebsite || "").trim()) {
        throw new Error("Official website is required for verified companies.");
      }
    }

    const updatePayload: Partial<InsertCompany> = {
      ...company,
      ...(company.name !== undefined ? { normalizedName: normalizeCompanyName(company.name) } : {}),
      ...(company.officialWebsite !== undefined ? { officialWebsite: company.officialWebsite?.trim() || null } : {}),
      ...(company.linkedinUrl !== undefined ? { linkedinUrl: company.linkedinUrl?.trim() || null } : {}),
      ...(company.legalName !== undefined ? { legalName: company.legalName?.trim() || null } : {}),
      ...(company.industry !== undefined ? { industry: company.industry?.trim() || null } : {}),
      ...(company.city !== undefined ? { city: company.city?.trim() || null } : {}),
      ...(company.description !== undefined ? { description: company.description?.trim() || null } : {}),
      ...(company.ownershipNotes !== undefined ? { ownershipNotes: company.ownershipNotes?.trim() || null } : {}),
      ...(company.notes !== undefined ? { notes: company.notes?.trim() || null } : {}),
    };

    const [updatedCompany] = await db
      .update(companies)
      .set({
        ...updatePayload,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();
    return updatedCompany || undefined;
  }

  private async getCompanySuggestions(rawCompanyName: string): Promise<CompanySuggestion[]> {
    const normalizedName = normalizeCompanyName(rawCompanyName);
    if (!normalizedName) return [];

    const allCompanies = await db.select().from(companies).orderBy(companies.name);
    const allAliases = await db.select().from(companyAliases);
    const aliasesByCompanyId = new Map<number, typeof allAliases>();
    for (const alias of allAliases) {
      aliasesByCompanyId.set(alias.companyId, [...(aliasesByCompanyId.get(alias.companyId) || []), alias]);
    }

    const rawDomain = extractDomain(rawCompanyName);
    const suggestions: CompanySuggestion[] = [];
    for (const company of allCompanies) {
      const companyDomain = extractDomain(company.officialWebsite);
      const aliasMatch = (aliasesByCompanyId.get(company.id) || []).some((alias) => alias.normalizedAlias === normalizedName);
      let matchReason: CompanySuggestion["matchReason"] | null = null;
      let score = 0;

      if (company.normalizedName === normalizedName) {
        matchReason = "exact_name";
        score = 100;
      } else if (aliasMatch) {
        matchReason = "alias";
        score = 95;
      } else if (rawDomain && companyDomain && rawDomain === companyDomain) {
        matchReason = "website_domain";
        score = 92;
      } else if (
        company.normalizedName.includes(normalizedName) ||
        normalizedName.includes(company.normalizedName)
      ) {
        matchReason = "fuzzy_name";
        score = 75;
      }

      if (matchReason) {
        suggestions.push({ company, matchReason, score });
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  async getExpertCompanyReview(expertId: number): Promise<ExpertCompanyReview | undefined> {
    const expert = await this.getExpert(expertId);
    if (!expert) return undefined;
    const workHistory = normalizeExpertWorkHistory(expert.workHistory) as any[];
    const items: ExpertWorkHistoryCompanyReviewItem[] = [];
    const linkedCompanies: ExpertCompanyReview["linkedCompanies"] = [];

    for (const [index, item] of workHistory.entries()) {
      const rawCompanyName = String(item.rawCompanyName || item.company || "").trim();
      if (!rawCompanyName) continue;
      if (item.companyId) {
        const company = await this.getCompany(Number(item.companyId));
        if (company) linkedCompanies.push({ index, rawCompanyName, company });
        continue;
      }
      const status = COMPANY_LINK_STATUSES.has(item.companyLinkStatus) ? item.companyLinkStatus : "pending_review";
      if (status === "ignored") continue;
      items.push({
        index,
        rawCompanyName,
        companyId: item.companyId || null,
        companyLinkStatus: status,
        reviewedBy: item.reviewedBy || null,
        reviewedAt: item.reviewedAt || null,
        suggestions: await this.getCompanySuggestions(rawCompanyName),
      });
    }

    return { expertId, items, linkedCompanies };
  }

  private async updateExpertWorkHistoryItem(
    expertId: number,
    workHistoryIndex: number,
    updater: (item: any) => any
  ): Promise<Expert | undefined> {
    const expert = await this.getExpert(expertId);
    if (!expert) return undefined;
    const workHistory = normalizeExpertWorkHistory(expert.workHistory) as any[];
    if (!Number.isInteger(workHistoryIndex) || workHistoryIndex < 0 || workHistoryIndex >= workHistory.length) {
      throw new Error("Work history item not found.");
    }

    workHistory[workHistoryIndex] = updater(workHistory[workHistoryIndex]);
    return this.updateExpert(expertId, { workHistory } as Partial<InsertExpert>);
  }

  async linkExpertWorkHistoryCompany(
    expertId: number,
    workHistoryIndex: number,
    companyId: number,
    reviewedBy: number
  ): Promise<Expert | undefined> {
    const company = await this.getCompany(companyId);
    if (!company) throw new Error("Company not found.");
    return this.updateExpertWorkHistoryItem(expertId, workHistoryIndex, (item) => ({
      ...item,
      company: item.company || item.rawCompanyName || company.name,
      rawCompanyName: item.rawCompanyName || item.company || company.name,
      companyId: company.id,
      companyLinkStatus: "linked",
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    }));
  }

  async createCompanyAndLinkExpertWorkHistory(
    expertId: number,
    workHistoryIndex: number,
    company: CreateAndLinkCompanyInput,
    reviewedBy: number
  ): Promise<{ expert: Expert; company: Company } | undefined> {
    const createdCompany = await this.createCompany(company);
    if (company.alias?.trim()) {
      await db.insert(companyAliases).values({
        companyId: createdCompany.id,
        alias: company.alias.trim(),
        normalizedAlias: normalizeCompanyName(company.alias),
      });
    }
    const expert = await this.linkExpertWorkHistoryCompany(expertId, workHistoryIndex, createdCompany.id, reviewedBy);
    return expert ? { expert, company: createdCompany } : undefined;
  }

  async updateExpertWorkHistoryCompanyStatus(
    expertId: number,
    workHistoryIndex: number,
    status: Extract<CompanyLinkStatus, "unclear" | "ignored">,
    reviewedBy: number
  ): Promise<Expert | undefined> {
    return this.updateExpertWorkHistoryItem(expertId, workHistoryIndex, (item) => ({
      ...item,
      companyId: null,
      companyLinkStatus: status,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    }));
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
    const org = await this.getClientOrganization(organizationId);
    if (!org) return [];

    const normalizedOrgName = org.name.trim().toLowerCase();
    return db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.clientOrganizationId, organizationId),
          and(
            sql`${projects.clientOrganizationId} IS NULL`,
            sql`lower(trim(${projects.clientName})) = ${normalizedOrgName}`
          ),
          and(
            sql`${projects.clientOrganizationId} IS NULL`,
            sql`lower(trim(coalesce(${projects.clientCompany}, ''))) = ${normalizedOrgName}`
          )
        )
      )
      .orderBy(desc(projects.createdAt));
  }

  async getProjectsByPm(pmId: number): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.createdByPmId, pmId)).orderBy(desc(projects.createdAt));
  }

  async getProjectsByAssignedRa(raId: number): Promise<Project[]> {
    return db
      .select()
      .from(projects)
      .where(
        or(
          eq(projects.assignedRaId, raId),
          sql`${raId} = ANY(${projects.assignedRaIds})`
        )
      )
      .orderBy(desc(projects.createdAt));
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

  async searchExpertsAdvanced(params: {
    query?: string;
    country?: string;
    companyName?: string;
    companyScope?: "current" | "past" | "any";
    currentEmployer?: string;
    pastEmployers?: string;
    minRate?: number;
    maxRate?: number;
    minYearsExperience?: number;
    maxYearsExperience?: number;
    employmentFromMonth?: number;
    employmentFromYear?: number;
    employmentToMonth?: number;
    employmentToYear?: number;
    jobTitle?: string;
    industry?: string;
    language?: string;
    hasPriorProjects?: boolean;
    minAcceptanceRate?: number;
    minHoursWorked?: number;
    availableOnly?: boolean;
    excludeProjectId?: number;
  }): Promise<(Expert & { priorProjectCount?: number; acceptanceRate?: number; matchedWorkHistory?: any[] })[]> {
    const conditions = [];
    
    // 1) Domain Expertise / Skills (Keywords) - search across name, title, skills, bio
    if (params.query) {
      const keywords = params.query.split(/[,\s]+/).filter(k => k.trim());
      if (keywords.length > 0) {
        const keywordConditions = keywords.map(keyword => {
          const searchPattern = `%${keyword.trim()}%`;
          return or(
            ilike(experts.name, searchPattern),
            ilike(experts.expertise, searchPattern),
            sql`array_to_string(${experts.areasOfExpertise}, ',') ILIKE ${searchPattern}`,
            ilike(experts.industry, searchPattern),
            ilike(experts.company, searchPattern),
            ilike(experts.jobTitle, searchPattern),
            ilike(experts.bio, searchPattern)
          );
        });
        // All keywords must match (AND logic within keywords)
        keywordConditions.forEach(cond => conditions.push(cond));
      }
    }
    
    // 2) Industry / Sector - match if expert.industry contains at least one of provided industries
    if (params.industry) {
      const industries = params.industry.split(',').map(i => i.trim().toLowerCase()).filter(i => i);
      if (industries.length > 0) {
        const industryConditions = industries.map(ind => 
          ilike(experts.industry, `%${ind}%`)
        );
        conditions.push(or(...industryConditions));
      }
    }

    if (params.companyName) {
      const companyPattern = `%${params.companyName.trim()}%`;
      const scope = params.companyScope || "any";
      const currentCondition = ilike(experts.company, companyPattern);
      const pastCondition = or(
        sql`array_to_string(${experts.pastEmployers}, ',') ILIKE ${companyPattern}`,
        sql`${experts.workHistory}::text ILIKE ${companyPattern}`
      );
      if (scope === "current") {
        conditions.push(currentCondition);
      } else if (scope === "past") {
        conditions.push(pastCondition);
      } else {
        conditions.push(or(currentCondition, pastCondition));
      }
    }
    
    // 3) Current Employer - partial, case-insensitive match
    if (params.currentEmployer) {
      const employerPattern = `%${params.currentEmployer.trim()}%`;
      conditions.push(ilike(experts.company, employerPattern));
    }
    
    // 4) Past Employers - match if any provided name appears in pastEmployers array or JSON work history
    if (params.pastEmployers) {
      const pastEmps = params.pastEmployers.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
      if (pastEmps.length > 0) {
        const pastEmpConditions = pastEmps.map(emp =>
          or(
            sql`array_to_string(${experts.pastEmployers}, ',') ILIKE ${'%' + emp + '%'}`,
            sql`${experts.workHistory}::text ILIKE ${'%' + emp + '%'}`
          )
        );
        conditions.push(or(...pastEmpConditions));
      }
    }
    
    // 5) Role / Seniority (Job Title) - partial, case-insensitive match
    if (params.jobTitle) {
      const titlePattern = `%${params.jobTitle}%`;
      conditions.push(ilike(experts.jobTitle, titlePattern));
    }
    
    // 6) Geography / Location - match country, city, or timezone
    if (params.country) {
      const locations = params.country.split(',').map(l => l.trim().toLowerCase()).filter(l => l);
      if (locations.length > 0) {
        const locationConditions = locations.map(loc => {
          const locPattern = `%${loc}%`;
          return or(
            ilike(experts.country, locPattern),
            ilike(experts.city, locPattern),
            ilike(experts.timezone, locPattern)
          );
        });
        conditions.push(or(...locationConditions));
      }
    }
    
    // 7) Experience Level - min/max years
    if (params.minYearsExperience !== undefined) {
      conditions.push(sql`${experts.yearsOfExperience} >= ${params.minYearsExperience}`);
    }
    if (params.maxYearsExperience !== undefined) {
      conditions.push(sql`${experts.yearsOfExperience} <= ${params.maxYearsExperience}`);
    }
    
    // 8) Language - match if languages array contains at least one of provided languages
    if (params.language) {
      const langs = params.language.split(',').map(l => l.trim().toLowerCase()).filter(l => l);
      if (langs.length > 0) {
        const langConditions = langs.map(lang =>
          sql`array_to_string(${experts.languages}, ',') ILIKE ${'%' + lang + '%'}`
        );
        conditions.push(or(...langConditions));
      }
    }
    
    // Rate filters (kept for backwards compatibility)
    if (params.minRate !== undefined) {
      conditions.push(sql`CAST(${experts.hourlyRate} AS DECIMAL) >= ${params.minRate}`);
    }
    if (params.maxRate !== undefined) {
      conditions.push(sql`CAST(${experts.hourlyRate} AS DECIMAL) <= ${params.maxRate}`);
    }
    
    // Get base experts
    let baseExperts: Expert[];
    if (conditions.length === 0) {
      baseExperts = await db.select().from(experts).orderBy(experts.name);
    } else {
      baseExperts = await db
        .select()
        .from(experts)
        .where(and(...conditions))
        .orderBy(experts.name);
    }

    const monthToIndex = (year?: number | null, month?: number | null, fallbackMonth = 1) => {
      if (!year || !Number.isFinite(Number(year))) return null;
      const normalizedMonth = Number.isFinite(Number(month)) ? Number(month) : fallbackMonth;
      return Number(year) * 12 + Math.min(Math.max(normalizedMonth, 1), 12) - 1;
    };
    const normalizeHistory = (history: unknown) =>
      Array.isArray(history)
        ? history.map((item: any) => ({
            company: String(item?.company || ""),
            jobTitle: String(item?.jobTitle || ""),
            fromMonth: Number(item?.fromMonth || 1),
            fromYear: Number(item?.fromYear || 0),
            toMonth: Number(item?.toMonth || 12),
            toYear: Number(item?.toYear || 0),
            isCurrent: item?.isCurrent === true,
          }))
        : [];
    const employerTerms = (value?: string) =>
      value?.split(',').map((term) => term.trim().toLowerCase()).filter(Boolean) || [];
    const companyTerms = employerTerms(params.companyName);
    const companyScope = params.companyScope || "any";
    const currentEmployerTerms = companyTerms.length > 0 && companyScope !== "past"
      ? companyTerms
      : employerTerms(params.currentEmployer);
    const pastEmployerTerms = companyTerms.length > 0 && companyScope !== "current"
      ? companyTerms
      : employerTerms(params.pastEmployers);
    const hasEmploymentRange =
      params.employmentFromYear !== undefined &&
      params.employmentFromMonth !== undefined &&
      params.employmentToYear !== undefined &&
      params.employmentToMonth !== undefined &&
      (currentEmployerTerms.length > 0 || pastEmployerTerms.length > 0);
    const rangeStart = hasEmploymentRange ? monthToIndex(params.employmentFromYear, params.employmentFromMonth, 1) : null;
    const rangeEnd = hasEmploymentRange ? monthToIndex(params.employmentToYear, params.employmentToMonth, 12) : null;
    const currentMonthIndex = new Date().getFullYear() * 12 + new Date().getMonth();
    const overlapsRange = (item: any) => {
      if (!hasEmploymentRange || rangeStart === null || rangeEnd === null) return true;
      const start = monthToIndex(item.fromYear, item.fromMonth, 1);
      if (start === null) return false;
      const end = item.isCurrent ? currentMonthIndex : monthToIndex(item.toYear, item.toMonth, 12) ?? start;
      return start <= rangeEnd && end >= rangeStart;
    };
    const matchesTerms = (company: string | null | undefined, terms: string[]) => {
      if (terms.length === 0) return false;
      const normalizedCompany = String(company || "").toLowerCase();
      return terms.some((term) => normalizedCompany.includes(term));
    };

    // Compute metrics for each expert (prior projects + acceptance rate)
    const expertsWithMetrics = await Promise.all(
      baseExperts.map(async (expert) => {
        const projectAssignments = await db
          .select()
          .from(projectExperts)
          .where(eq(projectExperts.expertId, expert.id));

        // Filter out current project if excludeProjectId is set
        const relevantAssignments = params.excludeProjectId
          ? projectAssignments.filter(pa => pa.projectId !== params.excludeProjectId)
          : projectAssignments;

        const priorProjectCount = relevantAssignments.length;

        // Calculate acceptance rate: accepted / (accepted + declined)
        const invitedCount = relevantAssignments.filter(
          pa => pa.invitationStatus === 'accepted' || pa.invitationStatus === 'declined'
        ).length;
        const acceptedCount = relevantAssignments.filter(
          pa => pa.invitationStatus === 'accepted'
        ).length;
        const acceptanceRate = invitedCount > 0 ? Math.round((acceptedCount / invitedCount) * 100) : null;

        const history = normalizeHistory(expert.workHistory);
        const currentMatches = currentEmployerTerms.length > 0 && matchesTerms(expert.company, currentEmployerTerms)
          ? [
              {
                company: expert.company || "",
                jobTitle: expert.jobTitle || "",
                fromMonth: 1,
                fromYear: expert.yearsOfExperience
                  ? new Date().getFullYear() - expert.yearsOfExperience
                  : undefined,
                toMonth: new Date().getMonth() + 1,
                toYear: new Date().getFullYear(),
                isCurrent: true,
              },
              ...history.filter((item) => item.isCurrent && matchesTerms(item.company, currentEmployerTerms)),
            ].filter(overlapsRange)
          : [];
        const pastMatches = pastEmployerTerms.length > 0
          ? history.filter((item) => matchesTerms(item.company, pastEmployerTerms) && !item.isCurrent && overlapsRange(item))
          : [];

        return {
          ...expert,
          priorProjectCount,
          acceptanceRate: acceptanceRate ?? undefined,
          matchedWorkHistory: [...currentMatches, ...pastMatches],
        };
      })
    );

    // Apply post-fetch filters
    let filtered = expertsWithMetrics;

    // 9) Availability - filter by availableNow or nextAvailableDate within 7 days
    if (params.availableOnly) {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      
      filtered = filtered.filter(e => {
        if (e.availableNow === true) return true;
        if (e.nextAvailableDate && new Date(e.nextAvailableDate) <= sevenDaysFromNow) return true;
        // Also check status for backwards compatibility
        return e.status === 'available';
      });
    }

    // 10a) Past Engagements - minimum hours worked
    if (params.minHoursWorked !== undefined) {
      filtered = filtered.filter(e => {
        const hours = e.totalHoursWorked ? parseFloat(e.totalHoursWorked) : 0;
        return hours >= params.minHoursWorked!;
      });
    }

    // 10b) Past Engagements - only show experts with prior project involvement
    if (params.hasPriorProjects) {
      filtered = filtered.filter(e => (e.priorProjectCount ?? 0) > 0);
    }

    if (params.minAcceptanceRate !== undefined) {
      filtered = filtered.filter(
        e => e.acceptanceRate !== undefined && e.acceptanceRate >= params.minAcceptanceRate!
      );
    }

    if (hasEmploymentRange) {
      filtered = filtered.filter((e) => (e.matchedWorkHistory?.length ?? 0) > 0);
    }

    return filtered;
  }

  async createExpert(expert: InsertExpert): Promise<Expert> {
    const [newExpert] = await db
      .insert(experts)
      .values({
        ...expert,
        workHistory: normalizeExpertWorkHistory(expert.workHistory),
      })
      .returning();
    return newExpert;
  }

  async updateExpert(id: number, expert: Partial<InsertExpert>): Promise<Expert | undefined> {
    const [updated] = await db
      .update(experts)
      .set({
        ...expert,
        ...(expert.workHistory !== undefined ? { workHistory: normalizeExpertWorkHistory(expert.workHistory) } : {}),
      })
      .where(eq(experts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteExpert(id: number): Promise<boolean> {
    const result = await db.delete(experts).where(eq(experts.id, id)).returning();
    return result.length > 0;
  }

  // Project Angles
  async getProjectAngles(projectId: number): Promise<ProjectAngle[]> {
    return db
      .select()
      .from(projectAngles)
      .where(eq(projectAngles.projectId, projectId))
      .orderBy(projectAngles.orderIndex);
  }

  async getProjectAngle(id: number): Promise<ProjectAngle | undefined> {
    const [angle] = await db.select().from(projectAngles).where(eq(projectAngles.id, id));
    return angle || undefined;
  }

  async createProjectAngle(angle: InsertProjectAngle): Promise<ProjectAngle> {
    const now = new Date();
    const [newAngle] = await db.insert(projectAngles).values({
      ...angle,
      createdAt: now,
      updatedAt: now,
    } as any).returning();
    return newAngle;
  }

  async updateProjectAngle(id: number, angle: Partial<InsertProjectAngle>): Promise<ProjectAngle | undefined> {
    const [updated] = await db
      .update(projectAngles)
      .set({ ...angle, updatedAt: new Date() })
      .where(eq(projectAngles.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProjectAngle(id: number): Promise<boolean> {
    const result = await db.delete(projectAngles).where(eq(projectAngles.id, id)).returning();
    return result.length > 0;
  }

  async reorderProjectAngles(projectId: number, angleIds: number[]): Promise<ProjectAngle[]> {
    const updates = angleIds.map((id, index) =>
      db.update(projectAngles)
        .set({ orderIndex: index, updatedAt: new Date() })
        .where(and(eq(projectAngles.id, id), eq(projectAngles.projectId, projectId)))
        .returning()
    );
    const results = await Promise.all(updates);
    return results.flat();
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

  async getVettingQuestionsByAngle(angleId: number): Promise<VettingQuestion[]> {
    return db
      .select()
      .from(vettingQuestions)
      .where(eq(vettingQuestions.angleId, angleId))
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

  async deleteVettingQuestionsByAngle(angleId: number): Promise<boolean> {
    const result = await db.delete(vettingQuestions).where(eq(vettingQuestions.angleId, angleId)).returning();
    return result.length >= 0;
  }

  // Project Experts
  async getProjectExperts(): Promise<ProjectExpert[]> {
    return db.select().from(projectExperts).orderBy(desc(projectExperts.assignedAt));
  }

  async getProjectExpert(id: number): Promise<ProjectExpert | undefined> {
    const [pe] = await db.select().from(projectExperts).where(eq(projectExperts.id, id));
    return pe || undefined;
  }

  async getProjectExpertByToken(token: string): Promise<ProjectExpert | undefined> {
    const [pe] = await db.select().from(projectExperts).where(eq(projectExperts.invitationToken, token));
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

  async createProjectExpertsBulk(assignments: InsertProjectExpert[]): Promise<ProjectExpert[]> {
    if (assignments.length === 0) return [];
    return db.insert(projectExperts).values(assignments as any[]).returning();
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

  async getCuLedgerRows(filters: CuLedgerFilters): Promise<CuLedgerRow[]> {
    const conditions = [eq(callRecords.status, "completed")];

    if (filters.startDate) conditions.push(gte(callRecords.callDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(callRecords.callDate, filters.endDate));
    if (filters.projectId) conditions.push(eq(callRecords.projectId, filters.projectId));
    if (filters.expertId) conditions.push(eq(callRecords.expertId, filters.expertId));
    if (filters.pmId) conditions.push(eq(callRecords.pmId, filters.pmId));
    if (filters.raId) conditions.push(eq(callRecords.raId, filters.raId));
    if (filters.clientOrganizationId) {
      conditions.push(eq(projects.clientOrganizationId, filters.clientOrganizationId));
    }

    const rows = await db
      .select({
        callRecordId: callRecords.id,
        callDate: callRecords.callDate,
        projectId: callRecords.projectId,
        projectName: projects.name,
        clientName: projects.clientName,
        clientCompany: projects.clientCompany,
        clientOrganizationId: projects.clientOrganizationId,
        expertId: callRecords.expertId,
        expertName: experts.name,
        pmId: callRecords.pmId,
        raId: callRecords.raId,
        durationMinutes: callRecords.durationMinutes,
        actualDurationMinutes: callRecords.actualDurationMinutes,
        cuUsed: callRecords.cuUsed,
        completedAt: callRecords.completedAt,
        recordingUrl: callRecords.recordingUrl,
      })
      .from(callRecords)
      .innerJoin(projects, eq(callRecords.projectId, projects.id))
      .innerJoin(experts, eq(callRecords.expertId, experts.id))
      .where(and(...conditions))
      .orderBy(desc(callRecords.callDate), desc(callRecords.completedAt));

    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.pmId, row.raId])
          .filter((id): id is number => typeof id === "number")
      )
    );
    const ledgerUsers = userIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIds))
      : [];
    const userById = new Map(ledgerUsers.map((user) => [user.id, user]));

    return rows.map((row) => ({
      callRecordId: row.callRecordId,
      callDate: row.callDate,
      projectId: row.projectId,
      projectName: row.projectName,
      clientName: row.clientName || row.clientCompany || "-",
      clientOrganizationId: row.clientOrganizationId,
      expertId: row.expertId,
      expertName: row.expertName,
      pmId: row.pmId,
      pmName: row.pmId ? userById.get(row.pmId)?.fullName || userById.get(row.pmId)?.email || null : null,
      raId: row.raId,
      raName: row.raId ? userById.get(row.raId)?.fullName || userById.get(row.raId)?.email || null : null,
      durationMinutes: row.durationMinutes,
      actualDurationMinutes: row.actualDurationMinutes,
      cuUsed: row.cuUsed,
      completedAt: row.completedAt,
      recordingUrl: row.recordingUrl,
      source: "Completed Call Record",
    }));
  }

  async getOperationsAnalytics(filters: OperationsAnalyticsFilters): Promise<OperationsAnalytics> {
    const granularity = filters.granularity || "month";
    const round = (value: number) => Math.round(value * 100) / 100;
    const formatPeriod = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      if (granularity === "day") return `${year}-${month}-${day}`;
      if (granularity === "week") {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - start.getDay());
        const startMonth = String(start.getMonth() + 1).padStart(2, "0");
        const startDay = String(start.getDate()).padStart(2, "0");
        return `${start.getFullYear()}-${startMonth}-${startDay}`;
      }
      return `${year}-${month}`;
    };

    const allProjects = await db.select().from(projects);
    const activeProjects = allProjects.filter(
      (project) => project.status !== "completed" && project.status !== "cancelled"
    ).length;
    const projectPipelineMap = new Map<string, number>();
    allProjects.forEach((project) => {
      projectPipelineMap.set(project.status, (projectPipelineMap.get(project.status) || 0) + 1);
    });

    const conditions = [eq(callRecords.status, "completed")];
    if (filters.startDate) conditions.push(gte(callRecords.callDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(callRecords.callDate, filters.endDate));

    const completedRows = await db
      .select({
        callRecordId: callRecords.id,
        callDate: callRecords.callDate,
        projectId: callRecords.projectId,
        projectName: projects.name,
        industry: projects.industry,
        expertId: callRecords.expertId,
        expertName: experts.name,
        pmId: callRecords.pmId,
        durationMinutes: callRecords.durationMinutes,
        actualDurationMinutes: callRecords.actualDurationMinutes,
        cuUsed: callRecords.cuUsed,
      })
      .from(callRecords)
      .innerJoin(projects, eq(callRecords.projectId, projects.id))
      .innerJoin(experts, eq(callRecords.expertId, experts.id))
      .where(and(...conditions));

    const pmIds = Array.from(
      new Set(completedRows.map((row) => row.pmId).filter((id): id is number => typeof id === "number"))
    );
    const pmUsers = pmIds.length > 0
      ? await db.select().from(users).where(inArray(users.id, pmIds))
      : [];
    const pmById = new Map(pmUsers.map((user) => [user.id, user]));

    const callsOverTimeMap = new Map<string, { completedCalls: number; cuUsed: number }>();
    const cuByIndustryMap = new Map<string, { cuUsed: number; completedCalls: number }>();
    const cuByProjectMap = new Map<number, { projectId: number; projectName: string; cuUsed: number; completedCalls: number }>();
    const callsByExpertMap = new Map<number, { expertId: number; expertName: string; completedCalls: number; cuUsed: number }>();
    const callsByPmMap = new Map<string, { pmId: number | null; pmName: string; completedCalls: number; cuUsed: number }>();

    let totalCUUsed = 0;
    let totalCompletedMinutes = 0;

    completedRows.forEach((row) => {
      const cuUsed = Number(row.cuUsed || 0);
      const duration = row.actualDurationMinutes || row.durationMinutes || 0;
      totalCUUsed += cuUsed;
      totalCompletedMinutes += duration;

      const period = formatPeriod(new Date(row.callDate));
      const periodBucket = callsOverTimeMap.get(period) || { completedCalls: 0, cuUsed: 0 };
      periodBucket.completedCalls += 1;
      periodBucket.cuUsed += cuUsed;
      callsOverTimeMap.set(period, periodBucket);

      const industry = row.industry || "Unspecified";
      const industryBucket = cuByIndustryMap.get(industry) || { completedCalls: 0, cuUsed: 0 };
      industryBucket.completedCalls += 1;
      industryBucket.cuUsed += cuUsed;
      cuByIndustryMap.set(industry, industryBucket);

      const projectBucket = cuByProjectMap.get(row.projectId) || {
        projectId: row.projectId,
        projectName: row.projectName,
        completedCalls: 0,
        cuUsed: 0,
      };
      projectBucket.completedCalls += 1;
      projectBucket.cuUsed += cuUsed;
      cuByProjectMap.set(row.projectId, projectBucket);

      const expertBucket = callsByExpertMap.get(row.expertId) || {
        expertId: row.expertId,
        expertName: row.expertName,
        completedCalls: 0,
        cuUsed: 0,
      };
      expertBucket.completedCalls += 1;
      expertBucket.cuUsed += cuUsed;
      callsByExpertMap.set(row.expertId, expertBucket);

      const pmKey = row.pmId ? String(row.pmId) : "unassigned";
      const pm = row.pmId ? pmById.get(row.pmId) : null;
      const pmBucket = callsByPmMap.get(pmKey) || {
        pmId: row.pmId,
        pmName: pm?.fullName || pm?.email || "Unassigned",
        completedCalls: 0,
        cuUsed: 0,
      };
      pmBucket.completedCalls += 1;
      pmBucket.cuUsed += cuUsed;
      callsByPmMap.set(pmKey, pmBucket);
    });

    const sortByCu = <T extends { cuUsed: number }>(items: T[]) =>
      items.sort((a, b) => b.cuUsed - a.cuUsed);

    return {
      summary: {
        activeProjects,
        completedCalls: completedRows.length,
        totalCUUsed: round(totalCUUsed),
        totalCompletedMinutes,
        avgCUPerCall: completedRows.length > 0 ? round(totalCUUsed / completedRows.length) : 0,
      },
      charts: {
        callsOverTime: Array.from(callsOverTimeMap.entries())
          .map(([period, data]) => ({
            period,
            completedCalls: data.completedCalls,
            cuUsed: round(data.cuUsed),
          }))
          .sort((a, b) => a.period.localeCompare(b.period)),
        cuByIndustry: sortByCu(
          Array.from(cuByIndustryMap.entries()).map(([industry, data]) => ({
            industry,
            completedCalls: data.completedCalls,
            cuUsed: round(data.cuUsed),
          }))
        ),
        cuByProject: sortByCu(
          Array.from(cuByProjectMap.values()).map((data) => ({
            ...data,
            cuUsed: round(data.cuUsed),
          }))
        ),
        completedCallsByExpert: sortByCu(
          Array.from(callsByExpertMap.values()).map((data) => ({
            ...data,
            cuUsed: round(data.cuUsed),
          }))
        ).slice(0, 10),
        completedCallsByPM: sortByCu(
          Array.from(callsByPmMap.values()).map((data) => ({
            ...data,
            cuUsed: round(data.cuUsed),
          }))
        ).slice(0, 10),
        projectPipeline: Array.from(projectPipelineMap.entries())
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => a.status.localeCompare(b.status)),
      },
    };
  }

  async getPmPerformance(filters: PmPerformanceFilters): Promise<PmPerformanceReport> {
    const round = (value: number) => Math.round(value * 100) / 100;
    const sortBy = filters.sortBy || "totalCUUsed";
    const order = filters.order || "desc";
    const limit = Math.max(1, Math.min(filters.limit || 50, 100));
    const offset = Math.max(0, filters.offset || 0);
    const normalizedSearch = filters.search?.trim().toLowerCase();
    const activeStatuses = new Set(["new", "sourcing", "shortlisted", "confirmed"]);

    const allUsers = await db.select().from(users);
    const pmUsers = allUsers.filter((user) => {
      const role = user.role.toLowerCase();
      const isPm = role === "pm" || role === "project manager";
      if (!isPm) return false;
      if (!normalizedSearch) return true;
      return (
        user.fullName.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch)
      );
    });
    const pmById = new Map(pmUsers.map((user) => [user.id, user]));

    const rowsByPm = new Map<number, PmPerformanceRow & { requestProjectIds: Set<number> }>();
    pmUsers.forEach((pm) => {
      rowsByPm.set(pm.id, {
        pmId: pm.id,
        pmName: pm.fullName,
        pmEmail: pm.email,
        activeProjects: 0,
        requestsHandled: 0,
        completedCalls: 0,
        totalCUUsed: 0,
        cuPerRequest: 0,
        callsPerRequest: 0,
        totalCompletedMinutes: 0,
        avgCUPerCall: 0,
        signalsCaptured: 0,
        lastCompletedCallDate: null,
        requestProjectIds: new Set<number>(),
      });
    });

    const allProjects = await db.select().from(projects);
    allProjects.forEach((project) => {
      if (!project.createdByPmId || !activeStatuses.has(project.status)) return;
      const row = rowsByPm.get(project.createdByPmId);
      if (row) row.activeProjects += 1;
    });

    const conditions = [eq(callRecords.status, "completed")];
    if (filters.startDate) conditions.push(gte(callRecords.callDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(callRecords.callDate, filters.endDate));

    const completedRows = await db
      .select({
        callRecordId: callRecords.id,
        projectId: callRecords.projectId,
        pmId: callRecords.pmId,
        callDate: callRecords.callDate,
        durationMinutes: callRecords.durationMinutes,
        actualDurationMinutes: callRecords.actualDurationMinutes,
        cuUsed: callRecords.cuUsed,
      })
      .from(callRecords)
      .where(and(...conditions));

    completedRows.forEach((call) => {
      if (!call.pmId || !pmById.has(call.pmId)) return;
      const row = rowsByPm.get(call.pmId);
      if (!row) return;

      const cuUsed = Number(call.cuUsed || 0);
      const completedMinutes = call.actualDurationMinutes || call.durationMinutes || 0;
      row.completedCalls += 1;
      row.totalCUUsed += cuUsed;
      row.totalCompletedMinutes += completedMinutes;
      row.requestProjectIds.add(call.projectId);

      if (!row.lastCompletedCallDate || call.callDate > row.lastCompletedCallDate) {
        row.lastCompletedCallDate = call.callDate;
      }
    });

    const signalConditions = [eq(callRecords.status, "completed")];
    if (filters.startDate) signalConditions.push(gte(callRecords.callDate, filters.startDate));
    if (filters.endDate) signalConditions.push(lte(callRecords.callDate, filters.endDate));

    const signalRows = await db
      .select({
        pmId: callRecords.pmId,
        insightId: insights.id,
      })
      .from(insights)
      .innerJoin(callRecords, eq(insights.callRecordId, callRecords.id))
      .where(and(...signalConditions));

    signalRows.forEach((signal) => {
      if (!signal.pmId || !pmById.has(signal.pmId)) return;
      const row = rowsByPm.get(signal.pmId);
      if (row) row.signalsCaptured += 1;
    });

    const rows = Array.from(rowsByPm.values()).map(({ requestProjectIds, ...row }) => {
      const requestsHandled = requestProjectIds.size;
      const completedCalls = row.completedCalls;
      const totalCUUsed = round(row.totalCUUsed);

      return {
        ...row,
        requestsHandled,
        totalCUUsed,
        cuPerRequest: requestsHandled > 0 ? round(row.totalCUUsed / requestsHandled) : 0,
        callsPerRequest: requestsHandled > 0 ? round(completedCalls / requestsHandled) : 0,
        totalCompletedMinutes: row.totalCompletedMinutes,
        avgCUPerCall: completedCalls > 0 ? round(row.totalCUUsed / completedCalls) : 0,
      };
    });

    rows.sort((a, b) => {
      const aValue = a[sortBy] || 0;
      const bValue = b[sortBy] || 0;
      const comparison = aValue === bValue ? a.pmName.localeCompare(b.pmName) : aValue - bValue;
      return order === "asc" ? comparison : -comparison;
    });

    const summaryRows = rows;
    const totalCUUsed = summaryRows.reduce((sum, row) => sum + row.totalCUUsed, 0);
    const completedCalls = summaryRows.reduce((sum, row) => sum + row.completedCalls, 0);
    const requestsHandled = summaryRows.reduce((sum, row) => sum + row.requestsHandled, 0);

    return {
      summary: {
        totalPMs: rows.length,
        requestsHandled,
        completedCalls,
        totalCUUsed: round(totalCUUsed),
      },
      pagination: {
        total: rows.length,
        limit,
        offset,
      },
      rows: rows.slice(offset, offset + limit),
    };
  }

  async createCallRecord(record: InsertCallRecord): Promise<CallRecord> {
    const shouldCountCu = record.status === "completed";
    const cuUsed = shouldCountCu ? calculateCU(record.durationMinutes) : 0;
    const [newRecord] = await db.insert(callRecords).values({
      ...record,
      cuUsed: cuUsed.toString(),
    }).returning();

    if (shouldCountCu && cuUsed > 0) {
      await db.update(projects).set({
        totalCuUsed: sql`COALESCE(${projects.totalCuUsed}, 0) + ${cuUsed}`,
      }).where(eq(projects.id, record.projectId));
    }
    
    return newRecord;
  }

  /**
   * Update a call record.
   * If cuUsed is explicitly provided, use that value (manual override).
   * If only durationMinutes is provided, auto-calculate cuUsed.
   * CU formula: ceil(durationMinutes / 15) * 0.25
   */
  async updateCallRecord(id: number, record: Partial<InsertCallRecord> & { cuUsed?: string }): Promise<CallRecord | undefined> {
    const existing = await this.getCallRecord(id);
    if (!existing) return undefined;
    
    let updateData: any = { ...record };
    
    // Only auto-calculate CU if cuUsed is NOT explicitly provided
    if (record.durationMinutes !== undefined && record.cuUsed === undefined) {
      updateData.cuUsed = calculateCU(record.durationMinutes).toString();
    }
    // If cuUsed is explicitly provided, use it as-is (manual override)
    
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

  async getBillableUsage(filters: BillableUsageFilters): Promise<BillableUsageReport> {
    const conditions = [];
    if (filters.startDate) conditions.push(gte(billableUsage.callDate, filters.startDate));
    if (filters.endDate) conditions.push(lte(billableUsage.callDate, filters.endDate));
    if (filters.status && filters.status !== "all") conditions.push(eq(billableUsage.status, filters.status));
    if (filters.clientOrganizationId) {
      conditions.push(
        or(
          eq(billableUsage.clientOrganizationId, filters.clientOrganizationId),
          and(
            sql`${billableUsage.clientOrganizationId} IS NULL`,
            eq(projects.clientOrganizationId, filters.clientOrganizationId)
          )
        )
      );
    }
    if (filters.projectId) conditions.push(eq(billableUsage.projectId, filters.projectId));

    const query = db
      .select({
        id: billableUsage.id,
        callRecordId: billableUsage.callRecordId,
        billableUsageClientOrganizationId: billableUsage.clientOrganizationId,
        projectClientOrganizationId: projects.clientOrganizationId,
        clientOrganizationName: clientOrganizations.name,
        projectClientName: projects.clientName,
        projectClientCompany: projects.clientCompany,
        projectId: billableUsage.projectId,
        projectName: projects.name,
        expertId: billableUsage.expertId,
        expertName: experts.name,
        callDate: billableUsage.callDate,
        cuUsed: billableUsage.cuUsed,
        currency: billableUsage.currency,
        cuRate: billableUsage.cuRate,
        amount: billableUsage.amount,
        status: billableUsage.status,
        source: billableUsage.source,
        adjustmentReason: billableUsage.adjustmentReason,
        createdAt: billableUsage.createdAt,
        updatedAt: billableUsage.updatedAt,
      })
      .from(billableUsage)
      .innerJoin(projects, eq(billableUsage.projectId, projects.id))
      .innerJoin(experts, eq(billableUsage.expertId, experts.id))
      .leftJoin(clientOrganizations, eq(billableUsage.clientOrganizationId, clientOrganizations.id));

    const rows = await (conditions.length > 0 ? query.where(and(...conditions)) : query)
      .orderBy(desc(billableUsage.callDate), desc(billableUsage.createdAt));

    const mappedRows: BillableUsageRow[] = rows.map((row) => {
      const resolvedClientOrganizationId =
        row.billableUsageClientOrganizationId ?? row.projectClientOrganizationId ?? null;
      const clientLinkSource = row.billableUsageClientOrganizationId
        ? "billable_usage"
        : row.projectClientOrganizationId
          ? "project"
          : "fallback";

      return {
        id: row.id,
        callRecordId: row.callRecordId,
        clientOrganizationId: resolvedClientOrganizationId,
        billableUsageClientOrganizationId: row.billableUsageClientOrganizationId,
        projectClientOrganizationId: row.projectClientOrganizationId,
        clientLinkSource,
        activeInvoiceId: null,
        activeInvoiceStatus: null,
        clientName: row.clientOrganizationName || row.projectClientName || row.projectClientCompany || "-",
        projectId: row.projectId,
        projectName: row.projectName,
        expertId: row.expertId,
        expertName: row.expertName,
        callDate: row.callDate,
        cuUsed: row.cuUsed,
        currency: row.currency,
        cuRate: row.cuRate,
        amount: row.amount,
        status: row.status,
        source: row.source,
        adjustmentReason: row.adjustmentReason,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });

    const billableUsageIds = mappedRows.map((row) => row.id);
    if (billableUsageIds.length > 0) {
      const activeInvoiceLinks = await db
        .select({
          billableUsageId: invoiceLineItems.billableUsageId,
          invoiceId: invoices.id,
          invoiceStatus: invoices.status,
        })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
        .where(
          and(
            inArray(invoiceLineItems.billableUsageId, billableUsageIds),
            sql`lower(trim(${invoices.status})) <> 'canceled'`
          )
        );
      const activeInvoiceByBillableUsageId = new Map(
        activeInvoiceLinks.map((link) => [link.billableUsageId, link])
      );
      for (const row of mappedRows) {
        const activeInvoice = activeInvoiceByBillableUsageId.get(row.id);
        if (!activeInvoice) continue;
        row.activeInvoiceId = activeInvoice.invoiceId;
        row.activeInvoiceStatus = activeInvoice.invoiceStatus;
      }
    }

    const round = (value: number) => Math.round(value * 100) / 100;
    const totalCU = mappedRows.reduce((sum, row) => sum + Number(row.cuUsed || 0), 0);
    const billableAmount = mappedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const missingRateItems = mappedRows.filter((row) => !row.cuRate || Number(row.cuRate) <= 0).length;

    return {
      summary: {
        unbilledItems: mappedRows.filter((row) => row.status === "unbilled").length,
        totalCU: round(totalCU),
        billableAmount: round(billableAmount),
        missingRateItems,
      },
      rows: mappedRows,
    };
  }

  async syncBillableUsageForCallRecord(callRecordId: number): Promise<BillableUsage | undefined> {
    const [row] = await db
      .select({
        callRecordId: callRecords.id,
        clientOrganizationId: projects.clientOrganizationId,
        projectId: callRecords.projectId,
        expertId: callRecords.expertId,
        callDate: callRecords.callDate,
        cuUsed: callRecords.cuUsed,
        projectCuRatePerCU: projects.cuRatePerCU,
        defaultCuRate: clientOrganizations.defaultCuRate,
        currency: clientOrganizations.currency,
      })
      .from(callRecords)
      .innerJoin(projects, eq(callRecords.projectId, projects.id))
      .leftJoin(clientOrganizations, eq(projects.clientOrganizationId, clientOrganizations.id))
      .where(and(eq(callRecords.id, callRecordId), eq(callRecords.status, "completed")));

    if (!row) return undefined;

    const round = (value: number) => Math.round(value * 100) / 100;
    const cuUsed = Number(row.cuUsed || 0);
    const projectRate = Number(row.projectCuRatePerCU || 0);
    const clientRate = Number(row.defaultCuRate || 0);
    const rate = projectRate > 0 ? projectRate : clientRate > 0 ? clientRate : null;
    const amount = rate !== null ? round(cuUsed * rate) : null;
    const values = {
      callRecordId: row.callRecordId,
      clientOrganizationId: row.clientOrganizationId,
      projectId: row.projectId,
      expertId: row.expertId,
      callDate: row.callDate,
      cuUsed: row.cuUsed,
      currency: row.currency || "USD",
      cuRate: rate !== null ? rate.toFixed(2) : null,
      amount: amount !== null ? amount.toFixed(2) : null,
      status: "unbilled",
      source: "completed_call_record",
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select()
      .from(billableUsage)
      .where(eq(billableUsage.callRecordId, callRecordId));

    if (existing) {
      if (existing.status !== "unbilled") {
        return existing;
      }
      const [updated] = await db
        .update(billableUsage)
        .set(values)
        .where(and(eq(billableUsage.id, existing.id), eq(billableUsage.status, "unbilled")))
        .returning();
      return updated || existing;
    }

    const [created] = await db
      .insert(billableUsage)
      .values(values)
      .onConflictDoNothing({ target: billableUsage.callRecordId })
      .returning();

    if (created) return created;

    const [conflicted] = await db
      .select()
      .from(billableUsage)
      .where(eq(billableUsage.callRecordId, callRecordId));
    return conflicted;
  }

  async syncBillableUsageFromCompletedCalls(): Promise<BillableUsageSyncResult> {
    const completedRows = await db
      .select({
        callRecordId: callRecords.id,
        clientOrganizationId: projects.clientOrganizationId,
        projectId: callRecords.projectId,
        expertId: callRecords.expertId,
        callDate: callRecords.callDate,
        cuUsed: callRecords.cuUsed,
        projectCuRatePerCU: projects.cuRatePerCU,
        defaultCuRate: clientOrganizations.defaultCuRate,
        currency: clientOrganizations.currency,
      })
      .from(callRecords)
      .innerJoin(projects, eq(callRecords.projectId, projects.id))
      .leftJoin(clientOrganizations, eq(projects.clientOrganizationId, clientOrganizations.id))
      .where(eq(callRecords.status, "completed"));

    if (completedRows.length === 0) {
      return { createdCount: 0, skippedCount: 0 };
    }

    const round = (value: number) => Math.round(value * 100) / 100;
    const insertRows = completedRows.map((row) => {
      const cuUsed = Number(row.cuUsed || 0);
      const projectRate = Number(row.projectCuRatePerCU || 0);
      const clientRate = Number(row.defaultCuRate || 0);
      const rate = projectRate > 0 ? projectRate : clientRate > 0 ? clientRate : null;
      const amount = rate !== null ? round(cuUsed * rate) : null;

      return {
        callRecordId: row.callRecordId,
        clientOrganizationId: row.clientOrganizationId,
        projectId: row.projectId,
        expertId: row.expertId,
        callDate: row.callDate,
        cuUsed: row.cuUsed,
        currency: row.currency || "USD",
        cuRate: rate !== null ? rate.toFixed(2) : null,
        amount: amount !== null ? amount.toFixed(2) : null,
        status: "unbilled",
        source: "completed_call_record",
      };
    });

    const createdRows = await db
      .insert(billableUsage)
      .values(insertRows)
      .onConflictDoNothing({ target: billableUsage.callRecordId })
      .returning();

    const rowsNeedingClientBackfill = await db
      .select({
        id: billableUsage.id,
        clientOrganizationId: projects.clientOrganizationId,
      })
      .from(billableUsage)
      .innerJoin(projects, eq(billableUsage.projectId, projects.id))
      .where(
        and(
          eq(billableUsage.status, "unbilled"),
          sql`${billableUsage.clientOrganizationId} IS NULL`,
          sql`${projects.clientOrganizationId} IS NOT NULL`
        )
      );

    let clientOrganizationBackfilledCount = 0;
    for (const row of rowsNeedingClientBackfill) {
      if (!row.clientOrganizationId) continue;
      const updatedRows = await db
        .update(billableUsage)
        .set({
          clientOrganizationId: row.clientOrganizationId,
          updatedAt: new Date(),
        })
        .where(and(eq(billableUsage.id, row.id), sql`${billableUsage.clientOrganizationId} IS NULL`))
        .returning();
      clientOrganizationBackfilledCount += updatedRows.length;
    }

    return {
      createdCount: createdRows.length,
      skippedCount: completedRows.length - createdRows.length,
      clientOrganizationBackfilledCount,
    };
  }

  async refreshMissingBillableUsageRates(): Promise<BillableUsageRateRefreshResult> {
    const missingRateCondition = or(
      sql`${billableUsage.cuRate} IS NULL`,
      sql`${billableUsage.cuRate} <= 0`
    );
    const protectedMissingRateRows = await db
      .select({ id: billableUsage.id })
      .from(billableUsage)
      .where(
        and(
          missingRateCondition,
          sql`${billableUsage.status} <> 'unbilled'`
        )
      );

    const missingRateRows = await db
      .select({
        id: billableUsage.id,
        cuUsed: billableUsage.cuUsed,
        currentCurrency: billableUsage.currency,
        projectCuRatePerCU: projects.cuRatePerCU,
        defaultCuRate: clientOrganizations.defaultCuRate,
        clientCurrency: clientOrganizations.currency,
      })
      .from(billableUsage)
      .innerJoin(projects, eq(billableUsage.projectId, projects.id))
      .leftJoin(clientOrganizations, eq(billableUsage.clientOrganizationId, clientOrganizations.id))
      .where(
        and(
          eq(billableUsage.status, "unbilled"),
          missingRateCondition
        )
      );

    const round = (value: number) => Math.round(value * 100) / 100;
    let updatedCount = 0;
    let stillMissingRateCount = 0;

    for (const row of missingRateRows) {
      const projectRate = Number(row.projectCuRatePerCU || 0);
      const clientRate = Number(row.defaultCuRate || 0);
      const rate = projectRate > 0 ? projectRate : clientRate > 0 ? clientRate : null;

      if (rate === null) {
        stillMissingRateCount += 1;
        continue;
      }

      const cuUsed = Number(row.cuUsed || 0);
      const amount = round(cuUsed * rate);
      await db
        .update(billableUsage)
        .set({
          cuRate: rate.toFixed(2),
          amount: amount.toFixed(2),
          currency: row.clientCurrency || row.currentCurrency || "USD",
          updatedAt: new Date(),
        })
        .where(eq(billableUsage.id, row.id));
      updatedCount += 1;
    }

    return {
      updatedCount,
      skippedCount: protectedMissingRateRows.length,
      stillMissingRateCount,
    };
  }

  async getInvoices(): Promise<InvoiceListRow[]> {
    const invoiceRows = await db
      .select({
        id: invoices.id,
        draftNumber: invoices.draftNumber,
        invoiceNumber: invoices.invoiceNumber,
        clientOrganizationId: invoices.clientOrganizationId,
        clientName: clientOrganizations.name,
        invoiceDate: invoices.invoiceDate,
        periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
        periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
        currency: invoices.currency,
        subtotal: invoices.subtotal,
        total: invoices.total,
        status: invoices.status,
        notes: invoices.notes,
        issuedAt: invoices.issuedAt,
        issuedByUserId: invoices.issuedByUserId,
        sentAt: invoices.sentAt,
        sentByUserId: invoices.sentByUserId,
        sentMethod: invoices.sentMethod,
        sentRecipientEmail: invoices.sentRecipientEmail,
        sentNotes: invoices.sentNotes,
        paidAt: invoices.paidAt,
        paidByUserId: invoices.paidByUserId,
        paymentMethod: invoices.paymentMethod,
        paymentReferenceNumber: invoices.paymentReferenceNumber,
        paymentNotes: invoices.paymentNotes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
      .orderBy(desc(invoices.createdAt));

    const lineCounts = await db
      .select({
        invoiceId: invoiceLineItems.invoiceId,
        count: sql<number>`count(*)`,
      })
      .from(invoiceLineItems)
      .groupBy(invoiceLineItems.invoiceId);
    const countByInvoiceId = new Map(lineCounts.map((row) => [row.invoiceId, Number(row.count || 0)]));

    return invoiceRows.map((row) => ({
      ...row,
      lineItemCount: countByInvoiceId.get(row.id) || 0,
    }));
  }

  async getInvoiceById(id: number): Promise<InvoiceDetail | undefined> {
    const [invoiceRow] = await db
      .select({
        id: invoices.id,
        draftNumber: invoices.draftNumber,
        invoiceNumber: invoices.invoiceNumber,
        clientOrganizationId: invoices.clientOrganizationId,
        clientName: clientOrganizations.name,
        invoiceDate: invoices.invoiceDate,
        periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
        periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
        currency: invoices.currency,
        subtotal: invoices.subtotal,
        total: invoices.total,
        status: invoices.status,
        notes: invoices.notes,
        issuedAt: invoices.issuedAt,
        issuedByUserId: invoices.issuedByUserId,
        sentAt: invoices.sentAt,
        sentByUserId: invoices.sentByUserId,
        sentMethod: invoices.sentMethod,
        sentRecipientEmail: invoices.sentRecipientEmail,
        sentNotes: invoices.sentNotes,
        paidAt: invoices.paidAt,
        paidByUserId: invoices.paidByUserId,
        paymentMethod: invoices.paymentMethod,
        paymentReferenceNumber: invoices.paymentReferenceNumber,
        paymentNotes: invoices.paymentNotes,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
      })
      .from(invoices)
      .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
      .where(eq(invoices.id, id));

    if (!invoiceRow) return undefined;

    const lineItems = await db
      .select({
        id: invoiceLineItems.id,
        invoiceId: invoiceLineItems.invoiceId,
        billableUsageId: invoiceLineItems.billableUsageId,
        description: invoiceLineItems.description,
        serviceDate: sql<string>`to_char(${invoiceLineItems.serviceDate}, 'YYYY-MM-DD')`,
        projectId: invoiceLineItems.projectId,
        projectName: projects.name,
        expertId: invoiceLineItems.expertId,
        expertName: experts.name,
        cuUsed: invoiceLineItems.cuUsed,
        cuRate: invoiceLineItems.cuRate,
        amount: invoiceLineItems.amount,
        createdAt: invoiceLineItems.createdAt,
      })
      .from(invoiceLineItems)
      .innerJoin(projects, eq(invoiceLineItems.projectId, projects.id))
      .innerJoin(experts, eq(invoiceLineItems.expertId, experts.id))
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(invoiceLineItems.serviceDate, invoiceLineItems.id);

    return {
      invoice: {
        ...invoiceRow,
        lineItemCount: lineItems.length,
      },
      lineItems,
    };
  }

  async createInvoiceDraft(
    billableUsageIds: number[],
    billingPeriod?: { periodStart?: Date | null; periodEnd?: Date | null }
  ): Promise<CreateInvoiceDraftResult> {
    const uniqueIds = Array.from(new Set(billableUsageIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (uniqueIds.length === 0) {
      throw new Error("At least one billable usage item is required.");
    }

    return db.transaction(async (tx) => {
      const selectedRows = await tx
        .select({
          id: billableUsage.id,
          billableUsageClientOrganizationId: billableUsage.clientOrganizationId,
          projectClientOrganizationId: projects.clientOrganizationId,
          clientName: clientOrganizations.name,
          projectId: billableUsage.projectId,
          projectName: projects.name,
          expertId: billableUsage.expertId,
          expertName: experts.name,
          callDate: billableUsage.callDate,
          cuUsed: billableUsage.cuUsed,
          currency: billableUsage.currency,
          cuRate: billableUsage.cuRate,
          amount: billableUsage.amount,
          status: billableUsage.status,
        })
        .from(billableUsage)
        .innerJoin(projects, eq(billableUsage.projectId, projects.id))
        .innerJoin(experts, eq(billableUsage.expertId, experts.id))
        .leftJoin(clientOrganizations, eq(billableUsage.clientOrganizationId, clientOrganizations.id))
        .where(inArray(billableUsage.id, uniqueIds));

      if (selectedRows.length !== uniqueIds.length) {
        throw new Error("One or more selected billable usage items were not found.");
      }

      const resolvedSelectedRows = selectedRows.map((row) => ({
        ...row,
        clientOrganizationId: row.billableUsageClientOrganizationId ?? row.projectClientOrganizationId ?? null,
      }));

      const invalidStatus = resolvedSelectedRows.find((row) => row.status !== "unbilled");
      if (invalidStatus) {
        throw new Error("Only unbilled billable usage items can be added to an invoice draft.");
      }

      const missingClient = resolvedSelectedRows.find((row) => !row.clientOrganizationId);
      if (missingClient) {
        throw new Error("All selected billable usage items must be linked to a client organization.");
      }

      const clientOrganizationId = resolvedSelectedRows[0].clientOrganizationId;
      const mixedClient = resolvedSelectedRows.find((row) => row.clientOrganizationId !== clientOrganizationId);
      if (mixedClient || !clientOrganizationId) {
        throw new Error("All selected billable usage items must belong to the same client organization.");
      }

      const nonUsd = resolvedSelectedRows.find((row) => (row.currency || "USD") !== "USD");
      if (nonUsd) {
        throw new Error("Invoice drafts can only include USD billable usage items.");
      }

      const missingRate = resolvedSelectedRows.find((row) => Number(row.cuRate || 0) <= 0);
      if (missingRate) {
        throw new Error("All selected billable usage items must have a valid USD CU rate.");
      }

      const missingAmount = resolvedSelectedRows.find((row) => Number(row.amount || 0) <= 0);
      if (missingAmount) {
        throw new Error("All selected billable usage items must have a valid USD amount.");
      }

      const existingLineItems = await tx
        .select({
          billableUsageId: invoiceLineItems.billableUsageId,
          invoiceId: invoices.id,
          invoiceStatus: invoices.status,
        })
        .from(invoiceLineItems)
        .innerJoin(invoices, eq(invoiceLineItems.invoiceId, invoices.id))
        .where(
          and(
            inArray(invoiceLineItems.billableUsageId, uniqueIds),
            sql`lower(trim(${invoices.status})) <> 'canceled'`
          )
        );
      if (existingLineItems.length > 0) {
        throw new Error("One or more selected billable usage items are already linked to an active invoice.");
      }

      const round = (value: number) => Math.round(value * 100) / 100;
      const total = round(resolvedSelectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0));
      const fallbackPeriodStart = resolvedSelectedRows.reduce<Date | null>(
        (earliest, row) => (!earliest || row.callDate < earliest ? row.callDate : earliest),
        null
      );
      const fallbackPeriodEnd = resolvedSelectedRows.reduce<Date | null>(
        (latest, row) => (!latest || row.callDate > latest ? row.callDate : latest),
        null
      );
      const periodStart = billingPeriod?.periodStart ?? fallbackPeriodStart;
      const periodEnd = billingPeriod?.periodEnd ?? fallbackPeriodEnd;
      if (periodStart && periodEnd && periodStart > periodEnd) {
        throw new Error("Billing Period Start must be on or before Billing Period End.");
      }
      const now = new Date();
      const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
      const draftNumber = `DRAFT-${dateStamp}-${now.getTime()}`;

      const [createdInvoice] = await tx
        .insert(invoices)
        .values({
          draftNumber,
          clientOrganizationId,
          invoiceDate: now,
          periodStart,
          periodEnd,
          currency: "USD",
          subtotal: total.toFixed(2),
          total: total.toFixed(2),
          status: "draft",
        })
        .returning();

      await tx.insert(invoiceLineItems).values(
        resolvedSelectedRows.map((row) => ({
          invoiceId: createdInvoice.id,
          billableUsageId: row.id,
          description: `${row.projectName} - ${row.expertName}`,
          serviceDate: row.callDate,
          projectId: row.projectId,
          expertId: row.expertId,
          cuUsed: Number(row.cuUsed || 0).toFixed(2),
          cuRate: Number(row.cuRate || 0).toFixed(2),
          amount: Number(row.amount || 0).toFixed(2),
        }))
      );

      const rowsNeedingClientBackfill = resolvedSelectedRows.filter((row) => !row.billableUsageClientOrganizationId);
      for (const row of rowsNeedingClientBackfill) {
        if (!row.clientOrganizationId) continue;
        await tx
          .update(billableUsage)
          .set({
            clientOrganizationId: row.clientOrganizationId,
            updatedAt: new Date(),
          })
          .where(and(eq(billableUsage.id, row.id), sql`${billableUsage.clientOrganizationId} IS NULL`));
      }

      const updatedRows = await tx
        .update(billableUsage)
        .set({
          status: "draft",
          updatedAt: new Date(),
        })
        .where(and(inArray(billableUsage.id, uniqueIds), eq(billableUsage.status, "unbilled")))
        .returning();

      const [invoiceRow] = await tx
        .select({
          id: invoices.id,
          draftNumber: invoices.draftNumber,
          invoiceNumber: invoices.invoiceNumber,
          clientOrganizationId: invoices.clientOrganizationId,
          clientName: clientOrganizations.name,
          invoiceDate: invoices.invoiceDate,
          periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
          periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          total: invoices.total,
          status: invoices.status,
          notes: invoices.notes,
          issuedAt: invoices.issuedAt,
          issuedByUserId: invoices.issuedByUserId,
          sentAt: invoices.sentAt,
          sentByUserId: invoices.sentByUserId,
          sentMethod: invoices.sentMethod,
          sentRecipientEmail: invoices.sentRecipientEmail,
          sentNotes: invoices.sentNotes,
          paidAt: invoices.paidAt,
          paidByUserId: invoices.paidByUserId,
          paymentMethod: invoices.paymentMethod,
          paymentReferenceNumber: invoices.paymentReferenceNumber,
          paymentNotes: invoices.paymentNotes,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
        .where(eq(invoices.id, createdInvoice.id));

      if (!invoiceRow) {
        throw new Error("Invoice draft was created but could not be loaded.");
      }

      const lineItems = await tx
        .select({
          id: invoiceLineItems.id,
          invoiceId: invoiceLineItems.invoiceId,
          billableUsageId: invoiceLineItems.billableUsageId,
          description: invoiceLineItems.description,
          serviceDate: sql<string>`to_char(${invoiceLineItems.serviceDate}, 'YYYY-MM-DD')`,
          projectId: invoiceLineItems.projectId,
          projectName: projects.name,
          expertId: invoiceLineItems.expertId,
          expertName: experts.name,
          cuUsed: invoiceLineItems.cuUsed,
          cuRate: invoiceLineItems.cuRate,
          amount: invoiceLineItems.amount,
          createdAt: invoiceLineItems.createdAt,
        })
        .from(invoiceLineItems)
        .innerJoin(projects, eq(invoiceLineItems.projectId, projects.id))
        .innerJoin(experts, eq(invoiceLineItems.expertId, experts.id))
        .where(eq(invoiceLineItems.invoiceId, createdInvoice.id))
        .orderBy(invoiceLineItems.serviceDate, invoiceLineItems.id);

      return {
        invoice: {
          ...invoiceRow,
          lineItemCount: lineItems.length,
        },
        lineItems,
        billableUsageUpdatedCount: updatedRows.length,
      };
    });
  }

  async cancelInvoiceDraft(invoiceId: number): Promise<CancelInvoiceDraftResult> {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new Error("Invalid invoice id.");
    }

    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
        })
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      if (invoice.status !== "draft") {
        throw new Error("Only draft invoices can be canceled.");
      }

      const linkedLineItems = await tx
        .select({
          billableUsageId: invoiceLineItems.billableUsageId,
        })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId));
      const linkedBillableUsageIds = linkedLineItems.map((item) => item.billableUsageId);

      let billableUsageUpdatedCount = 0;
      if (linkedBillableUsageIds.length > 0) {
        const linkedBillableUsageRows = await tx
          .select({
            id: billableUsage.id,
            status: billableUsage.status,
          })
          .from(billableUsage)
          .where(inArray(billableUsage.id, linkedBillableUsageIds));

        if (linkedBillableUsageRows.length !== linkedBillableUsageIds.length) {
          throw new Error("One or more linked billable usage items could not be found.");
        }

        const nonDraftUsage = linkedBillableUsageRows.find((row) => row.status !== "draft");
        if (nonDraftUsage) {
          throw new Error("All linked billable usage items must be in draft status before cancellation.");
        }

        const restoredRows = await tx
          .update(billableUsage)
          .set({
            status: "unbilled",
            updatedAt: new Date(),
          })
          .where(and(inArray(billableUsage.id, linkedBillableUsageIds), eq(billableUsage.status, "draft")))
          .returning();

        if (restoredRows.length !== linkedBillableUsageIds.length) {
          throw new Error("Linked billable usage items could not all be restored to unbilled.");
        }
        billableUsageUpdatedCount = restoredRows.length;
      }

      const [updatedInvoice] = await tx
        .update(invoices)
        .set({
          status: "canceled",
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "draft")))
        .returning();

      if (!updatedInvoice) {
        throw new Error("Invoice could not be canceled.");
      }

      const [invoiceRow] = await tx
        .select({
          id: invoices.id,
          draftNumber: invoices.draftNumber,
          invoiceNumber: invoices.invoiceNumber,
          clientOrganizationId: invoices.clientOrganizationId,
          clientName: clientOrganizations.name,
          invoiceDate: invoices.invoiceDate,
          periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
          periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          total: invoices.total,
          status: invoices.status,
          notes: invoices.notes,
          issuedAt: invoices.issuedAt,
          issuedByUserId: invoices.issuedByUserId,
          sentAt: invoices.sentAt,
          sentByUserId: invoices.sentByUserId,
          sentMethod: invoices.sentMethod,
          sentRecipientEmail: invoices.sentRecipientEmail,
          sentNotes: invoices.sentNotes,
          paidAt: invoices.paidAt,
          paidByUserId: invoices.paidByUserId,
          paymentMethod: invoices.paymentMethod,
          paymentReferenceNumber: invoices.paymentReferenceNumber,
          paymentNotes: invoices.paymentNotes,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
        .where(eq(invoices.id, invoiceId));

      if (!invoiceRow) {
        throw new Error("Invoice was canceled but could not be loaded.");
      }

      const lineItems = await tx
        .select({
          id: invoiceLineItems.id,
          invoiceId: invoiceLineItems.invoiceId,
          billableUsageId: invoiceLineItems.billableUsageId,
          description: invoiceLineItems.description,
          serviceDate: sql<string>`to_char(${invoiceLineItems.serviceDate}, 'YYYY-MM-DD')`,
          projectId: invoiceLineItems.projectId,
          projectName: projects.name,
          expertId: invoiceLineItems.expertId,
          expertName: experts.name,
          cuUsed: invoiceLineItems.cuUsed,
          cuRate: invoiceLineItems.cuRate,
          amount: invoiceLineItems.amount,
          createdAt: invoiceLineItems.createdAt,
        })
        .from(invoiceLineItems)
        .innerJoin(projects, eq(invoiceLineItems.projectId, projects.id))
        .innerJoin(experts, eq(invoiceLineItems.expertId, experts.id))
        .where(eq(invoiceLineItems.invoiceId, invoiceId))
        .orderBy(invoiceLineItems.serviceDate, invoiceLineItems.id);

      return {
        invoice: {
          ...invoiceRow,
          lineItemCount: lineItems.length,
        },
        lineItems,
        billableUsageUpdatedCount,
      };
    });
  }

  async issueInvoice(invoiceId: number, issuedByUserId?: number): Promise<IssueInvoiceResult> {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new Error("Invalid invoice id.");
    }

    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
          invoiceNumber: invoices.invoiceNumber,
        })
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      if (invoice.status !== "draft") {
        throw new Error("Only draft invoices can be issued.");
      }

      const linkedLineItems = await tx
        .select({
          billableUsageId: invoiceLineItems.billableUsageId,
        })
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId));
      const linkedBillableUsageIds = linkedLineItems.map((item) => item.billableUsageId);

      if (linkedBillableUsageIds.length === 0) {
        throw new Error("Invoice must have line items before it can be issued.");
      }

      const linkedBillableUsageRows = await tx
        .select({
          id: billableUsage.id,
          status: billableUsage.status,
        })
        .from(billableUsage)
        .where(inArray(billableUsage.id, linkedBillableUsageIds));

      if (linkedBillableUsageRows.length !== linkedBillableUsageIds.length) {
        throw new Error("One or more linked billable usage items could not be found.");
      }

      const nonDraftUsage = linkedBillableUsageRows.find((row) => row.status !== "draft");
      if (nonDraftUsage) {
        throw new Error("All linked billable usage items must be in draft status before issuing.");
      }

      const now = new Date();
      const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, "");
      const invoiceNumber = invoice.invoiceNumber || `INV-${dateStamp}-${invoice.id}`;

      const [updatedInvoice] = await tx
        .update(invoices)
        .set({
          invoiceNumber,
          status: "issued",
          issuedAt: now,
          issuedByUserId: issuedByUserId || null,
          updatedAt: now,
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "draft")))
        .returning();

      if (!updatedInvoice) {
        throw new Error("Invoice could not be issued.");
      }

      const updatedRows = await tx
        .update(billableUsage)
        .set({
          status: "invoiced",
          updatedAt: now,
        })
        .where(and(inArray(billableUsage.id, linkedBillableUsageIds), eq(billableUsage.status, "draft")))
        .returning();

      if (updatedRows.length !== linkedBillableUsageIds.length) {
        throw new Error("Linked billable usage items could not all be locked as invoiced.");
      }

      const [invoiceRow] = await tx
        .select({
          id: invoices.id,
          draftNumber: invoices.draftNumber,
          invoiceNumber: invoices.invoiceNumber,
          clientOrganizationId: invoices.clientOrganizationId,
          clientName: clientOrganizations.name,
          invoiceDate: invoices.invoiceDate,
          periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
          periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          total: invoices.total,
          status: invoices.status,
          notes: invoices.notes,
          issuedAt: invoices.issuedAt,
          issuedByUserId: invoices.issuedByUserId,
          sentAt: invoices.sentAt,
          sentByUserId: invoices.sentByUserId,
          sentMethod: invoices.sentMethod,
          sentRecipientEmail: invoices.sentRecipientEmail,
          sentNotes: invoices.sentNotes,
          paidAt: invoices.paidAt,
          paidByUserId: invoices.paidByUserId,
          paymentMethod: invoices.paymentMethod,
          paymentReferenceNumber: invoices.paymentReferenceNumber,
          paymentNotes: invoices.paymentNotes,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
        .where(eq(invoices.id, invoiceId));

      if (!invoiceRow) {
        throw new Error("Invoice was issued but could not be loaded.");
      }

      const lineItems = await tx
        .select({
          id: invoiceLineItems.id,
          invoiceId: invoiceLineItems.invoiceId,
          billableUsageId: invoiceLineItems.billableUsageId,
          description: invoiceLineItems.description,
          serviceDate: sql<string>`to_char(${invoiceLineItems.serviceDate}, 'YYYY-MM-DD')`,
          projectId: invoiceLineItems.projectId,
          projectName: projects.name,
          expertId: invoiceLineItems.expertId,
          expertName: experts.name,
          cuUsed: invoiceLineItems.cuUsed,
          cuRate: invoiceLineItems.cuRate,
          amount: invoiceLineItems.amount,
          createdAt: invoiceLineItems.createdAt,
        })
        .from(invoiceLineItems)
        .innerJoin(projects, eq(invoiceLineItems.projectId, projects.id))
        .innerJoin(experts, eq(invoiceLineItems.expertId, experts.id))
        .where(eq(invoiceLineItems.invoiceId, invoiceId))
        .orderBy(invoiceLineItems.serviceDate, invoiceLineItems.id);

      return {
        invoice: {
          ...invoiceRow,
          lineItemCount: lineItems.length,
        },
        lineItems,
        billableUsageUpdatedCount: updatedRows.length,
      };
    });
  }

  async markInvoiceSent(
    invoiceId: number,
    input: MarkInvoiceSentInput = {},
    sentByUserId?: number
  ): Promise<MarkInvoiceSentResult> {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new Error("Invalid invoice id.");
    }

    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
        })
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      if (invoice.status !== "issued") {
        throw new Error("Only issued invoices can be marked as sent.");
      }

      const now = new Date();
      const sentMethod = String(input.sentMethod || "manual_email").trim() || "manual_email";
      const sentRecipientEmail = input.sentRecipientEmail ? String(input.sentRecipientEmail).trim() : null;
      const sentNotes = input.sentNotes ? String(input.sentNotes).trim() : null;

      const [updatedInvoice] = await tx
        .update(invoices)
        .set({
          status: "sent",
          sentAt: now,
          sentByUserId: sentByUserId || null,
          sentMethod,
          sentRecipientEmail,
          sentNotes,
          updatedAt: now,
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "issued")))
        .returning();

      if (!updatedInvoice) {
        throw new Error("Invoice could not be marked as sent.");
      }

      const [invoiceRow] = await tx
        .select({
          id: invoices.id,
          draftNumber: invoices.draftNumber,
          invoiceNumber: invoices.invoiceNumber,
          clientOrganizationId: invoices.clientOrganizationId,
          clientName: clientOrganizations.name,
          invoiceDate: invoices.invoiceDate,
          periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
          periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          total: invoices.total,
          status: invoices.status,
          notes: invoices.notes,
          issuedAt: invoices.issuedAt,
          issuedByUserId: invoices.issuedByUserId,
          sentAt: invoices.sentAt,
          sentByUserId: invoices.sentByUserId,
          sentMethod: invoices.sentMethod,
          sentRecipientEmail: invoices.sentRecipientEmail,
          sentNotes: invoices.sentNotes,
          paidAt: invoices.paidAt,
          paidByUserId: invoices.paidByUserId,
          paymentMethod: invoices.paymentMethod,
          paymentReferenceNumber: invoices.paymentReferenceNumber,
          paymentNotes: invoices.paymentNotes,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
        .where(eq(invoices.id, invoiceId));

      if (!invoiceRow) {
        throw new Error("Invoice was marked as sent but could not be loaded.");
      }

      const lineItems = await tx
        .select({
          id: invoiceLineItems.id,
          invoiceId: invoiceLineItems.invoiceId,
          billableUsageId: invoiceLineItems.billableUsageId,
          description: invoiceLineItems.description,
          serviceDate: sql<string>`to_char(${invoiceLineItems.serviceDate}, 'YYYY-MM-DD')`,
          projectId: invoiceLineItems.projectId,
          projectName: projects.name,
          expertId: invoiceLineItems.expertId,
          expertName: experts.name,
          cuUsed: invoiceLineItems.cuUsed,
          cuRate: invoiceLineItems.cuRate,
          amount: invoiceLineItems.amount,
          createdAt: invoiceLineItems.createdAt,
        })
        .from(invoiceLineItems)
        .innerJoin(projects, eq(invoiceLineItems.projectId, projects.id))
        .innerJoin(experts, eq(invoiceLineItems.expertId, experts.id))
        .where(eq(invoiceLineItems.invoiceId, invoiceId))
        .orderBy(invoiceLineItems.serviceDate, invoiceLineItems.id);

      return {
        invoice: {
          ...invoiceRow,
          lineItemCount: lineItems.length,
        },
        lineItems,
      };
    });
  }

  async markInvoicePaid(
    invoiceId: number,
    input: MarkInvoicePaidInput = {},
    paidByUserId?: number
  ): Promise<MarkInvoicePaidResult> {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new Error("Invalid invoice id.");
    }

    return db.transaction(async (tx) => {
      const [invoice] = await tx
        .select({
          id: invoices.id,
          status: invoices.status,
        })
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      if (!invoice) {
        throw new Error("Invoice not found.");
      }

      if (invoice.status !== "sent") {
        throw new Error("Only sent invoices can be marked as paid.");
      }

      const now = new Date();
      const paymentMethod = input.paymentMethod ? String(input.paymentMethod).trim() : null;
      const paymentReferenceNumber = input.paymentReferenceNumber ? String(input.paymentReferenceNumber).trim() : null;
      const paymentNotes = input.paymentNotes ? String(input.paymentNotes).trim() : null;

      const [updatedInvoice] = await tx
        .update(invoices)
        .set({
          status: "paid",
          paidAt: now,
          paidByUserId: paidByUserId || null,
          paymentMethod,
          paymentReferenceNumber,
          paymentNotes,
          updatedAt: now,
        })
        .where(and(eq(invoices.id, invoiceId), eq(invoices.status, "sent")))
        .returning();

      if (!updatedInvoice) {
        throw new Error("Invoice could not be marked as paid.");
      }

      const [invoiceRow] = await tx
        .select({
          id: invoices.id,
          draftNumber: invoices.draftNumber,
          invoiceNumber: invoices.invoiceNumber,
          clientOrganizationId: invoices.clientOrganizationId,
          clientName: clientOrganizations.name,
          invoiceDate: invoices.invoiceDate,
          periodStart: sql<string | null>`to_char(${invoices.periodStart}, 'YYYY-MM-DD')`,
          periodEnd: sql<string | null>`to_char(${invoices.periodEnd}, 'YYYY-MM-DD')`,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          total: invoices.total,
          status: invoices.status,
          notes: invoices.notes,
          issuedAt: invoices.issuedAt,
          issuedByUserId: invoices.issuedByUserId,
          sentAt: invoices.sentAt,
          sentByUserId: invoices.sentByUserId,
          sentMethod: invoices.sentMethod,
          sentRecipientEmail: invoices.sentRecipientEmail,
          sentNotes: invoices.sentNotes,
          paidAt: invoices.paidAt,
          paidByUserId: invoices.paidByUserId,
          paymentMethod: invoices.paymentMethod,
          paymentReferenceNumber: invoices.paymentReferenceNumber,
          paymentNotes: invoices.paymentNotes,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .innerJoin(clientOrganizations, eq(invoices.clientOrganizationId, clientOrganizations.id))
        .where(eq(invoices.id, invoiceId));

      if (!invoiceRow) {
        throw new Error("Invoice was marked as paid but could not be loaded.");
      }

      const lineItems = await tx
        .select({
          id: invoiceLineItems.id,
          invoiceId: invoiceLineItems.invoiceId,
          billableUsageId: invoiceLineItems.billableUsageId,
          description: invoiceLineItems.description,
          serviceDate: sql<string>`to_char(${invoiceLineItems.serviceDate}, 'YYYY-MM-DD')`,
          projectId: invoiceLineItems.projectId,
          projectName: projects.name,
          expertId: invoiceLineItems.expertId,
          expertName: experts.name,
          cuUsed: invoiceLineItems.cuUsed,
          cuRate: invoiceLineItems.cuRate,
          amount: invoiceLineItems.amount,
          createdAt: invoiceLineItems.createdAt,
        })
        .from(invoiceLineItems)
        .innerJoin(projects, eq(invoiceLineItems.projectId, projects.id))
        .innerJoin(experts, eq(invoiceLineItems.expertId, experts.id))
        .where(eq(invoiceLineItems.invoiceId, invoiceId))
        .orderBy(invoiceLineItems.serviceDate, invoiceLineItems.id);

      return {
        invoice: {
          ...invoiceRow,
          lineItemCount: lineItems.length,
        },
        lineItems,
      };
    });
  }

  private async buildExpenseRows(rows: Expense[]): Promise<ExpenseRow[]> {
    const userRows = await db.select({ id: users.id, fullName: users.fullName }).from(users);
    const userNameById = new Map(userRows.map((user) => [user.id, user.fullName]));

    return rows.map((row) => ({
      id: row.id,
      expenseId: row.expenseId,
      vendor: row.vendor,
      category: row.category,
      description: row.description,
      amount: row.amount,
      currency: row.currency,
      billingType: row.billingType,
      expenseDate: row.expenseDate,
      renewalDate: row.renewalDate,
      paymentMethod: row.paymentMethod,
      status: row.status,
      ownerId: row.ownerId,
      ownerName: row.ownerId ? userNameById.get(row.ownerId) || null : null,
      approvedBy: row.approvedBy,
      approvedByName: row.approvedBy ? userNameById.get(row.approvedBy) || null : null,
      approvedAt: row.approvedAt,
      accountingStatus: row.accountingStatus,
      notes: row.notes,
      receiptFileName: row.receiptFileName,
      receiptMimeType: row.receiptMimeType,
      receiptFileSize: row.receiptFileSize,
      receiptUploadedBy: row.receiptUploadedBy,
      receiptUploadedByName: row.receiptUploadedBy ? userNameById.get(row.receiptUploadedBy) || null : null,
      receiptUploadedAt: row.receiptUploadedAt,
      hasReceipt: Boolean(row.receiptData && row.receiptFileName && row.receiptMimeType),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private buildExpenseConditions(filters: ExpenseFilters) {
    const conditions = [];
    if (filters.search) {
      const search = `%${filters.search}%`;
      conditions.push(or(ilike(expenses.vendor, search), ilike(expenses.description, search)));
    }
    if (filters.category && filters.category !== "all") conditions.push(eq(expenses.category, filters.category));
    if (filters.status && filters.status !== "all") conditions.push(eq(expenses.status, filters.status));
    if (filters.currency && filters.currency !== "all") conditions.push(eq(expenses.currency, filters.currency));
    if (filters.billingType && filters.billingType !== "all") conditions.push(eq(expenses.billingType, filters.billingType));
    if (filters.accountingStatus && filters.accountingStatus !== "all") conditions.push(eq(expenses.accountingStatus, filters.accountingStatus));
    if (filters.fromDate) conditions.push(gte(expenses.expenseDate, filters.fromDate));
    if (filters.toDate) conditions.push(lte(expenses.expenseDate, filters.toDate));
    return conditions;
  }

  private calculateExpenseSummary(rows: ExpenseRow[]): ExpenseReport["summary"] {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const activeRows = rows.filter((row) => row.status !== "Archived" && row.status !== "Cancelled");
    const monthlyOperatingExpenses = activeRows.reduce((sum, row) => {
      const expenseDate = row.expenseDate;
      if (expenseDate.getFullYear() !== currentYear || expenseDate.getMonth() !== currentMonth) return sum;
      return sum + Number(row.amount || 0);
    }, 0);
    const activeSubscriptions = activeRows.filter((row) => row.status === "Active" && (row.billingType === "Monthly" || row.billingType === "Annual")).length;
    const freePlanTools = activeRows.filter((row) => Number(row.amount || 0) === 0 || row.billingType === "Free Plan" || row.accountingStatus === "No Cost").length;
    const annualizedSoftwareCost = activeRows
      .filter((row) => row.category === "Software")
      .reduce((sum, row) => {
        const amount = Number(row.amount || 0);
        if (row.billingType === "Monthly") return sum + amount * 12;
        if (row.billingType === "Annual" || row.billingType === "One-time") return sum + amount;
        return sum;
      }, 0);

    return {
      monthlyOperatingExpenses,
      activeSubscriptions,
      freePlanTools,
      annualizedSoftwareCost,
    };
  }

  private async generateExpenseId(): Promise<string> {
    const year = new Date().getFullYear();
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(expenses)
      .where(sql`${expenses.expenseId} LIKE ${`EXP-${year}-%`}`);
    return `EXP-${year}-${String(Number(count || 0) + 1).padStart(4, "0")}`;
  }

  async getExpenses(filters: ExpenseFilters = {}): Promise<ExpenseReport> {
    const conditions = this.buildExpenseConditions(filters);
    const rows = await db
      .select()
      .from(expenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
    const mappedRows = await this.buildExpenseRows(rows);
    return {
      summary: this.calculateExpenseSummary(mappedRows),
      rows: mappedRows,
    };
  }

  async getExpense(id: number): Promise<ExpenseRow | undefined> {
    const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
    if (!row) return undefined;
    const [mappedRow] = await this.buildExpenseRows([row]);
    return mappedRow;
  }

  async createExpense(expense: InsertExpense, createdByUserId?: number): Promise<ExpenseRow> {
    const expenseId = await this.generateExpenseId();
    const [created] = await db
      .insert(expenses)
      .values({
        ...expense,
        expenseId,
        ownerId: expense.ownerId || createdByUserId || null,
        amount: Number(expense.amount || 0).toFixed(2),
        currency: expense.currency || "USD",
        status: expense.status || "Active",
        accountingStatus: expense.accountingStatus || "Pending",
        updatedAt: new Date(),
      })
      .returning();
    const [mappedRow] = await this.buildExpenseRows([created]);
    return mappedRow;
  }

  async updateExpense(id: number, expense: Partial<InsertExpense>): Promise<ExpenseRow | undefined> {
    const [updated] = await db
      .update(expenses)
      .set({
        ...expense,
        amount: expense.amount !== undefined ? Number(expense.amount || 0).toFixed(2) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();
    if (!updated) return undefined;
    const [mappedRow] = await this.buildExpenseRows([updated]);
    return mappedRow;
  }

  async archiveExpense(id: number): Promise<ExpenseRow | undefined> {
    const [updated] = await db
      .update(expenses)
      .set({ status: "Archived", updatedAt: new Date() })
      .where(eq(expenses.id, id))
      .returning();
    if (!updated) return undefined;
    const [mappedRow] = await this.buildExpenseRows([updated]);
    return mappedRow;
  }

  async saveExpenseReceipt(id: number, receipt: ExpenseReceiptInput): Promise<ExpenseRow | undefined> {
    const [updated] = await db
      .update(expenses)
      .set({
        receiptFileName: receipt.fileName,
        receiptMimeType: receipt.mimeType,
        receiptFileSize: receipt.fileSize,
        receiptUploadedBy: receipt.uploadedBy || null,
        receiptUploadedAt: new Date(),
        receiptData: receipt.data.toString("base64"),
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();
    if (!updated) return undefined;
    const [mappedRow] = await this.buildExpenseRows([updated]);
    return mappedRow;
  }

  async getExpenseReceipt(id: number): Promise<ExpenseReceipt | undefined> {
    const [row] = await db
      .select({
        fileName: expenses.receiptFileName,
        mimeType: expenses.receiptMimeType,
        fileSize: expenses.receiptFileSize,
        data: expenses.receiptData,
      })
      .from(expenses)
      .where(eq(expenses.id, id));
    if (!row?.fileName || !row.mimeType || !row.data) return undefined;
    return {
      fileName: row.fileName,
      mimeType: row.mimeType,
      fileSize: row.fileSize || Buffer.byteLength(row.data, "base64"),
      data: Buffer.from(row.data, "base64"),
    };
  }

  async deleteExpenseReceipt(id: number): Promise<ExpenseRow | undefined> {
    const [updated] = await db
      .update(expenses)
      .set({
        receiptFileName: null,
        receiptMimeType: null,
        receiptFileSize: null,
        receiptUploadedBy: null,
        receiptUploadedAt: null,
        receiptData: null,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();
    if (!updated) return undefined;
    const [mappedRow] = await this.buildExpenseRows([updated]);
    return mappedRow;
  }

  // Insights
  async getInsights(): Promise<Insight[]> {
    return db.select().from(insights).orderBy(desc(insights.callDate), desc(insights.createdAt));
  }

  async getInsight(id: number): Promise<Insight | undefined> {
    const [insight] = await db.select().from(insights).where(eq(insights.id, id));
    return insight || undefined;
  }

  async getInsightsByProjectId(projectId: number): Promise<Insight[]> {
    const rows = await db
      .select({ insight: insights })
      .from(insights)
      .innerJoin(callRecords, eq(insights.callRecordId, callRecords.id))
      .where(eq(callRecords.projectId, projectId))
      .orderBy(desc(insights.callDate), desc(insights.createdAt));
    return rows.map((row) => row.insight);
  }

  async getInsightByCallRecordId(callRecordId: number): Promise<Insight | undefined> {
    const [insight] = await db
      .select()
      .from(insights)
      .where(eq(insights.callRecordId, callRecordId))
      .limit(1);
    return insight || undefined;
  }

  async createInsight(insight: InsertInsight): Promise<Insight> {
    const [newInsight] = await db.insert(insights).values(insight as any).returning();
    return newInsight;
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

  async getExpertInvitationLinkByProjectAndRa(projectId: number, raId: number): Promise<ExpertInvitationLink | undefined> {
    const [link] = await db
      .select()
      .from(expertInvitationLinks)
      .where(
        and(
          eq(expertInvitationLinks.projectId, projectId),
          eq(expertInvitationLinks.raId, raId),
          eq(expertInvitationLinks.inviteType, "ra"),
          eq(expertInvitationLinks.isActive, true)
        )
      );
    return link || undefined;
  }

  async getExpertInvitationLinkByProjectAndExpert(projectId: number, expertId: number): Promise<ExpertInvitationLink | undefined> {
    const [link] = await db
      .select()
      .from(expertInvitationLinks)
      .where(
        and(
          eq(expertInvitationLinks.projectId, projectId),
          eq(expertInvitationLinks.expertId, expertId),
          eq(expertInvitationLinks.inviteType, "existing"),
          eq(expertInvitationLinks.isActive, true)
        )
      );
    return link || undefined;
  }

  async getExpertInvitationLinksByProject(projectId: number): Promise<ExpertInvitationLink[]> {
    return db
      .select()
      .from(expertInvitationLinks)
      .where(eq(expertInvitationLinks.projectId, projectId))
      .orderBy(desc(expertInvitationLinks.createdAt));
  }

  async getExpertInvitationLinksByRa(raId: number): Promise<ExpertInvitationLink[]> {
    return db
      .select()
      .from(expertInvitationLinks)
      .where(eq(expertInvitationLinks.raId, raId))
      .orderBy(desc(expertInvitationLinks.createdAt));
  }

  async updateExpertInvitationLink(id: number, link: Partial<InsertExpertInvitationLink>): Promise<ExpertInvitationLink | undefined> {
    const [updated] = await db
      .update(expertInvitationLinks)
      .set({ ...link, updatedAt: new Date() } as any)
      .where(eq(expertInvitationLinks.id, id))
      .returning();
    return updated || undefined;
  }

  async markInvitationLinkUsed(token: string, expertId?: number, status = "onboarded"): Promise<ExpertInvitationLink | undefined> {
    const [updated] = await db
      .update(expertInvitationLinks)
      .set({
        usedAt: new Date(),
        isActive: false,
        status,
        expertId: expertId || undefined,
        updatedAt: new Date(),
      } as any)
      .where(eq(expertInvitationLinks.token, token))
      .returning();
    return updated || undefined;
  }

  async updateInvitationLinkStatus(token: string, status: string): Promise<ExpertInvitationLink | undefined> {
    const [updated] = await db
      .update(expertInvitationLinks)
      .set({ status, updatedAt: new Date() } as any)
      .where(eq(expertInvitationLinks.token, token))
      .returning();
    return updated || undefined;
  }

  // Project Activities
  async getProjectActivities(projectId: number): Promise<ProjectActivity[]> {
    return db
      .select()
      .from(projectActivities)
      .where(eq(projectActivities.projectId, projectId))
      .orderBy(desc(projectActivities.createdAt));
  }

  async createProjectActivity(activity: InsertProjectActivity): Promise<ProjectActivity> {
    const [newActivity] = await db.insert(projectActivities).values(activity).returning();
    return newActivity;
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

  // Sourcing incentive calculations
  // Get experts attributed to a specific sourcing owner.
  async getExpertsByRecruiterId(sourcerId: number): Promise<Array<Expert & { resolvedSourcedAt: Date | null }>> {
    const [sourcer] = await db.select().from(users).where(eq(users.id, sourcerId));
    const sourcerEmail = String(sourcer?.email || "").trim().toLowerCase();
    const expertsById = new Map<number, Expert & { resolvedSourcedAt: Date | null }>();

    const addExpert = (expert: Expert | null | undefined, sourcedAt?: Date | string | null) => {
      if (!expert?.id) return;
      const existing = expertsById.get(expert.id);
      const resolvedSourcedAt = sourcedAt
        ? new Date(sourcedAt)
        : expert.sourcedAt
        ? new Date(expert.sourcedAt)
        : expert.createdAt
        ? new Date(expert.createdAt)
        : null;
      if (!existing) {
        expertsById.set(expert.id, { ...expert, resolvedSourcedAt });
        return;
      }
      if (!existing.resolvedSourcedAt || (resolvedSourcedAt && resolvedSourcedAt < existing.resolvedSourcedAt)) {
        expertsById.set(expert.id, { ...expert, resolvedSourcedAt });
      }
    };

    const directlySourcedExperts = await db
      .select()
      .from(experts)
      .where(eq(experts.sourcedByRaId, sourcerId));
    directlySourcedExperts.forEach((expert) => addExpert(expert, expert.sourcedAt));

    const projectAttributedExperts = await db
      .select({
        expert: experts,
        assignedAt: projectExperts.assignedAt,
        respondedAt: projectExperts.respondedAt,
        lastActivityAt: projectExperts.lastActivityAt,
      })
      .from(projectExperts)
      .innerJoin(experts, eq(projectExperts.expertId, experts.id))
      .where(eq(projectExperts.sourcedByRaId, sourcerId));
    projectAttributedExperts.forEach((row) =>
      addExpert(row.expert, row.assignedAt || row.respondedAt || row.lastActivityAt)
    );

    const ownedInviteConditions = [eq(expertInvitationLinks.raId, sourcerId)];
    if (sourcerEmail) {
      ownedInviteConditions.push(sql`lower(trim(${expertInvitationLinks.recruitedBy})) = ${sourcerEmail}` as any);
    }
    const ownedInvites = await db
      .select()
      .from(expertInvitationLinks)
      .where(or(...ownedInviteConditions));

    const linkedExpertIds = Array.from(
      new Set(ownedInvites.map((link) => link.expertId).filter((id): id is number => Number.isInteger(id)))
    );
    if (linkedExpertIds.length > 0) {
      const linkedExperts = await db.select().from(experts).where(inArray(experts.id, linkedExpertIds));
      const linkedExpertsById = new Map(linkedExperts.map((expert) => [expert.id, expert]));
      ownedInvites.forEach((link) => addExpert(link.expertId ? linkedExpertsById.get(link.expertId) : null, link.createdAt || link.usedAt));
    }

    const ownedInviteTokens = Array.from(
      new Set(ownedInvites.map((link) => link.token).filter(Boolean))
    );
    if (ownedInviteTokens.length > 0) {
      const inviteTokenMatchedExperts = await db
        .select({
          expert: experts,
          assignedAt: projectExperts.assignedAt,
          respondedAt: projectExperts.respondedAt,
          lastActivityAt: projectExperts.lastActivityAt,
        })
        .from(projectExperts)
        .innerJoin(experts, eq(projectExperts.expertId, experts.id))
        .where(inArray(projectExperts.invitationToken, ownedInviteTokens));
      inviteTokenMatchedExperts.forEach((row) =>
        addExpert(row.expert, row.assignedAt || row.respondedAt || row.lastActivityAt || row.expert.sourcedAt || row.expert.createdAt)
      );
    }

    const candidateEmails = Array.from(
      new Set(
        ownedInvites
          .map((link) => String(link.candidateEmail || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    if (candidateEmails.length > 0) {
      const emailMatchedExperts = await db
        .select()
        .from(experts)
        .where(inArray(sql`lower(trim(${experts.email}))`, candidateEmails));
      const inviteByEmail = new Map(
        ownedInvites
          .filter((link) => link.candidateEmail)
          .map((link) => [String(link.candidateEmail).trim().toLowerCase(), link])
      );
      emailMatchedExperts.forEach((expert) => {
        const link = inviteByEmail.get(String(expert.email || "").trim().toLowerCase());
        addExpert(expert, link?.createdAt || link?.usedAt || expert.sourcedAt || expert.createdAt);
      });
    }

    return Array.from(expertsById.values()).sort((a, b) => {
      const aTime = a.resolvedSourcedAt?.getTime() || 0;
      const bTime = b.resolvedSourcedAt?.getTime() || 0;
      return bTime - aTime;
    });
  }

  // Get completed calls for an expert within a date range
  async getCompletedCallsForExpert(
    expertId: number,
    fromDate: Date,
    toDate: Date
  ): Promise<CallRecord[]> {
    const completionDate = sql<Date>`coalesce(${callRecords.completedAt}, ${callRecords.callDate})`;
    return db
      .select()
      .from(callRecords)
      .where(
        and(
          eq(callRecords.expertId, expertId),
          sql`lower(${callRecords.status}) in ('completed', 'done', 'billable', 'invoiced', 'invoice_issued')`,
          gte(completionDate, fromDate),
          lte(completionDate, toDate)
        )
      );
  }

  // Calculate sourcing incentives for a specific period.
  // Business rule: sourced experts must complete consultations within 60 days.
  // First 4 eligible completed calls are unpaid, then R$250 per call up to R$4,000/month.
  async calculateRaIncentives(
    sourcerId: number,
    periodFromDate?: Date,
    periodToDate?: Date
  ): Promise<{
    raId: number;
    raName: string;
    raEmail: string;
    raRole: string;
    totalRecruitedExperts: number;
    expertsWithCompletedCalls: number;
    totalEligibleCalls: number;
    totalIncentiveBRL: number;
    lastActivityAt: Date | null;
    eligibleExperts: Array<{
      expertId: number;
      expertName: string;
      recruitedAt: Date | null;
      eligibleCalls: number;
      incentiveBRL: number;
    }>;
  }> {
    const INCENTIVE_PER_CALL_BRL = 250;
    const ELIGIBILITY_DAYS = 60;
    const UNPAID_ELIGIBLE_CALLS = 4;
    const MONTHLY_CAP_BRL = 4000;
    const MAX_PAID_CALLS = MONTHLY_CAP_BRL / INCENTIVE_PER_CALL_BRL;
    const calculatePayable = (eligibleCompletedCalls: number) =>
      Math.min(
        Math.max(0, eligibleCompletedCalls - UNPAID_ELIGIBLE_CALLS) * INCENTIVE_PER_CALL_BRL,
        MONTHLY_CAP_BRL
      );

    // Get sourcing owner info
    const [sourcer] = await db.select().from(users).where(eq(users.id, sourcerId));
    if (!sourcer) {
      throw new Error("Sourcing owner not found");
    }

    // Get all experts attributed to this sourcing owner, independent of completed-call activity.
    const recruitedExperts = await this.getExpertsByRecruiterId(sourcerId);
    const isWithinReportPeriod = (value: Date | null | undefined) => {
      if (!value) return false;
      if (periodFromDate && value < periodFromDate) return false;
      if (periodToDate && value > periodToDate) return false;
      return true;
    };
    const periodRegisteredExperts = periodFromDate || periodToDate
      ? recruitedExperts.filter((expert) => isWithinReportPeriod(expert.resolvedSourcedAt))
      : recruitedExperts;

    let totalEligibleCalls = 0;
    let expertsWithCompletedCalls = 0;
    let lastActivityAt: Date | null = null;
    const eligibleExperts: Array<{
      expertId: number;
      expertName: string;
      recruitedAt: Date | null;
      eligibleCalls: number;
      incentiveBRL: number;
    }> = [];

    for (const expert of recruitedExperts) {
      if (!expert.resolvedSourcedAt) continue;

      const recruitedAt = new Date(expert.resolvedSourcedAt);
      if (isWithinReportPeriod(recruitedAt) && (!lastActivityAt || recruitedAt > lastActivityAt)) {
        lastActivityAt = recruitedAt;
      }
      const eligibilityEndDate = new Date(recruitedAt);
      eligibilityEndDate.setDate(eligibilityEndDate.getDate() + ELIGIBILITY_DAYS);

      // Get completed calls within the 60-day eligibility window
      // Also filter by the period if provided
      let callsFromDate = recruitedAt;
      let callsToDate = eligibilityEndDate;

      if (periodFromDate && periodFromDate > callsFromDate) {
        callsFromDate = periodFromDate;
      }
      if (periodToDate && periodToDate < callsToDate) {
        callsToDate = periodToDate;
      }

      // Skip if the period doesn't overlap with eligibility window
      if (callsFromDate >= callsToDate) continue;

      const completedCalls = await this.getCompletedCallsForExpert(
        expert.id,
        callsFromDate,
        callsToDate
      );

      if (completedCalls.length > 0) {
        expertsWithCompletedCalls++;
        totalEligibleCalls += completedCalls.length;
        for (const call of completedCalls) {
          const callActivityDate = call.completedAt || call.callDate || null;
          if (callActivityDate && (!lastActivityAt || new Date(callActivityDate) > lastActivityAt)) {
            lastActivityAt = new Date(callActivityDate);
          }
        }

        eligibleExperts.push({
          expertId: expert.id,
          expertName: expert.name,
          recruitedAt: expert.resolvedSourcedAt,
          eligibleCalls: completedCalls.length,
          incentiveBRL: 0,
        });
      }
    }

    let unpaidCallsRemaining = UNPAID_ELIGIBLE_CALLS;
    let paidCallsRemaining = MAX_PAID_CALLS;
    for (const expert of eligibleExperts) {
      const unpaidCalls = Math.min(unpaidCallsRemaining, expert.eligibleCalls);
      unpaidCallsRemaining -= unpaidCalls;
      const payableCalls = Math.min(Math.max(0, expert.eligibleCalls - unpaidCalls), paidCallsRemaining);
      paidCallsRemaining -= payableCalls;
      expert.incentiveBRL = payableCalls * INCENTIVE_PER_CALL_BRL;
    }

    return {
      raId: sourcer.id,
      raName: sourcer.fullName,
      raEmail: sourcer.email,
      raRole: sourcer.role,
      totalRecruitedExperts: periodRegisteredExperts.length,
      expertsWithCompletedCalls,
      totalEligibleCalls,
      totalIncentiveBRL: calculatePayable(totalEligibleCalls),
      lastActivityAt,
      eligibleExperts,
    };
  }

  // Get all users with sourcing-attributed experts and their incentive summary
  async getAllRaIncentiveSummary(
    periodFromDate?: Date,
    periodToDate?: Date
  ): Promise<Array<{
    raId: number;
    raName: string;
    raEmail: string;
    raRole: string;
    totalRecruitedExperts: number;
    expertsWithCompletedCalls: number;
    totalEligibleCalls: number;
    totalIncentiveBRL: number;
    lastActivityAt: Date | null;
  }>> {
    const expertSourcingOwnerRows = await db
      .select({ sourcerId: experts.sourcedByRaId })
      .from(experts)
      .where(sql`${experts.sourcedByRaId} IS NOT NULL`);

    const projectSourcingOwnerRows = await db
      .select({ sourcerId: projectExperts.sourcedByRaId })
      .from(projectExperts)
      .where(sql`${projectExperts.sourcedByRaId} IS NOT NULL`);

    const inviteSourcingOwnerRows = await db
      .select({
        sourcerId: expertInvitationLinks.raId,
        recruitedBy: expertInvitationLinks.recruitedBy,
      })
      .from(expertInvitationLinks)
      .where(
        or(
          sql`${expertInvitationLinks.raId} IS NOT NULL`,
          sql`${expertInvitationLinks.recruitedBy} IS NOT NULL`
        )
      );

    const sourcerIdSet = new Set<number>();
    for (const row of [...expertSourcingOwnerRows, ...projectSourcingOwnerRows]) {
      if (Number.isInteger(row.sourcerId)) sourcerIdSet.add(row.sourcerId as number);
    }

    const recruitedByEmails = Array.from(
      new Set(
        inviteSourcingOwnerRows
          .map((row) => String(row.recruitedBy || "").trim().toLowerCase())
          .filter(Boolean)
      )
    );
    for (const row of inviteSourcingOwnerRows) {
      if (Number.isInteger(row.sourcerId)) sourcerIdSet.add(row.sourcerId as number);
    }
    for (const email of recruitedByEmails) {
      const user = await this.getUserByEmail(email);
      if (user) sourcerIdSet.add(user.id);
    }

    const sourcerIds = Array.from(sourcerIdSet);

    if (sourcerIds.length === 0) return [];

    const sourcers = await db
      .select()
      .from(users)
      .where(inArray(users.id, sourcerIds));

    const summaries = [];

    for (const sourcer of sourcers) {
      const incentiveData = await this.calculateRaIncentives(
        sourcer.id,
        periodFromDate,
        periodToDate
      );
      if ((periodFromDate || periodToDate) && incentiveData.totalRecruitedExperts === 0 && incentiveData.totalEligibleCalls === 0) {
        continue;
      }
      summaries.push({
        raId: incentiveData.raId,
        raName: incentiveData.raName,
        raEmail: incentiveData.raEmail,
        raRole: incentiveData.raRole,
        totalRecruitedExperts: incentiveData.totalRecruitedExperts,
        expertsWithCompletedCalls: incentiveData.expertsWithCompletedCalls,
        totalEligibleCalls: incentiveData.totalEligibleCalls,
        totalIncentiveBRL: incentiveData.totalIncentiveBRL,
        lastActivityAt: incentiveData.lastActivityAt,
      });
    }

    return summaries.sort((a, b) => b.totalIncentiveBRL - a.totalIncentiveBRL);
  }
}

export const storage = new DatabaseStorage();
