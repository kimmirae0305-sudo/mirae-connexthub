import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== USERS ====================
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
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

  app.post("/api/users", async (req, res) => {
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

  app.patch("/api/users/:id", async (req, res) => {
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

  app.delete("/api/users/:id", async (req, res) => {
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

  // ==================== CLIENT ORGANIZATIONS ====================
  app.get("/api/client-organizations", async (req, res) => {
    try {
      const organizations = await storage.getClientOrganizations();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client organizations" });
    }
  });

  app.get("/api/client-organizations/:id", async (req, res) => {
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

  app.get("/api/client-organizations/:id/projects", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const projects = await storage.getProjectsByOrganization(id);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization projects" });
    }
  });

  app.get("/api/client-organizations/:id/pocs", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pocs = await storage.getClientPocsByOrganization(id);
      res.json(pocs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization POCs" });
    }
  });

  app.post("/api/client-organizations", async (req, res) => {
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

  app.patch("/api/client-organizations/:id", async (req, res) => {
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

  app.delete("/api/client-organizations/:id", async (req, res) => {
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
  app.get("/api/client-pocs", async (req, res) => {
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

  app.post("/api/client-pocs", async (req, res) => {
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

  app.patch("/api/client-pocs/:id", async (req, res) => {
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

  app.delete("/api/client-pocs/:id", async (req, res) => {
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
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
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

  app.post("/api/projects", async (req, res) => {
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

  app.patch("/api/projects/:id", async (req, res) => {
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

  app.delete("/api/projects/:id", async (req, res) => {
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
  app.get("/api/experts", async (req, res) => {
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

  app.get("/api/experts/:id", async (req, res) => {
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

  app.get("/api/experts/:id/consultations", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const callRecords = await storage.getCallRecordsByExpert(id);
      res.json(callRecords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert consultations" });
    }
  });

  app.get("/api/experts/:id/assignments", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assignments = await storage.getProjectExpertsByExpert(id);
      res.json(assignments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expert assignments" });
    }
  });

  app.post("/api/experts", async (req, res) => {
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

  app.patch("/api/experts/:id", async (req, res) => {
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

  app.delete("/api/experts/:id", async (req, res) => {
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
  app.get("/api/vetting-questions", async (req, res) => {
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

  app.post("/api/vetting-questions", async (req, res) => {
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

  app.patch("/api/vetting-questions/:id", async (req, res) => {
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

  app.delete("/api/vetting-questions/:id", async (req, res) => {
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
  app.get("/api/project-experts", async (req, res) => {
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

  app.get("/api/project-experts/:id", async (req, res) => {
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

  app.post("/api/project-experts", async (req, res) => {
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

  app.patch("/api/project-experts/:id", async (req, res) => {
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
  app.post("/api/project-experts/:id/invite", async (req, res) => {
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
  app.post("/api/project-experts/:id/accept", async (req, res) => {
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
  app.post("/api/project-experts/:id/decline", async (req, res) => {
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
  app.post("/api/project-experts/:id/select", async (req, res) => {
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

  app.delete("/api/project-experts/:id", async (req, res) => {
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

  // ==================== CALL RECORDS ====================
  app.get("/api/call-records", async (req, res) => {
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

  app.get("/api/call-records/:id", async (req, res) => {
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

  app.post("/api/call-records", async (req, res) => {
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

  app.patch("/api/call-records/:id", async (req, res) => {
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
  app.post("/api/call-records/:id/schedule", async (req, res) => {
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
  app.post("/api/call-records/:id/complete", async (req, res) => {
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
  app.post("/api/call-records/:id/cancel", async (req, res) => {
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

  app.delete("/api/call-records/:id", async (req, res) => {
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
  app.get("/api/invitation-links", async (req, res) => {
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

  app.post("/api/invitation-links", async (req, res) => {
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
  app.get("/api/usage", async (req, res) => {
    try {
      const records = await storage.getUsageRecords();
      res.json(records);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage records" });
    }
  });

  app.post("/api/usage", async (req, res) => {
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

  app.delete("/api/usage/:id", async (req, res) => {
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

  return httpServer;
}
