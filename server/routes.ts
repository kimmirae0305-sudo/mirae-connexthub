import type { Express, Router } from "express";
import { createServer, type Server } from "http";
import { Router as ExpressRouter } from "express";
import { storage } from "./storage";
import { db } from "./db";
import {
  insertProjectSchema,
  insertExpertSchema,
  insertVettingQuestionSchema,
  insertProjectExpertSchema,
  insertUsageRecordSchema,
  insertUserSchema,
  insertClientOrganizationSchema,
  insertClientPocSchema,
  insertCallRecordSchema,
  insertExpertInvitationLinkSchema,
  calculateCU,
  callRecords,
  experts,
  projects,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import { authMiddleware, loginHandler, getMeHandler, requireAdmin, requireRoles, hashPassword, type AuthRequest } from "./auth";
import { insertClientSchema } from "@shared/schema";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { startOfMonth, addMonths } from "date-fns";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== AUTH ROUTES (PUBLIC) ====================
  app.post("/api/auth/login", loginHandler);
  app.get("/api/auth/me", authMiddleware, getMeHandler);

  // Note: Some routes need to be public for expert registration
  // Public routes: /api/auth/*, /api/register-expert/:token, /api/invitation-links/:token (GET only)
  // ==================== USERS (PROTECTED) ====================
  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", authMiddleware, async (req, res) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const user = await storage.createUser(result.data);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertUserSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const user = await storage.updateUser(id, result.data);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ==================== EMPLOYEES (ADMIN ONLY) ====================
  app.get("/api/employees", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employees", authMiddleware, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { fullName, localPart, role, tempPassword } = req.body;
      
      if (!fullName || !localPart || !role || !tempPassword) {
        return res.status(400).json({ error: "fullName, localPart, role, and tempPassword are required" });
      }
      
      if (!["admin", "pm", "ra", "finance"].includes(role)) {
        return res.status(400).json({ error: "Invalid role. Must be admin, pm, ra, or finance" });
      }
      
      const email = `${localPart.toLowerCase()}@miraeconnext.com`;
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "An employee with this email already exists" });
      }
      
      const passwordHash = await hashPassword(tempPassword);
      
      const user = await storage.createUser({
        fullName,
        email,
        passwordHash,
        role,
        isActive: true,
      });
      
      // Remove passwordHash from response
      const { passwordHash: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Create employee error:", error);
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { fullName, role, isActive } = req.body;
      
      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (role !== undefined) {
        if (!["admin", "pm", "ra", "finance"].includes(role)) {
          return res.status(400).json({ error: "Invalid role. Must be admin, pm, ra, or finance" });
        }
        updateData.role = role;
      }
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      // Remove passwordHash from response
      const { passwordHash: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.post("/api/employees/:id/reset-password", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { tempPassword } = req.body;
      
      if (!tempPassword) {
        return res.status(400).json({ error: "tempPassword is required" });
      }
      
      const passwordHash = await hashPassword(tempPassword);
      const user = await storage.updateUser(id, { passwordHash });
      
      if (!user) {
        return res.status(404).json({ error: "Employee not found" });
      }
      
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ==================== CLIENTS (CRM) ====================
  // All roles can view clients
  app.get("/api/clients", authMiddleware, async (req, res) => {
    try {
      const { q, industry, status } = req.query;
      const clients = await storage.searchClients({
        query: q as string | undefined,
        industry: industry as string | undefined,
        status: status as string | undefined,
      });
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClient(id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // Only admin and pm can create clients
  app.post("/api/clients", authMiddleware, requireRoles("admin", "pm", "ra"), async (req, res) => {
    try {
      const result = insertClientSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const client = await storage.createClient(result.data);
      res.status(201).json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client" });
    }
  });

  // Only admin and pm can update clients
  app.patch("/api/clients/:id", authMiddleware, requireRoles("admin", "pm", "ra"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertClientSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const client = await storage.updateClient(id, result.data);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Only admin can delete clients
  app.delete("/api/clients/:id", authMiddleware, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClient(id);
      if (!deleted) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ==================== CLIENT ORGANIZATIONS ====================
  app.get("/api/client-organizations", authMiddleware, async (req, res) => {
    try {
      const organizations = await storage.getClientOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client organizations" });
    }
  });

  app.get("/api/client-organizations/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = await storage.getClientOrganization(id);
      if (!org) {
        return res.status(404).json({ error: "Client organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client organization" });
    }
  });

  app.get("/api/client-organizations/:id/projects", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projects = await storage.getProjectsByOrganization(id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization projects" });
    }
  });

  app.get("/api/client-organizations/:id/pocs", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pocs = await storage.getClientPocsByOrganization(id);
      res.json(pocs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization POCs" });
    }
  });

  app.post("/api/client-organizations", authMiddleware, async (req, res) => {
    try {
      const result = insertClientOrganizationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const org = await storage.createClientOrganization(result.data);
      res.status(201).json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client organization" });
    }
  });

  app.patch("/api/client-organizations/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertClientOrganizationSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const org = await storage.updateClientOrganization(id, result.data);
      if (!org) {
        return res.status(404).json({ error: "Client organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client organization" });
    }
  });

  app.delete("/api/client-organizations/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClientOrganization(id);
      if (!deleted) {
        return res.status(404).json({ error: "Client organization not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client organization" });
    }
  });

  // ==================== CLIENT POCS ====================
  app.get("/api/client-pocs", authMiddleware, async (req, res) => {
    try {
      const organizationId = req.query.organizationId ? parseInt(req.query.organizationId as string) : null;
      const pocs = organizationId
        ? await storage.getClientPocsByOrganization(organizationId)
        : await storage.getClientPocs();
      res.json(pocs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client POCs" });
    }
  });

  app.post("/api/client-pocs", authMiddleware, async (req, res) => {
    try {
      const result = insertClientPocSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const poc = await storage.createClientPoc(result.data);
      res.status(201).json(poc);
    } catch (error) {
      res.status(500).json({ error: "Failed to create client POC" });
    }
  });

  app.patch("/api/client-pocs/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertClientPocSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const poc = await storage.updateClientPoc(id, result.data);
      if (!poc) {
        return res.status(404).json({ error: "Client POC not found" });
      }
      res.json(poc);
    } catch (error) {
      res.status(500).json({ error: "Failed to update client POC" });
    }
  });

  app.delete("/api/client-pocs/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteClientPoc(id);
      if (!deleted) {
        return res.status(404).json({ error: "Client POC not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client POC" });
    }
  });

  // ==================== PROJECTS ====================
  app.get("/api/projects", authMiddleware, async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", authMiddleware, async (req, res) => {
    try {
      const result = insertProjectSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const project = await storage.createProject(result.data);
      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const project = await storage.updateProject(id, result.data);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProject(id);
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  // ==================== EXPERTS ====================
  app.get("/api/experts", authMiddleware, async (req, res) => {
    try {
      const query = req.query.search as string;
      const experts = query
        ? await storage.searchExperts(query)
        : await storage.getExperts();
      res.json(experts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch experts" });
    }
  });

  // Advanced expert search with filters
  app.get("/api/experts/search", authMiddleware, async (req, res) => {
    try {
      const params = {
        query: req.query.q as string | undefined,
        country: req.query.country as string | undefined,
        minRate: req.query.minRate ? parseFloat(req.query.minRate as string) : undefined,
        maxRate: req.query.maxRate ? parseFloat(req.query.maxRate as string) : undefined,
      };
      const experts = await storage.searchExpertsAdvanced(params);
      res.json(experts);
    } catch (error) {
      res.status(500).json({ error: "Failed to search experts" });
    }
  });

  app.get("/api/experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const expert = await storage.getExpert(id);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert" });
    }
  });

  app.get("/api/experts/:id/consultations", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const callRecords = await storage.getCallRecordsByExpert(id);
      res.json(callRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert consultations" });
    }
  });

  app.get("/api/experts/:id/assignments", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignments = await storage.getProjectExpertsByExpert(id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert assignments" });
    }
  });

  app.post("/api/experts", authMiddleware, async (req, res) => {
    try {
      const result = insertExpertSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const expert = await storage.createExpert(result.data);
      res.status(201).json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to create expert" });
    }
  });

  app.patch("/api/experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertExpertSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const expert = await storage.updateExpert(id, result.data);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expert" });
    }
  });

  app.delete("/api/experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteExpert(id);
      if (!deleted) {
        return res.status(404).json({ error: "Expert not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expert" });
    }
  });

  // ==================== VETTING QUESTIONS ====================
  app.get("/api/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const questions = projectId
        ? await storage.getVettingQuestionsByProject(projectId)
        : await storage.getVettingQuestions();
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vetting questions" });
    }
  });

  app.post("/api/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const result = insertVettingQuestionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const question = await storage.createVettingQuestion(result.data);
      res.status(201).json(question);
    } catch (error) {
      res.status(500).json({ error: "Failed to create vetting question" });
    }
  });

  app.patch("/api/vetting-questions/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertVettingQuestionSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const question = await storage.updateVettingQuestion(id, result.data);
      if (!question) {
        return res.status(404).json({ error: "Vetting question not found" });
      }
      res.json(question);
    } catch (error) {
      res.status(500).json({ error: "Failed to update vetting question" });
    }
  });

  app.delete("/api/vetting-questions/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteVettingQuestion(id);
      if (!deleted) {
        return res.status(404).json({ error: "Vetting question not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vetting question" });
    }
  });

  // ==================== PROJECT EXPERTS ====================
  app.get("/api/project-experts", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const assignments = projectId
        ? await storage.getProjectExpertsByProject(projectId)
        : await storage.getProjectExperts();
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project experts" });
    }
  });

  app.get("/api/project-experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.getProjectExpert(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assignment" });
    }
  });

  app.post("/api/project-experts", authMiddleware, async (req, res) => {
    try {
      const result = insertProjectExpertSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const assignment = await storage.createProjectExpert(result.data);
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign expert to project" });
    }
  });

  app.patch("/api/project-experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectExpertSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const assignment = await storage.updateProjectExpert(id, result.data);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  // Send invitation to expert
  app.post("/api/project-experts/:id/invite", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.updateProjectExpert(id, {
        status: "invited",
        invitedAt: new Date(),
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to send invitation" });
    }
  });

  // Expert accepts invitation
  app.post("/api/project-experts/:id/accept", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { vqAnswers, availabilityNote } = req.body;
      const assignment = await storage.updateProjectExpert(id, {
        status: "accepted",
        respondedAt: new Date(),
        vqAnswers,
        availabilityNote,
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Expert declines invitation
  app.post("/api/project-experts/:id/decline", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.updateProjectExpert(id, {
        status: "declined",
        respondedAt: new Date(),
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to decline invitation" });
    }
  });

  // Client selects expert
  app.post("/api/project-experts/:id/select", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignment = await storage.updateProjectExpert(id, {
        status: "client_selected",
      });
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to select expert" });
    }
  });

  app.delete("/api/project-experts/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteProjectExpert(id);
      if (!deleted) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove expert from project" });
    }
  });

  // Bulk attach experts to project
  app.post("/api/projects/:projectId/experts/bulk", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { expertIds } = req.body;
      
      if (!Array.isArray(expertIds) || expertIds.length === 0) {
        return res.status(400).json({ error: "expertIds must be a non-empty array" });
      }
      
      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get existing assignments to avoid duplicates
      const existingAssignments = await storage.getProjectExpertsByProject(projectId);
      const existingExpertIds = new Set(existingAssignments.map(a => a.expertId));
      
      // Filter out already assigned experts
      const newExpertIds = expertIds.filter((id: number) => !existingExpertIds.has(id));
      
      if (newExpertIds.length === 0) {
        return res.status(200).json({ 
          message: "All experts are already assigned to this project",
          assignments: [] 
        });
      }
      
      const assignments = await storage.createProjectExpertsBulk(
        newExpertIds.map((expertId: number) => ({
          projectId,
          expertId,
          status: "assigned",
        }))
      );
      
      res.status(201).json({ 
        message: `${assignments.length} experts attached to project`,
        assignments 
      });
    } catch (error) {
      console.error("Bulk attach error:", error);
      res.status(500).json({ error: "Failed to attach experts to project" });
    }
  });

  // Send bulk invitations to experts
  app.post("/api/projects/:projectId/invitations/send", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { projectExpertIds, channel } = req.body; // channel: 'email' | 'whatsapp' | 'both'
      
      if (!Array.isArray(projectExpertIds) || projectExpertIds.length === 0) {
        return res.status(400).json({ error: "projectExpertIds must be a non-empty array" });
      }
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions for the project
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectId);
      
      const results = [];
      
      for (const peId of projectExpertIds) {
        const pe = await storage.getProjectExpert(peId);
        if (!pe || pe.projectId !== projectId) continue;
        
        const expert = await storage.getExpert(pe.expertId);
        if (!expert) continue;
        
        // Generate unique invitation token
        const token = crypto.randomBytes(32).toString("hex");
        
        // Update project-expert with token and status
        const updatedPe = await storage.updateProjectExpert(peId, {
          status: "invited",
          invitedAt: new Date(),
          invitationToken: token,
        });
        
        // Generate invitation URL
        const baseUrl = process.env.REPLIT_DEV_DOMAIN 
          ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
          : "http://localhost:5000";
        const invitationUrl = `${baseUrl}/expert-invite/${token}`;
        
        // Simulate sending email/whatsapp
        console.log(`[${channel || 'email'}] Sending invitation to ${expert.name} (${expert.email})`);
        console.log(`  Project: ${project.name}`);
        console.log(`  Invitation URL: ${invitationUrl}`);
        console.log(`  Vetting Questions: ${vettingQuestions.length}`);
        
        results.push({
          expertId: expert.id,
          expertName: expert.name,
          email: expert.email,
          invitationUrl,
          status: "sent",
        });
      }
      
      res.json({
        message: `Invitations sent to ${results.length} experts`,
        channel: channel || 'email',
        results,
      });
    } catch (error) {
      console.error("Send invitations error:", error);
      res.status(500).json({ error: "Failed to send invitations" });
    }
  });

  // ==================== EXPERT INVITATION (PUBLIC) ====================
  // Get invitation details by token (for expert to view project and questions)
  app.get("/api/expert-invite/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const pe = await storage.getProjectExpertByToken(token);
      
      if (!pe) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      // Check if already responded
      if (pe.status === "accepted" || pe.status === "declined") {
        return res.status(400).json({ 
          error: "This invitation has already been responded to",
          status: pe.status
        });
      }
      
      // Get project details
      const project = await storage.getProject(pe.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get expert details
      const expert = await storage.getExpert(pe.expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      
      // Get vetting questions
      const vettingQuestions = await storage.getVettingQuestionsByProject(pe.projectId);
      
      res.json({
        projectExpertId: pe.id,
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
          description: project.description,
        },
        expert: {
          id: expert.id,
          name: expert.name,
          email: expert.email,
        },
        vettingQuestions: vettingQuestions.map(q => ({
          id: q.id,
          question: q.question,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
        })),
        invitedAt: pe.invitedAt,
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ error: "Failed to fetch invitation details" });
    }
  });

  // Accept invitation with VQ answers
  app.post("/api/expert-invite/:token/accept", async (req, res) => {
    try {
      const token = req.params.token;
      const { vqAnswers, availabilityNote } = req.body;
      
      const pe = await storage.getProjectExpertByToken(token);
      
      if (!pe) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      if (pe.status === "accepted" || pe.status === "declined") {
        return res.status(400).json({ 
          error: "This invitation has already been responded to",
          status: pe.status
        });
      }
      
      // Update project-expert with answers and status
      const updated = await storage.updateProjectExpert(pe.id, {
        status: "accepted",
        respondedAt: new Date(),
        vqAnswers,
        availabilityNote,
      });
      
      res.json({
        message: "Thank you, your response has been recorded.",
        status: "accepted",
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Decline invitation
  app.post("/api/expert-invite/:token/decline", async (req, res) => {
    try {
      const token = req.params.token;
      const { reason } = req.body;
      
      const pe = await storage.getProjectExpertByToken(token);
      
      if (!pe) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      
      if (pe.status === "accepted" || pe.status === "declined") {
        return res.status(400).json({ 
          error: "This invitation has already been responded to",
          status: pe.status
        });
      }
      
      // Update project-expert with declined status
      const updated = await storage.updateProjectExpert(pe.id, {
        status: "declined",
        respondedAt: new Date(),
        notes: reason || null,
      });
      
      res.json({
        message: "Thank you, your response has been recorded.",
        status: "declined",
      });
    } catch (error) {
      console.error("Decline invitation error:", error);
      res.status(500).json({ error: "Failed to decline invitation" });
    }
  });

  // ==================== CALL RECORDS ====================
  app.get("/api/call-records", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const expertId = req.query.expertId ? parseInt(req.query.expertId as string) : null;
      
      let records;
      if (projectId) {
        records = await storage.getCallRecordsByProject(projectId);
      } else if (expertId) {
        records = await storage.getCallRecordsByExpert(expertId);
      } else {
        records = await storage.getCallRecords();
      }
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch call records" });
    }
  });

  app.get("/api/call-records/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const record = await storage.getCallRecord(id);
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch call record" });
    }
  });

  app.post("/api/call-records", authMiddleware, async (req, res) => {
    try {
      const result = insertCallRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const record = await storage.createCallRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create call record" });
    }
  });

  app.patch("/api/call-records/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertCallRecordSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const record = await storage.updateCallRecord(id, result.data);
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to update call record" });
    }
  });

  // Schedule consultation
  app.post("/api/call-records/:id/schedule", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledStartTime, scheduledEndTime, zoomLink } = req.body;
      const record = await storage.updateCallRecord(id, {
        status: "scheduled",
        scheduledStartTime: new Date(scheduledStartTime),
        scheduledEndTime: new Date(scheduledEndTime),
        zoomLink,
      });
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to schedule consultation" });
    }
  });

  // Complete consultation
  app.post("/api/call-records/:id/complete", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const { actualDurationMinutes, recordingUrl, notes } = req.body;
      
      const cuUsed = calculateCU(actualDurationMinutes || 0);
      const record = await storage.updateCallRecord(id, {
        status: "completed",
        actualDurationMinutes,
        durationMinutes: actualDurationMinutes,
        recordingUrl,
        notes,
        completedAt: new Date(),
      });
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete consultation" });
    }
  });

  // Cancel consultation
  app.post("/api/call-records/:id/cancel", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const record = await storage.updateCallRecord(id, {
        status: "cancelled",
        notes: reason,
      });
      if (!record) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to cancel consultation" });
    }
  });

  app.delete("/api/call-records/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteCallRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Call record not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete call record" });
    }
  });

  // ==================== EXPERT INVITATION LINKS ====================
  app.get("/api/invitation-links", authMiddleware, async (req, res) => {
    try {
      const links = await storage.getExpertInvitationLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitation links" });
    }
  });

  app.get("/api/invitation-links/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.usedAt) {
        return res.status(400).json({ error: "Invitation link already used" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link expired" });
      }
      res.json(link);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitation link" });
    }
  });

  app.post("/api/invitation-links", authMiddleware, async (req, res) => {
    try {
      const token = crypto.randomBytes(32).toString("hex");
      const result = insertExpertInvitationLinkSchema.safeParse({
        ...req.body,
        token,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const link = await storage.createExpertInvitationLink(result.data);
      res.status(201).json(link);
    } catch (error) {
      res.status(500).json({ error: "Failed to create invitation link" });
    }
  });

  // Register expert via invitation link
  app.post("/api/register-expert/:token", async (req, res) => {
    try {
      const token = req.params.token;
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.usedAt) {
        return res.status(400).json({ error: "Invitation link already used" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link expired" });
      }

      const expertData = {
        ...req.body,
        recruitedBy: link.recruitedBy,
      };

      const result = insertExpertSchema.safeParse(expertData);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }

      const expert = await storage.createExpert(result.data);
      await storage.markInvitationLinkUsed(token);

      // If link is for a specific project, auto-assign expert
      if (link.projectId) {
        await storage.createProjectExpert({
          projectId: link.projectId,
          expertId: expert.id,
          status: "assigned",
        });
      }

      res.status(201).json(expert);
    } catch (error) {
      res.status(500).json({ error: "Failed to register expert" });
    }
  });

  // ==================== USAGE RECORDS (LEGACY) ====================
  app.get("/api/usage", authMiddleware, async (req, res) => {
    try {
      const records = await storage.getUsageRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage records" });
    }
  });

  app.post("/api/usage", authMiddleware, async (req, res) => {
    try {
      const result = insertUsageRecordSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const record = await storage.createUsageRecord(result.data);
      res.status(201).json(record);
    } catch (error) {
      res.status(500).json({ error: "Failed to create usage record" });
    }
  });

  app.delete("/api/usage/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUsageRecord(id);
      if (!deleted) {
        return res.status(404).json({ error: "Usage record not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete usage record" });
    }
  });

  // ==================== CU CALCULATION UTILITY ====================
  app.get("/api/calculate-cu", (req, res) => {
    try {
      const minutes = parseInt(req.query.minutes as string) || 0;
      const cu = calculateCU(minutes);
      res.json({ minutes, cu });
    } catch (error) {
      res.status(500).json({ error: "Failed to calculate CU" });
    }
  });

  // ==================== KPI & INCENTIVE DASHBOARD ====================
  /**
   * GET /api/kpi/my-monthly
   * 
   * Returns monthly KPI data and incentive calculations for the authenticated user.
   * All date filtering is done in America/Sao_Paulo timezone.
   * 
   * Incentive Rules:
   * - RA: R$250 per completed call (expert must be sourced by RA and call within 60 days of sourcing). Cap: R$2,500/month.
   * - PM: R$70 per CU (Credit Unit = 1 hour). No cap.
   * - Admin/Finance: See global totals for all calls.
   */
  app.get("/api/kpi/my-monthly", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get current month boundaries in Brazil timezone (America/Sao_Paulo)
      // Using date-fns-tz for proper DST handling
      const BRAZIL_TZ = "America/Sao_Paulo";
      const now = new Date();
      
      // Convert current UTC time to Brazil timezone
      const brazilNow = toZonedTime(now, BRAZIL_TZ);
      
      const year = brazilNow.getFullYear();
      const month = brazilNow.getMonth(); // 0-indexed
      
      // Get month boundaries in Brazil timezone
      const monthStartInBrazil = startOfMonth(brazilNow);
      const nextMonthStartInBrazil = addMonths(monthStartInBrazil, 1);
      
      // Convert back to UTC for database queries (DST-safe)
      // Use start of next month as exclusive upper bound
      const monthStartUTC = fromZonedTime(monthStartInBrazil, BRAZIL_TZ);
      const monthEndUTC = fromZonedTime(nextMonthStartInBrazil, BRAZIL_TZ);

      // Base query: get all completed call records for this month with joins
      const baseQuery = await db
        .select({
          id: callRecords.id,
          projectId: callRecords.projectId,
          expertId: callRecords.expertId,
          pmId: callRecords.pmId,
          raId: callRecords.raId,
          durationMinutes: callRecords.durationMinutes,
          cuUsed: callRecords.cuUsed,
          completedAt: callRecords.completedAt,
          callDate: callRecords.callDate,
          status: callRecords.status,
          projectName: projects.name,
          clientName: projects.clientName,
          cuRatePerCU: projects.cuRatePerCU,
          expertName: experts.name,
          expertSourcedByRaId: experts.sourcedByRaId,
          expertSourcedAt: experts.sourcedAt,
        })
        .from(callRecords)
        .innerJoin(projects, eq(callRecords.projectId, projects.id))
        .innerJoin(experts, eq(callRecords.expertId, experts.id))
        .where(
          and(
            eq(callRecords.status, "completed"),
            sql`${callRecords.completedAt} IS NOT NULL`,
            gte(callRecords.completedAt, monthStartUTC),
            lt(callRecords.completedAt, monthEndUTC)
          )
        );

      let filteredCalls: typeof baseQuery = [];
      let totals = {
        totalCalls: 0,
        totalCU: 0,
        incentive: 0,
      };

      const role = user.role;
      const userId = user.id;

      if (role === "ra") {
        // RA: Only calls where expert was sourced by this RA AND call completed within 60 days of sourcing
        filteredCalls = baseQuery.filter((call) => {
          if (call.expertSourcedByRaId !== userId) return false;
          if (!call.expertSourcedAt || !call.completedAt) return false;
          
          const sourcedAt = new Date(call.expertSourcedAt);
          const completedAt = new Date(call.completedAt);
          const daysDiff = (completedAt.getTime() - sourcedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          return daysDiff <= 60;
        });

        totals.totalCalls = filteredCalls.length;
        totals.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        const rawIncentive = totals.totalCalls * 250;
        totals.incentive = Math.min(rawIncentive, 2500); // Cap at R$2,500

      } else if (role === "pm") {
        // PM: Calls where pmId = current user
        filteredCalls = baseQuery.filter((call) => call.pmId === userId);

        totals.totalCalls = filteredCalls.length;
        totals.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        totals.incentive = Math.round(totals.totalCU * 70 * 100) / 100; // R$70 per CU, no cap

      } else if (role === "admin" || role === "finance") {
        // Admin/Finance: See all calls (global totals) with company revenue
        filteredCalls = baseQuery;

        totals.totalCalls = filteredCalls.length;
        totals.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        // Admin/Finance do not have incentive calculations
        totals.incentive = 0;
      }

      // Calculate company revenue for admin/finance
      let totalCompanyRevenueUSD = 0;
      
      // Format calls for response
      const calls = filteredCalls.map((call) => {
        const callDate = call.completedAt || call.callDate;
        // Convert to Brazil timezone for display using date-fns-tz
        const brazilTime = toZonedTime(new Date(callDate), BRAZIL_TZ);
        
        const cuUsed = parseFloat(call.cuUsed || "0");
        const cuRate = parseFloat(call.cuRatePerCU || "1150");
        const revenueUSD = cuUsed * cuRate;
        
        // Only add to company total if admin/finance role
        if (role === "admin" || role === "finance") {
          totalCompanyRevenueUSD += revenueUSD;
        }
        
        return {
          id: call.id,
          interviewDate: format(brazilTime, "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: BRAZIL_TZ }),
          expertName: call.expertName,
          projectName: call.projectName,
          clientName: call.clientName,
          cuUsed: cuUsed,
          cuRatePerCU: cuRate,
          revenueUSD: Math.round(revenueUSD * 100) / 100,
        };
      });

      // Round totals
      totals.totalCU = Math.round(totals.totalCU * 100) / 100;
      totalCompanyRevenueUSD = Math.round(totalCompanyRevenueUSD * 100) / 100;

      // Add company revenue to response for admin/finance
      const responseData: any = {
        role,
        period: {
          month: month + 1, // 1-indexed for display
          year,
          timezone: "America/Sao_Paulo",
        },
        totals,
        calls,
      };
      
      if (role === "admin" || role === "finance") {
        responseData.companyTotals = {
          totalCompanyCU: totals.totalCU,
          totalCompanyCalls: totals.totalCalls,
          totalCompanyRevenueUSD: totalCompanyRevenueUSD,
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("KPI endpoint error:", error);
      res.status(500).json({ error: "Failed to fetch KPI data" });
    }
  });

  return httpServer;
}
