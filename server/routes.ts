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
  insertProjectAngleSchema,
  calculateCU,
  callRecords,
  experts,
  projects,
  expertInvitationLinks,
  projectExperts,
  projectAngles,
  users,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import crypto from "crypto";
import { authMiddleware, loginHandler, getMeHandler, requireAdmin, requireRoles, hashPassword, comparePassword, type AuthRequest } from "./auth";
import { insertClientSchema } from "@shared/schema";
import { eq, and, gte, lt, sql, desc, inArray } from "drizzle-orm";
import { toZonedTime, fromZonedTime, format } from "date-fns-tz";
import { startOfMonth, addMonths } from "date-fns";
import { sendExpertInvitationEmail, verifySmtpConnection } from "./email";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== AUTH ROUTES (PUBLIC) ====================
  app.post("/api/auth/login", loginHandler);
  app.get("/api/auth/me", authMiddleware, getMeHandler);

  // POST /api/auth/change-password - Change password on first login
  app.post("/api/auth/change-password", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current and new passwords are required" });
      }

      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user from database
      const user = await storage.getUser(req.user.id);
      if (!user || !user.passwordHash) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password and update user
      const hashedNewPassword = await hashPassword(newPassword);
      await storage.updateUser(req.user.id, {
        passwordHash: hashedNewPassword,
        mustChangePassword: false,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

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

  // Get RAs for assignment (users with role 'ra')
  // IMPORTANT: Must be BEFORE /:id route to avoid route matching conflicts
  app.get("/api/users/ras", authMiddleware, async (req, res) => {
    try {
      console.log("[RA DEBUG] ===== START RAs ENDPOINT =====");
      const users = await storage.getUsers();
      console.log(`[RA DEBUG] Total users fetched: ${users.length}`);
      
      // Log ALL active employees with full details
      console.log("[RA DEBUG] All active employees:", users.map(u => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        isRaRawCheck: u.role === "ra",
        isResearchAssociateRawCheck: u.role === "Research Associate",
        isActiveCheck: u.isActive === true,
      })));
      
      console.log(`[RA DEBUG] Users by role:`, users.reduce((acc: any, u: any) => {
        acc[u.role] = (acc[u.role] || 0) + 1;
        return acc;
      }, {}));
      
      // Apply filtering with detailed logging
      const ras = users.filter(u => {
        const matchesRole = u.role === "ra" || u.role === "Research Associate";
        const isActive = u.isActive === true;
        console.log(`[RA DEBUG] User ${u.fullName} (${u.email}): role="${u.role}", matchesRole=${matchesRole}, isActive=${isActive}, passes=${matchesRole && isActive}`);
        return matchesRole && isActive;
      });
      
      console.log(`[RA DEBUG] Filtered RAs: ${ras.length} active RAs found`);
      
      const result = ras.map(ra => ({ 
        id: ra.id, 
        fullName: ra.fullName, 
        email: ra.email 
      }));
      
      console.log(`[RA DEBUG] Returning ${result.length} RAs:`, result);
      console.log("[RA DEBUG] ===== END RAs ENDPOINT =====");
      res.json(result);
    } catch (error) {
      console.error("[RA DEBUG] Error fetching RAs:", error);
      res.status(500).json({ error: "Failed to fetch RAs" });
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
        mustChangePassword: true, // Force password change on first login
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
      const user = (req as any).user;
      let projects = await storage.getProjects();
      
      // Filter by RA's assigned projects if user is RA
      if (user?.role === "ra" || user?.role === "Research Associate") {
        projects = projects.filter((p: any) => 
          p.assignedRaId === user.id || 
          (p.assignedRaIds && p.assignedRaIds.includes(user.id))
        );
      }
      
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Helper function to check if RA has access to project
  // Checks both legacy single RA field (assignedRaId) and new array field (assignedRaIds)
  function raHasProjectAccess(project: any, userId: number): boolean {
    // Check legacy single RA assignment
    if (project.assignedRaId === userId) {
      return true;
    }
    // Check new array-based assignment (only if array exists and has entries)
    if (Array.isArray(project.assignedRaIds) && project.assignedRaIds.includes(userId)) {
      return true;
    }
    return false;
  }

  app.get("/api/projects/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check RA access
      if ((user?.role === "ra" || user?.role === "Research Associate") && !raHasProjectAccess(project, user.id)) {
        return res.status(403).json({ error: "Access denied: You are not assigned to this project" });
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

  // Get project detail with experts, activities, and vetting questions
  app.get("/api/projects/:id/detail", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = (req as any).user;
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Check RA access
      if ((user?.role === "ra" || user?.role === "Research Associate") && !raHasProjectAccess(project, user.id)) {
        return res.status(403).json({ error: "Access denied: You are not assigned to this project" });
      }

      // Fetch related data
      const [projectExperts, vettingQuestions, activities, inviteLinks, angles] = await Promise.all([
        storage.getProjectExpertsByProject(id),
        storage.getVettingQuestionsByProject(id),
        storage.getProjectActivities(id),
        storage.getExpertInvitationLinksByProject(id),
        storage.getProjectAngles(id),
      ]);

      // Enrich project experts with expert details
      const enrichedExperts = await Promise.all(
        projectExperts.map(async (pe) => {
          const expert = await storage.getExpert(pe.expertId);
          let sourcedByRa = null;
          if (pe.sourcedByRaId) {
            sourcedByRa = await storage.getUser(pe.sourcedByRaId);
          }
          return {
            ...pe,
            expert,
            sourcedByRa: sourcedByRa ? { id: sourcedByRa.id, fullName: sourcedByRa.fullName } : null,
          };
        })
      );

      // Fetch assigned RAs details
      let assignedRas: { id: number; fullName: string; email: string }[] = [];
      if (project.assignedRaIds && project.assignedRaIds.length > 0) {
        const raPromises = project.assignedRaIds.map(async (raId) => {
          const ra = await storage.getUser(raId);
          return ra ? { id: ra.id, fullName: ra.fullName, email: ra.email } : null;
        });
        assignedRas = (await Promise.all(raPromises)).filter(Boolean) as typeof assignedRas;
      }

      // Fetch PM details
      let createdByPm = null;
      if (project.createdByPmId) {
        const pm = await storage.getUser(project.createdByPmId);
        if (pm) {
          createdByPm = { id: pm.id, fullName: pm.fullName, email: pm.email };
        }
      }

      // Separate experts by source type
      const internalExperts = enrichedExperts.filter(e => e.sourceType === "internal_db");
      const raSourcedExperts = enrichedExperts.filter(e => e.sourceType === "ra_external");

      // Get RA invite links (including quick invites)
      const raInviteLinks = inviteLinks.filter(l => (l.inviteType === "ra" || l.inviteType === "quick") && l.isActive);

      res.json({
        ...project,
        createdByPm,
        assignedRas,
        vettingQuestions,
        internalExperts,
        raSourcedExperts,
        activities,
        raInviteLinks,
        angles,
      });
    } catch (error) {
      console.error("Error fetching project detail:", error);
      res.status(500).json({ error: "Failed to fetch project detail" });
    }
  });

  // Assign RAs to project
  app.post("/api/projects/:id/assign-ras", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { raIds } = req.body;

      if (!Array.isArray(raIds)) {
        return res.status(400).json({ error: "raIds must be an array" });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Update project with assigned RAs
      const updated = await storage.updateProject(id, {
        assignedRaIds: raIds,
        updatedAt: new Date(),
      } as any);

      // Log activity
      const user = (req as any).user;
      await storage.createProjectActivity({
        projectId: id,
        userId: user?.id,
        activityType: "ra_assigned",
        description: `Assigned ${raIds.length} RA(s) to project`,
        metadata: { raIds } as Record<string, any>,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error assigning RAs:", error);
      res.status(500).json({ error: "Failed to assign RAs" });
    }
  });

  // Generate RA-specific invite link (always creates a NEW unique token)
  app.post("/api/projects/:id/ra-invite-link", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { raId, candidateName, candidateEmail } = req.body;

      if (!raId) {
        return res.status(400).json({ error: "raId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const ra = await storage.getUser(raId);
      if (!ra || (ra.role !== "ra" && ra.role !== "Research Associate")) {
        return res.status(400).json({ error: "Invalid RA" });
      }

      // ALWAYS generate a NEW unique token for each invitation
      const token = crypto.randomBytes(32).toString("hex");
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        raId,
        inviteType: "ra",
        candidateName: candidateName || null,
        candidateEmail: candidateEmail || null,
        status: "pending",
        recruitedBy: ra.email,
        isActive: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
      const inviteUrl = `${baseUrl}/invite/${projectId}/ra/${link.token}`;
      res.json({ link, inviteUrl });
    } catch (error) {
      console.error("Error generating RA invite link:", error);
      res.status(500).json({ error: "Failed to generate RA invite link" });
    }
  });

  // Register new expert from RA Sourcing tab (creates expert, attaches to project, generates invite)
  app.post("/api/projects/:projectId/register-expert", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = (req as any).user;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const {
        email,
        firstName,
        lastName,
        country,
        region,
        countryCode,
        phoneNumber,
        linkedinUrl,
        city,
        canConsultInEnglish,
        timezone,
        experiences,
        biography,
        workHistory,
        hourlyRate,
        currency,
      } = req.body;

      // Check if expert with email already exists
      const existingExpert = await storage.getExpertByEmail(email);
      if (existingExpert) {
        return res.status(400).json({ error: "An expert with this email already exists" });
      }

      // Format phone number
      const fullPhone = `${countryCode} ${phoneNumber}`.trim();

      // Format experience for bio/company/job title
      const currentExperience = experiences?.find((e: any) => e.isCurrent) || experiences?.[0];
      const experienceText = experiences?.map((e: any) => {
        const period = e.isCurrent 
          ? `${e.fromMonth}/${e.fromYear} - Present`
          : `${e.fromMonth}/${e.fromYear} - ${e.toMonth}/${e.toYear}`;
        return `${e.title} at ${e.company} (${period})`;
      }).join("\n") || "";

      // Get RA ID for sourcedByRaId
      let sourcedByRaId: number | null = null;
      if (user && (user.role === "ra" || user.role === "Research Associate")) {
        sourcedByRaId = user.id;
      }

      // Create expert
      const expertData = {
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone: fullPhone || null,
        linkedinUrl: linkedinUrl || null,
        country: country || null,
        city: city || null,
        region: region || null,
        timezone: timezone || null,
        company: currentExperience?.company || null,
        jobTitle: currentExperience?.title || null,
        expertise: currentExperience?.title || null,
        industry: project.industry || null,
        yearsOfExperience: 0,
        hourlyRate: hourlyRate || null,
        currency: currency || "USD",
        bio: biography || null,
        biography: biography || null,
        workHistory: {
          summary: workHistory,
          experiences: experiences || [],
        },
        languages: canConsultInEnglish === "yes" ? ["English"] : [],
        status: "available" as const,
        sourcedByRaId,
        sourcedAt: sourcedByRaId ? new Date() : undefined,
        pastEmployers: experiences?.map((e: any) => e.company) || [],
      };

      const newExpert = await storage.createExpert(expertData);

      // Attach expert to project
      const projectExpert = await storage.createProjectExpert({
        projectId,
        expertId: newExpert.id,
        status: "assigned",
        sourceType: "ra_sourced",
        sourcedByRaId,
        pipelineStatus: "ra_sourced",
      });

      // Generate unique invite token
      const token = crypto.randomBytes(32).toString("hex");
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        expertId: newExpert.id,
        inviteType: "existing",
        candidateName: newExpert.name,
        candidateEmail: newExpert.email || null,
        status: "pending",
        recruitedBy: user?.email || "system",
        raId: sourcedByRaId,
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Update project expert with invitation info
      await storage.updateProjectExpert(projectExpert.id, {
        invitationStatus: "invited",
        invitedAt: new Date(),
        invitationToken: token,
      });

      // Log activity
      await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        expertId: newExpert.id,
        activityType: "expert_registered",
        description: `Registered and invited expert ${newExpert.name} to project`,
      });

      const inviteUrl = `/expert/project-invite/${token}`;
      
      res.status(201).json({
        expertId: newExpert.id,
        projectExpertId: projectExpert.id,
        inviteUrl,
        token,
        message: "Expert registered and attached to project successfully",
      });
    } catch (error) {
      console.error("Error registering expert:", error);
      res.status(500).json({ error: "Failed to register expert" });
    }
  });

  // PUBLIC: Fetch quick invite onboarding data by token
  app.get("/api/quick-invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "pending_onboarding" || !link.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const vettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);

      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
        },
        vettingQuestions: vettingQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          isRequired: q.isRequired,
        })),
      });
    } catch (error) {
      console.error("Error fetching quick invite data:", error);
      res.status(500).json({ error: "Failed to fetch invite data" });
    }
  });

  // PUBLIC: Submit quick invite onboarding form (Step 1)
  app.post("/api/quick-invite/:token/onboard", async (req, res) => {
    try {
      const { token } = req.params;
      const { firstName, lastName, email, phone } = req.body;

      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "pending_onboarding" || !link.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      // Check if expert with email already exists
      let expert = await storage.getExpertByEmail(email);
      
      if (!expert) {
        // Create new expert with recruitment tracking
        const project = await storage.getProject(link.projectId);
        const industryValue = project?.industry || "General";
        expert = await storage.createExpert({
          name: `${firstName} ${lastName}`.trim(),
          email,
          phone: phone || null,
          expertise: "Professional",
          industry: industryValue,
          yearsOfExperience: 0,
          hourlyRate: "0",
          status: "available",
          sourcedByRaId: link.raId || undefined,
          sourcedAt: link.raId ? new Date() : undefined,
        });
      } else if (link.raId && !expert.sourcedByRaId) {
        // Update existing expert with RA tracking if they weren't recruited before
        await storage.updateExpert(expert.id, {
          sourcedByRaId: link.raId,
          sourcedAt: new Date(),
        });
      }

      // Update invitation link status to "onboarded" (waiting for decision)
      await db.update(expertInvitationLinks)
        .set({ status: "onboarded" })
        .where(eq(expertInvitationLinks.token, token));

      // Log activity
      await storage.createProjectActivity({
        projectId: link.projectId,
        expertId: expert.id,
        activityType: "expert_onboarded",
        description: `Expert ${expert.name} completed onboarding via quick invite`,
      });

      res.json({
        success: true,
        expertId: expert.id,
        message: "Onboarding complete",
      });
    } catch (error) {
      console.error("Error during onboarding:", error);
      res.status(500).json({ error: "Failed to save profile" });
    }
  });

  // PUBLIC: Fetch decision page data
  app.get("/api/quick-invite/:token/decision", async (req, res) => {
    try {
      const { token } = req.params;
      
      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "onboarded" || !link.isActive) {
        return res.status(404).json({ error: "Invalid or expired invite link" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const vettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);

      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
        },
        vettingQuestions: vettingQuestions.map((q) => ({
          id: q.id,
          question: q.question,
          isRequired: q.isRequired,
        })),
      });
    } catch (error) {
      console.error("Error fetching decision data:", error);
      res.status(500).json({ error: "Failed to fetch project details" });
    }
  });

  // PUBLIC: Submit decision (Accept/Decline)
  app.post("/api/quick-invite/:token/decide", async (req, res) => {
    try {
      const { token } = req.params;
      const { decision, sampleAnswers } = req.body;

      if (!["accepted", "declined"].includes(decision)) {
        return res.status(400).json({ error: "Invalid decision" });
      }

      const link = await storage.getExpertInvitationLinkByToken(token);
      if (!link || link.status !== "onboarded" || !link.isActive) {
        return res.status(404).json({ error: "This invitation has already been completed or is no longer valid" });
      }

      if (!link.projectId) {
        return res.status(400).json({ error: "Project not found" });
      }

      // Get expert by email from link candidate data
      let expert = link.candidateEmail ? await storage.getExpertByEmail(link.candidateEmail) : null;
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }

      // Create or update project expert with final status
      const existingProjectExperts = await db.select()
        .from(projectExperts)
        .where(
          and(
            eq(projectExperts.projectId, link.projectId),
            eq(projectExperts.expertId, expert.id)
          )
        )
        .limit(1);
      
      let projectExpert = existingProjectExperts[0];

      const finalStatus = decision === "accepted" ? "interested" : "declined";
      const finalPipelineStatus = decision === "accepted" ? "interested" : "declined";

      if (!projectExpert) {
        projectExpert = await storage.createProjectExpert({
          projectId: link.projectId,
          expertId: expert.id,
          status: finalStatus,
          sourceType: "quick_invite",
          sourcedByRaId: link.raId,
          pipelineStatus: finalPipelineStatus,
        });
      } else {
        await storage.updateProjectExpert(projectExpert.id, {
          status: finalStatus,
          pipelineStatus: finalPipelineStatus,
        });
      }

      // Store sample answers if accepted
      if (decision === "accepted" && sampleAnswers && Object.keys(sampleAnswers).length > 0) {
        for (const [questionId, answer] of Object.entries(sampleAnswers)) {
          if (answer && (answer as string).trim()) {
            await storage.createProjectActivity({
              projectId: link.projectId,
              expertId: expert.id,
              activityType: "vq_answered",
              description: `Expert provided sample answer to question ${questionId}`,
            });
          }
        }
      }

      // Update invitation link status
      await db.update(expertInvitationLinks)
        .set({ status: decision === "accepted" ? "accepted" : "declined" })
        .where(eq(expertInvitationLinks.token, token));

      // Log activity
      await storage.createProjectActivity({
        projectId: link.projectId,
        expertId: expert.id,
        activityType: decision === "accepted" ? "expert_accepted" : "expert_declined",
        description: `Expert ${decision === "accepted" ? "accepted" : "declined"} invitation to project`,
      });

      res.json({
        success: true,
        decision,
        message: decision === "accepted" ? "Welcome to the project!" : "Decision noted",
      });
    } catch (error) {
      console.error("Error submitting decision:", error);
      res.status(500).json({ error: "Failed to submit decision" });
    }
  });

  // Quick invite - generate invite link with minimal info (just name + one contact method)
  app.post("/api/projects/:projectId/quick-invite", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = (req as any).user;
      const { candidateName, linkedinUrl, email, phoneNumber } = req.body;

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!candidateName) {
        return res.status(400).json({ error: "Candidate name is required" });
      }

      // Determine candidate contact (prefer email, then phone, then linkedin)
      const candidateContact = email || phoneNumber || linkedinUrl || null;

      // Generate unique invite token
      const token = crypto.randomBytes(32).toString("hex");
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        inviteType: "quick",
        candidateName,
        candidateEmail: email || null,
        status: "pending_onboarding",
        recruitedBy: user?.email || "system",
        raId: user?.role === "ra" || user?.role === "Research Associate" ? user.id : null,
        isActive: true,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      });

      // Log activity
      await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        activityType: "quick_invite_created",
        description: `Generated quick invite link for ${candidateName} (Contact: ${candidateContact})`,
      });

      const inviteUrl = `/invite/onboarding/${token}`;
      res.status(201).json({
        link,
        inviteUrl,
        token,
        message: "Quick invite link generated successfully",
      });
    } catch (error) {
      console.error("Error generating quick invite:", error);
      res.status(500).json({ error: "Failed to generate quick invite link" });
    }
  });

  // Generate existing expert project invite link (always creates a NEW unique token)
  app.post("/api/projects/:projectId/experts/:expertId/invite-link", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const expertId = parseInt(req.params.expertId);
      const { angleIds } = req.body; // Optional: specific angles to invite for

      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const expert = await storage.getExpert(expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }

      // ALWAYS generate a NEW unique token for each invitation
      const token = crypto.randomBytes(32).toString("hex");
      const user = (req as any).user;
      const link = await storage.createExpertInvitationLink({
        token,
        projectId,
        expertId,
        angleIds: angleIds || null,
        inviteType: "existing",
        candidateName: expert.name,
        candidateEmail: expert.email || null,
        status: "pending",
        recruitedBy: user?.email || "system",
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      // Update project expert status with angle IDs
      const projectExperts = await storage.getProjectExpertsByProject(projectId);
      const pe = projectExperts.find(p => p.expertId === expertId);
      if (pe) {
        await storage.updateProjectExpert(pe.id, {
          invitationStatus: "invited",
          invitedAt: new Date(),
          invitationToken: token,
          angleIds: angleIds || pe.angleIds,
        });
      }

      // Log activity
      await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        expertId,
        activityType: "expert_invited",
        description: `Invited expert ${expert.name} to project`,
      });

      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
      const inviteUrl = `${baseUrl}/expert/project-invite/${link.token}`;
      res.json({ link, inviteUrl });
    } catch (error) {
      console.error("Error generating expert invite link:", error);
      res.status(500).json({ error: "Failed to generate invite link" });
    }
  });

  // Get project activities
  app.get("/api/projects/:id/activities", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const activities = await storage.getProjectActivities(id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // Add project activity/note
  app.post("/api/projects/:id/activities", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { activityType, description, metadata } = req.body;
      const user = (req as any).user;

      const activity = await storage.createProjectActivity({
        projectId,
        userId: user?.id,
        activityType: activityType || "note_added",
        description,
        metadata,
      });

      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ error: "Failed to add activity" });
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
        currentEmployer: req.query.currentEmployer as string | undefined,
        pastEmployers: req.query.pastEmployers as string | undefined,
        minRate: req.query.minRate ? parseFloat(req.query.minRate as string) : undefined,
        maxRate: req.query.maxRate ? parseFloat(req.query.maxRate as string) : undefined,
        minYearsExperience: req.query.minYearsExperience ? parseInt(req.query.minYearsExperience as string) : undefined,
        maxYearsExperience: req.query.maxYearsExperience ? parseInt(req.query.maxYearsExperience as string) : undefined,
        jobTitle: req.query.jobTitle as string | undefined,
        industry: req.query.industry as string | undefined,
        language: req.query.language as string | undefined,
        hasPriorProjects: req.query.hasPriorProjects === 'true',
        minAcceptanceRate: req.query.minAcceptanceRate ? parseInt(req.query.minAcceptanceRate as string) : undefined,
        minHoursWorked: req.query.minHoursWorked ? parseFloat(req.query.minHoursWorked as string) : undefined,
        availableOnly: req.query.availableOnly === 'true',
        excludeProjectId: req.query.excludeProjectId ? parseInt(req.query.excludeProjectId as string) : undefined,
      };
      const experts = await storage.searchExpertsAdvanced(params);
      res.json(experts);
    } catch (error) {
      console.error("Expert search error:", error);
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

  // ==================== PROJECT ANGLES ====================
  app.get("/api/projects/:projectId/angles", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const angles = await storage.getProjectAngles(projectId);
      res.json(angles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project angles" });
    }
  });

  app.get("/api/angles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const angle = await storage.getProjectAngle(id);
      if (!angle) {
        return res.status(404).json({ error: "Angle not found" });
      }
      res.json(angle);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch angle" });
    }
  });

  app.post("/api/projects/:projectId/angles", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const result = insertProjectAngleSchema.safeParse({
        ...req.body,
        projectId,
      });
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const angle = await storage.createProjectAngle(result.data);
      res.status(201).json(angle);
    } catch (error) {
      res.status(500).json({ error: "Failed to create angle" });
    }
  });

  app.patch("/api/angles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = insertProjectAngleSchema.partial().safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      const angle = await storage.updateProjectAngle(id, result.data);
      if (!angle) {
        return res.status(404).json({ error: "Angle not found" });
      }
      res.json(angle);
    } catch (error) {
      res.status(500).json({ error: "Failed to update angle" });
    }
  });

  app.delete("/api/angles/:id", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Also delete VQs for this angle
      await storage.deleteVettingQuestionsByAngle(id);
      const deleted = await storage.deleteProjectAngle(id);
      if (!deleted) {
        return res.status(404).json({ error: "Angle not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete angle" });
    }
  });

  app.post("/api/projects/:projectId/angles/reorder", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { angleIds } = req.body;
      if (!Array.isArray(angleIds)) {
        return res.status(400).json({ error: "angleIds must be an array" });
      }
      const angles = await storage.reorderProjectAngles(projectId, angleIds);
      res.json(angles);
    } catch (error) {
      res.status(500).json({ error: "Failed to reorder angles" });
    }
  });

  // Get VQs by angle
  app.get("/api/angles/:angleId/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const angleId = parseInt(req.params.angleId);
      const questions = await storage.getVettingQuestionsByAngle(angleId);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vetting questions for angle" });
    }
  });

  // ==================== VETTING QUESTIONS ====================
  app.get("/api/vetting-questions", authMiddleware, async (req, res) => {
    try {
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : null;
      const angleId = req.query.angleId ? parseInt(req.query.angleId as string) : null;
      
      let questions;
      if (angleId) {
        questions = await storage.getVettingQuestionsByAngle(angleId);
      } else if (projectId) {
        questions = await storage.getVettingQuestionsByProject(projectId);
      } else {
        questions = await storage.getVettingQuestions();
      }
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

  // Send invitation to expert (always creates a NEW unique token)
  app.post("/api/project-experts/:id/invite", authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Get assignment, expert, and project data
      const assignment = await storage.getProjectExpert(id);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      
      const expert = await storage.getExpert(assignment.expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      
      const project = await storage.getProject(assignment.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions for this project
      const vqs = await storage.getVettingQuestionsByProject(assignment.projectId);
      
      // ALWAYS create a NEW unique token for each invitation
      const token = crypto.randomBytes(32).toString("hex");
      const user = (req as any).user;
      const link = await storage.createExpertInvitationLink({
        token,
        projectId: assignment.projectId,
        expertId: assignment.expertId,
        angleIds: assignment.angleIds,
        inviteType: "existing",
        candidateName: expert.name,
        candidateEmail: expert.email || null,
        status: "pending",
        recruitedBy: user?.email || "system",
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
      
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
      const invitationUrl = `${baseUrl}/expert/project-invite/${link.token}`;
      
      // Send email
      await sendExpertInvitationEmail({
        expertName: expert.name,
        expertEmail: expert.email,
        projectName: project.name,
        clientName: project.clientName,
        industry: project.industry,
        invitationUrl,
        vettingQuestionsCount: vqs.length,
      });
      
      // Update status to invited
      const updatedAssignment = await storage.updateProjectExpert(id, {
        status: "invited",
        invitationStatus: "invited",
        invitedAt: new Date(),
        invitationToken: link.token,
      });
      
      res.json(updatedAssignment);
    } catch (error) {
      console.error("Failed to send invitation:", error);
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
          sourceType: "internal_db",
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

  // Send bulk invitations with angle selection
  app.post("/api/projects/:projectId/invitations/bulk-send", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { projectExpertIds, angleIds, channel } = req.body; // angleIds: array of angle IDs to assign (OPTIONAL)
      
      console.log("[API] Bulk-send endpoint triggered from Project Experts view");
      console.log("[API] Request params - projectId:", projectId, "experts count:", projectExpertIds?.length, "angleIds:", angleIds, "channel:", channel);
      
      if (!Array.isArray(projectExpertIds) || projectExpertIds.length === 0) {
        return res.status(400).json({ error: "projectExpertIds must be a non-empty array" });
      }
      
      // Angles are OPTIONAL - allow empty arrays
      if (angleIds && !Array.isArray(angleIds)) {
        return res.status(400).json({ error: "angleIds must be an array" });
      }
      
      if (!angleIds || angleIds.length === 0) {
        console.log("[INVITES] Creating invitations with no angles for project", projectId);
      }
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions for the project
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectId);
      
      const results = [];
      
      // Process each expert directly (don't use internal fetch)
      for (const peId of projectExpertIds) {
        try {
          const pe = await storage.getProjectExpert(peId);
          if (!pe || pe.projectId !== projectId) continue;
          
          const expert = await storage.getExpert(pe.expertId);
          if (!expert) continue;
          
          console.log(`[EMAIL] Sending project invitation to ${expert.email} for project ${projectId}`);
          
          // Determine angles to use: use provided angleIds if given and non-empty, otherwise use existing
          const finalAngleIds = angleIds && angleIds.length > 0 ? angleIds : pe.angleIds;
          
          // ALWAYS create a NEW unique token for each invitation
          const token = crypto.randomBytes(32).toString("hex");
          const link = await storage.createExpertInvitationLink({
            token,
            projectId,
            expertId: expert.id,
            angleIds: finalAngleIds,
            inviteType: "existing",
            candidateName: expert.name,
            candidateEmail: expert.email || null,
            status: "pending",
            recruitedBy: "system",
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          });
          
          // Generate invitation URL
          const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
          const invitationUrl = `${baseUrl}/expert/project-invite/${link.token}`;
          
          // Send email invitation
          let emailSent = false;
          if (channel === 'email' || channel === 'both' || !channel) {
            try {
              console.log(`[EMAIL] Calling sendExpertInvitationEmail for ${expert.email}`);
              emailSent = await sendExpertInvitationEmail({
                expertName: expert.name,
                expertEmail: expert.email,
                projectName: project.name,
                clientName: project.clientName || "Client",
                industry: project.industry || undefined,
                invitationUrl,
                vettingQuestionsCount: vettingQuestions.length,
              });
              console.log(`[EMAIL] Email ${emailSent ? 'SENT' : 'FAILED'} to ${expert.email}`);
            } catch (emailError) {
              console.error(`[EMAIL] Error sending to ${expert.email}:`, emailError);
            }
          }
          
          // Update status to invited ONLY AFTER EMAIL IS SENT
          // Include angleIds update if provided and non-empty
          const updateData: any = {
            status: "invited",
            invitationStatus: "invited",
            invitedAt: new Date(),
            invitationToken: link.token,
          };
          
          // Only add angleIds to update if we have values to set
          if (angleIds && angleIds.length > 0) {
            updateData.angleIds = angleIds;
          }
          
          await storage.updateProjectExpert(peId, updateData);
          
          results.push({
            expertId: expert.id,
            expertName: expert.name,
            email: expert.email,
            invitationUrl,
            status: emailSent ? "sent" : "failed",
            emailSent,
          });
        } catch (expertError) {
          console.error(`[INVITES] Error processing expert ${peId}:`, expertError);
          // Continue processing other experts even if one fails
        }
      }
      
      const successCount = results.filter(r => r.emailSent).length;
      const failedCount = results.filter(r => !r.emailSent).length;
      
      console.log(`[API] Bulk-send complete: ${successCount} sent, ${failedCount} failed`);
      
      // Return 200 with proper summary (success if at least one was sent)
      res.status(200).json({
        message: `Invitations: ${successCount} sent, ${failedCount} failed`,
        channel: channel || 'email',
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failedCount,
        }
      });
    } catch (error) {
      console.error("[INVITES] Bulk send invitations error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send bulk invitations";
      res.status(500).json({ 
        success: false,
        error: "Failed to send bulk invitations",
        details: errorMessage,
        message: errorMessage
      });
    }
  });

  // Send bulk invitations to experts
  app.post("/api/projects/:projectId/invitations/send", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const { projectExpertIds, channel } = req.body; // channel: 'email' | 'whatsapp' | 'both'
      
      console.log("[Bulk Invite] Starting bulk invitation send from Project Existing Experts tab");
      
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
        
        console.log(`[Bulk Invite] Processing expert: ${expert.name} (${expert.email})`);
        
        // ALWAYS create a NEW unique token for each invitation
        const token = crypto.randomBytes(32).toString("hex");
        const link = await storage.createExpertInvitationLink({
          token,
          projectId,
          expertId: expert.id,
          angleIds: pe.angleIds,
          inviteType: "existing",
          candidateName: expert.name,
          candidateEmail: expert.email || null,
          status: "pending",
          recruitedBy: "system",
          isActive: true,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
        console.log(`[Bulk Invite] Created new invitation token for ${expert.email}`);
        
        // Update project-expert with token and status
        const updatedPe = await storage.updateProjectExpert(peId, {
          status: "invited",
          invitationStatus: "invited",
          invitedAt: new Date(),
          invitationToken: link.token,
        });
        
        // Generate invitation URL
        const baseUrl = process.env.APP_BASE_URL || "http://localhost:5000";
        const invitationUrl = `${baseUrl}/expert/project-invite/${link.token}`;
        
        // Send email invitation
        let emailSent = false;
        if (channel === 'email' || channel === 'both' || !channel) {
          try {
            console.log(`[Bulk Invite] Sending email to ${expert.email}...`);
            emailSent = await sendExpertInvitationEmail({
              expertName: expert.name,
              expertEmail: expert.email,
              projectName: project.name,
              clientName: project.clientName || "Client",
              industry: project.industry || undefined,
              invitationUrl,
              vettingQuestionsCount: vettingQuestions.length,
            });
            console.log(`[Bulk Invite] Email ${emailSent ? 'SENT' : 'FAILED'} to ${expert.name} (${expert.email})`);
          } catch (emailError) {
            console.error(`[Bulk Invite] Email error for ${expert.email}:`, emailError);
          }
        }
        
        // Log WhatsApp info (manual follow-up for now)
        if (channel === 'whatsapp' || channel === 'both') {
          console.log(`[Bulk Invite] [WhatsApp] Manual follow-up needed for ${expert.name} (${expert.phone || expert.whatsapp || 'no phone'})`);
          console.log(`[Bulk Invite]   Invitation URL: ${invitationUrl}`);
        }
        
        results.push({
          expertId: expert.id,
          expertName: expert.name,
          email: expert.email,
          invitationUrl,
          status: emailSent ? "sent" : "failed",
          emailSent,
        });
      }
      
      const successCount = results.filter(r => r.emailSent).length;
      const failedCount = results.filter(r => !r.emailSent).length;
      
      console.log(`[Bulk Invite] Complete: ${successCount} sent, ${failedCount} failed`);
      
      res.json({
        message: `Invitations: ${successCount} sent, ${failedCount} failed`,
        channel: channel || 'email',
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failedCount,
        }
      });
    } catch (error) {
      console.error("[Bulk Invite] Send invitations error:", error);
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
      const user = (req as any).user;
      
      let records;
      if (projectId) {
        records = await storage.getCallRecordsByProject(projectId);
      } else if (expertId) {
        records = await storage.getCallRecordsByExpert(expertId);
      } else {
        records = await storage.getCallRecords();
      }
      
      // Filter by RA's assigned projects if user is RA
      if (user?.role === "ra" || user?.role === "Research Associate") {
        const allProjects = await storage.getProjects();
        const raProjectIds = new Set(
          allProjects
            .filter((p: any) => p.assignedRaId === user.id || (p.assignedRaIds && p.assignedRaIds.includes(user.id)))
            .map((p: any) => p.id)
        );
        records = records.filter((r: any) => raProjectIds.has(r.projectId));
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
  // List all invites (with optional filters)
  app.get("/api/invitation-links", authMiddleware, async (req, res) => {
    try {
      const links = await storage.getExpertInvitationLinks();
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invitation links" });
    }
  });

  // List invites by project (with role-based access control)
  app.get("/api/projects/:projectId/invites", authMiddleware, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const user = (req as any).user;
      
      // RAs can only see invites for projects they're assigned to
      if (user.role === "ra" || user.role === "Research Associate") {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        const hasAccess = raHasProjectAccess(project, user.id);
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied - not assigned to this project" });
        }
      }
      
      const links = await storage.getExpertInvitationLinksByProject(projectId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch project invites" });
    }
  });

  // List invites by RA (with role-based access control)
  app.get("/api/ras/:raId/invites", authMiddleware, async (req, res) => {
    try {
      const raId = parseInt(req.params.raId);
      const user = (req as any).user;
      
      // RAs can only see their own invites
      if ((user.role === "ra" || user.role === "Research Associate") && user.id !== raId) {
        return res.status(403).json({ error: "Access denied - can only view your own invites" });
      }
      
      const links = await storage.getExpertInvitationLinksByRa(raId);
      res.json(links);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RA invites" });
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

  // ==================== EXPERT ONBOARDING (NEW FLOW) ====================
  // GET /api/invite/:projectId/:inviteType/:token - Validate invitation and get project/vetting questions
  app.get("/api/invite/:projectId/:inviteType/:token", async (req, res) => {
    try {
      const { projectId, inviteType, token } = req.params;
      const projectIdNum = parseInt(projectId);
      
      // Validate the invitation link
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
      
      // Verify project ID matches
      if (link.projectId !== projectIdNum) {
        return res.status(400).json({ error: "Invalid invitation link for this project" });
      }
      
      // Get project details
      const project = await storage.getProject(projectIdNum);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get vetting questions
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectIdNum);
      
      // Get RA information if recruited by specific RA
      let recruitedByRaId: number | null = null;
      if (link.recruitedBy) {
        const raUser = await storage.getUserByEmail(link.recruitedBy);
        if (raUser && (raUser.role === "ra" || raUser.role === "Research Associate")) {
          recruitedByRaId = raUser.id;
        }
      }
      
      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          industry: project.industry,
          projectOverview: project.projectOverview,
          description: project.description,
        },
        vettingQuestions: vettingQuestions.map(q => ({
          id: q.id,
          question: q.question,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
        })),
        recruitedBy: link.recruitedBy,
        recruitedByRaId,
      });
    } catch (error) {
      console.error("Get invitation error:", error);
      res.status(500).json({ error: "Failed to fetch invitation details" });
    }
  });

  // POST /api/invite/:projectId/:inviteType/:token/submit - Submit expert registration
  app.post("/api/invite/:projectId/:inviteType/:token/submit", async (req, res) => {
    try {
      const { projectId, inviteType, token } = req.params;
      const projectIdNum = parseInt(projectId);
      
      // Validate the invitation link again
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
      if (link.projectId !== projectIdNum) {
        return res.status(400).json({ error: "Invalid invitation link for this project" });
      }
      
      const {
        email,
        password,
        firstName,
        lastName,
        country,
        region,
        countryCode,
        phoneNumber,
        linkedinUrl,
        city,
        canConsultInEnglish,
        timezone,
        experiences,
        biography,
        workHistory,
        hourlyRate,
        currency,
        vqAnswers,
      } = req.body;
      
      // Check if expert with email already exists
      const existingExpert = await storage.getExpertByEmail(email);
      if (existingExpert) {
        return res.status(400).json({ error: "An expert with this email already exists" });
      }
      
      // Hash password for expert login (future use)
      const passwordHash = await hashPassword(password);
      
      // Get RA ID for sourcedByRaId
      let sourcedByRaId: number | null = null;
      if (link.recruitedBy) {
        const raUser = await storage.getUserByEmail(link.recruitedBy);
        if (raUser && (raUser.role === "ra" || raUser.role === "Research Associate")) {
          sourcedByRaId = raUser.id;
        }
      }
      
      // Format phone number
      const fullPhone = `${countryCode} ${phoneNumber}`.trim();
      
      // Format experience for bio/company/job title
      const currentExperience = experiences.find((e: any) => e.isCurrent) || experiences[0];
      const experienceText = experiences.map((e: any) => {
        const period = e.isCurrent 
          ? `${e.fromMonth}/${e.fromYear} - Present`
          : `${e.fromMonth}/${e.fromYear} - ${e.toMonth}/${e.toYear}`;
        return `${e.title} at ${e.company} (${period})`;
      }).join("\n");
      
      // Calculate years of experience from earliest date
      const earliestYear = Math.min(...experiences.map((e: any) => parseInt(e.fromYear)));
      const currentYear = new Date().getFullYear();
      const yearsOfExperience = currentYear - earliestYear;
      
      // Create expert record with hashed password
      const expertData = {
        name: `${firstName} ${lastName}`,
        email,
        passwordHash,
        phone: fullPhone,
        linkedinUrl: linkedinUrl || null,
        country,
        timezone,
        whatsapp: fullPhone,
        expertise: currentExperience?.title || "Expert",
        areasOfExpertise: [canConsultInEnglish === "yes" ? "English consultations available" : ""],
        industry: "Consulting",
        company: currentExperience?.company || "",
        jobTitle: currentExperience?.title || "",
        yearsOfExperience,
        hourlyRate: hourlyRate,
        bio: `${biography}\n\nWork History:\n${workHistory}\n\nExperience:\n${experienceText}`,
        status: "available" as const,
        recruitedBy: link.recruitedBy,
        sourcedByRaId,
        sourcedAt: new Date(),
        termsAccepted: true,
        lgpdAccepted: true,
        billingInfo: `Currency: ${currency}, Region: ${region || ""}, City: ${city || ""}`,
      };
      
      const result = insertExpertSchema.safeParse(expertData);
      if (!result.success) {
        return res.status(400).json({ error: fromZodError(result.error).message });
      }
      
      const expert = await storage.createExpert(result.data);
      
      // Mark invitation link as used
      await storage.markInvitationLinkUsed(token);
      
      // Get project for vetting question mapping
      const project = await storage.getProject(projectIdNum);
      const vettingQuestions = await storage.getVettingQuestionsByProject(projectIdNum);
      
      // Format VQ answers for storage
      const formattedVqAnswers = vqAnswers.map((answer: { questionId: number; answer: string }) => {
        const question = vettingQuestions.find(q => q.id === answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.question || "",
          answerText: answer.answer,
        };
      });
      
      // Create project-expert assignment with status "interested"
      const invitationToken = crypto.randomBytes(32).toString("hex");
      await storage.createProjectExpert({
        projectId: projectIdNum,
        expertId: expert.id,
        status: "accepted",
        invitedAt: new Date(),
        respondedAt: new Date(),
        invitationToken,
        vqAnswers: formattedVqAnswers,
        notes: `Self-registered via invitation link. Invite type: ${inviteType}`,
      });
      
      res.status(201).json({ 
        success: true, 
        expertId: expert.id,
        message: "Expert registered successfully" 
      });
    } catch (error) {
      console.error("Expert registration error:", error);
      res.status(500).json({ error: "Failed to register expert" });
    }
  });

  // ==================== EXISTING EXPERT PROJECT INVITE (Accept/Decline) ====================
  // GET /api/expert/project-invite/:token - Get project invite details for existing expert
  app.get("/api/expert/project-invite/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      // Find the invitation link
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.inviteType !== "existing") {
        return res.status(400).json({ error: "Invalid invite type" });
      }
      if (!link.isActive) {
        return res.status(400).json({ error: "Invitation link is no longer active" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link has expired" });
      }
      if (!link.projectId || !link.expertId) {
        return res.status(400).json({ error: "Invalid invitation link" });
      }
      
      // Get project details
      const project = await storage.getProject(link.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      // Get expert details
      const expert = await storage.getExpert(link.expertId);
      if (!expert) {
        return res.status(404).json({ error: "Expert not found" });
      }
      
      // Get vetting questions
      const allVettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);
      
      // Get project angles for context
      const angles = await storage.getProjectAngles(link.projectId);
      
      // Filter VQs based on angleIds if specified in the link
      let vettingQuestions = allVettingQuestions;
      let relevantAngles: typeof angles = [];
      
      if (link.angleIds && link.angleIds.length > 0) {
        // Include VQs that belong to the specified angles or have no angle (general)
        vettingQuestions = allVettingQuestions.filter(q => 
          q.angleId === null || link.angleIds!.includes(q.angleId)
        );
        // Only include relevant angles
        relevantAngles = angles.filter(a => link.angleIds!.includes(a.id));
      } else {
        // No angle filter - include all VQs
        relevantAngles = angles;
      }
      
      // Get project-expert assignment
      const projectExperts = await storage.getProjectExpertsByProject(link.projectId);
      const assignment = projectExperts.find(pe => pe.expertId === link.expertId);
      
      // Update invitation status to "opened" if not already responded
      if (assignment && assignment.invitationStatus !== "accepted" && assignment.invitationStatus !== "declined") {
        await storage.updateProjectExpert(assignment.id, {
          invitationStatus: "opened",
          openedAt: new Date(),
          lastActivityAt: new Date(),
        });
        
        // Log activity
        await storage.createProjectActivity({
          projectId: link.projectId,
          expertId: link.expertId,
          activityType: "expert_opened",
          description: `Expert ${expert.name} opened the project invitation`,
        });
      }
      
      res.json({
        project: {
          id: project.id,
          name: project.name,
          clientName: project.clientName,
          clientCompany: project.clientCompany,
          industry: project.industry,
          region: project.region,
          projectOverview: project.projectOverview,
          description: project.description,
        },
        expert: {
          id: expert.id,
          name: expert.name,
          email: expert.email,
        },
        angles: relevantAngles.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
        })),
        vettingQuestions: vettingQuestions.map(q => ({
          id: q.id,
          question: q.question,
          orderIndex: q.orderIndex,
          isRequired: q.isRequired,
          angleId: q.angleId,
          questionType: q.questionType,
        })),
        currentStatus: assignment?.invitationStatus || "not_invited",
        hasResponded: assignment?.invitationStatus === "accepted" || assignment?.invitationStatus === "declined",
      });
    } catch (error) {
      console.error("Get project invite error:", error);
      res.status(500).json({ error: "Failed to fetch project invite details" });
    }
  });

  // POST /api/expert/project-invite/:token/respond - Expert responds to project invite (Accept/Decline)
  app.post("/api/expert/project-invite/:token/respond", async (req, res) => {
    try {
      const { token } = req.params;
      const { response, vqAnswers, availabilityNote } = req.body;
      
      if (!response || (response !== "accept" && response !== "decline")) {
        return res.status(400).json({ error: "Response must be 'accept' or 'decline'" });
      }
      
      // Find the invitation link
      const link = await storage.getExpertInvitationLinkByToken(token);
      
      if (!link) {
        return res.status(404).json({ error: "Invitation link not found" });
      }
      if (link.inviteType !== "existing") {
        return res.status(400).json({ error: "Invalid invite type" });
      }
      if (!link.isActive) {
        return res.status(400).json({ error: "Invitation link is no longer active" });
      }
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return res.status(400).json({ error: "Invitation link has expired" });
      }
      if (!link.projectId || !link.expertId) {
        return res.status(400).json({ error: "Invalid invitation link" });
      }
      
      // Get project and expert
      const project = await storage.getProject(link.projectId);
      const expert = await storage.getExpert(link.expertId);
      
      if (!project || !expert) {
        return res.status(404).json({ error: "Project or expert not found" });
      }
      
      // Get vetting questions for formatting answers
      const vettingQuestions = await storage.getVettingQuestionsByProject(link.projectId);
      
      // Format VQ answers
      const formattedVqAnswers = vqAnswers?.map((answer: { questionId: number; answer: string }) => {
        const question = vettingQuestions.find(q => q.id === answer.questionId);
        return {
          questionId: answer.questionId,
          questionText: question?.question || "",
          answerText: answer.answer,
        };
      }) || [];
      
      // Get or create project-expert assignment
      const projectExperts = await storage.getProjectExpertsByProject(link.projectId);
      let assignment = projectExperts.find(pe => pe.expertId === link.expertId);
      
      const newStatus = response === "accept" ? "accepted" : "declined";
      const newPipelineStatus = response === "accept" ? "accepted" : "declined";
      
      if (assignment) {
        // Update existing assignment
        await storage.updateProjectExpert(assignment.id, {
          status: newStatus,
          invitationStatus: newStatus,
          pipelineStatus: newPipelineStatus,
          respondedAt: new Date(),
          lastActivityAt: new Date(),
          vqAnswers: formattedVqAnswers.length > 0 ? formattedVqAnswers : assignment.vqAnswers,
          availabilityNote: availabilityNote || assignment.availabilityNote,
        });
      } else {
        // Create new assignment (shouldn't happen normally, but just in case)
        await storage.createProjectExpert({
          projectId: link.projectId,
          expertId: link.expertId,
          status: newStatus,
          invitationStatus: newStatus,
          pipelineStatus: newPipelineStatus,
          sourceType: "internal_db",
          invitedAt: link.createdAt,
          respondedAt: new Date(),
          invitationToken: token,
          vqAnswers: formattedVqAnswers,
          availabilityNote,
        });
      }
      
      // Mark invitation link as used and update status in a single coordinated update
      const inviteStatus = response === "accept" ? "accepted" : "declined";
      await storage.updateExpertInvitationLink(link.id, { 
        isActive: false,
        usedAt: new Date(),
        status: inviteStatus,
      } as any);
      
      // Log activity
      await storage.createProjectActivity({
        projectId: link.projectId,
        expertId: link.expertId,
        activityType: response === "accept" ? "expert_accepted" : "expert_declined",
        description: `Expert ${expert.name} ${response === "accept" ? "accepted" : "declined"} the project invitation`,
        metadata: { response, hasVqAnswers: formattedVqAnswers.length > 0 } as Record<string, any>,
      });
      
      res.json({ 
        success: true, 
        response,
        message: response === "accept" 
          ? "Thank you for accepting! The team will be in touch soon." 
          : "Thank you for your response. We appreciate your time.",
      });
    } catch (error) {
      console.error("Project invite response error:", error);
      res.status(500).json({ error: "Failed to submit response" });
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

      if (role === "ra" || role === "Research Associate") {
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

  /**
   * GET /api/employees/:id/overview
   * 
   * Returns detailed employee overview including KPIs and accounts.
   * Only accessible by admin and finance roles.
   */
  app.get("/api/employees/:id/overview", authMiddleware, requireRoles("admin", "finance"), async (req: AuthRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      
      // Get employee basic info
      const employee = await storage.getUser(employeeId);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get current month boundaries in Brazil timezone
      const BRAZIL_TZ = "America/Sao_Paulo";
      const now = new Date();
      const brazilNow = toZonedTime(now, BRAZIL_TZ);
      const year = brazilNow.getFullYear();
      const month = brazilNow.getMonth();
      const monthStartInBrazil = startOfMonth(brazilNow);
      const nextMonthStartInBrazil = addMonths(monthStartInBrazil, 1);
      const monthStartUTC = fromZonedTime(monthStartInBrazil, BRAZIL_TZ);
      const monthEndUTC = fromZonedTime(nextMonthStartInBrazil, BRAZIL_TZ);

      // Get all completed calls this month with full details
      const allCalls = await db
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
          clientOrganizationId: projects.clientOrganizationId,
          cuRatePerCU: projects.cuRatePerCU,
          projectPmId: projects.createdByPmId,
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

      // Filter calls based on employee role
      let filteredCalls: typeof allCalls = [];
      let kpi = {
        totalCU: 0,
        completedCalls: 0,
        incentive: 0,
      };
      
      const role = employee.role;

      if (role === "ra" || role === "Research Associate") {
        // RA: Calls where expert was sourced by this RA AND within 60 days
        filteredCalls = allCalls.filter((call) => {
          if (call.expertSourcedByRaId !== employeeId) return false;
          if (!call.expertSourcedAt || !call.completedAt) return false;
          
          const sourcedAt = new Date(call.expertSourcedAt);
          const completedAt = new Date(call.completedAt);
          const daysDiff = (completedAt.getTime() - sourcedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          return daysDiff <= 60;
        });

        kpi.completedCalls = filteredCalls.length;
        kpi.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        const rawIncentive = kpi.completedCalls * 250;
        kpi.incentive = Math.min(rawIncentive, 2500); // Cap at R$2,500

      } else if (role === "pm") {
        // PM: Calls where pmId = this employee
        filteredCalls = allCalls.filter((call) => call.pmId === employeeId);

        kpi.completedCalls = filteredCalls.length;
        kpi.totalCU = filteredCalls.reduce((sum, call) => sum + parseFloat(call.cuUsed || "0"), 0);
        kpi.incentive = Math.round(kpi.totalCU * 70 * 100) / 100; // R$70 per CU

      } else if (role === "admin" || role === "finance") {
        // Admin/Finance: No personal calls, no incentive
        filteredCalls = [];
        kpi.completedCalls = 0;
        kpi.totalCU = 0;
        kpi.incentive = 0;
      }

      // Round totalCU
      kpi.totalCU = Math.round(kpi.totalCU * 100) / 100;

      // Build accounts list - only for PM employees
      let accounts: any[] = [];
      
      if (role === "pm") {
        const accountsMap = new Map<string, {
          clientId: number | null;
          clientName: string;
          totalCUThisMonth: number;
          completedCallsThisMonth: number;
          revenueThisMonthUSD: number;
          lastActivityAt: Date | null;
        }>();

        // Process calls to build accounts
        for (const call of filteredCalls) {
          const clientKey = call.clientName;
          const cuUsed = parseFloat(call.cuUsed || "0");
          const cuRate = parseFloat(call.cuRatePerCU || "1150");
          const revenueUSD = cuUsed * cuRate;
          const completedAt = call.completedAt ? new Date(call.completedAt) : null;

          if (!accountsMap.has(clientKey)) {
            accountsMap.set(clientKey, {
              clientId: call.clientOrganizationId,
              clientName: call.clientName,
              totalCUThisMonth: 0,
              completedCallsThisMonth: 0,
              revenueThisMonthUSD: 0,
              lastActivityAt: null,
            });
          }

          const account = accountsMap.get(clientKey)!;
          account.totalCUThisMonth += cuUsed;
          account.completedCallsThisMonth += 1;
          account.revenueThisMonthUSD += revenueUSD;
          
          if (completedAt && (!account.lastActivityAt || completedAt > account.lastActivityAt)) {
            account.lastActivityAt = completedAt;
          }
        }

        // Convert accounts map to array and format
        accounts = Array.from(accountsMap.values()).map((account) => ({
          clientId: account.clientId,
          clientName: account.clientName,
          totalCUThisMonth: Math.round(account.totalCUThisMonth * 100) / 100,
          completedCallsThisMonth: account.completedCallsThisMonth,
          revenueThisMonthUSD: Math.round(account.revenueThisMonthUSD * 100) / 100,
          contractedCU: null, // No contractedCU field exists yet
          usageRate: null, // Cannot calculate without contractedCU
          lastActivityAt: account.lastActivityAt 
            ? format(toZonedTime(account.lastActivityAt, BRAZIL_TZ), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: BRAZIL_TZ })
            : null,
        }));

        // Sort accounts by revenue descending
        accounts.sort((a, b) => b.revenueThisMonthUSD - a.revenueThisMonthUSD);
      }

      res.json({
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          email: employee.email,
          role: employee.role,
          status: employee.isActive ? "active" : "inactive",
          joinedAt: employee.createdAt,
        },
        kpi: {
          period: {
            month: month + 1,
            year,
            timezone: "America/Sao_Paulo",
          },
          totalCU: kpi.totalCU,
          completedCalls: kpi.completedCalls,
          incentive: kpi.incentive,
        },
        accounts,
      });
    } catch (error) {
      console.error("Employee overview error:", error);
      res.status(500).json({ error: "Failed to fetch employee overview" });
    }
  });

  // ==================== RA INCENTIVE ENDPOINTS ====================
  
  // GET /api/ra-incentives - Get all RAs incentive summary
  app.get("/api/ra-incentives", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // Admin, PM, and finance can view all RA incentives
      if (!["admin", "pm", "finance"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fromDate, toDate } = req.query;
      
      const periodFromDate = fromDate ? new Date(fromDate as string) : undefined;
      const periodToDate = toDate ? new Date(toDate as string) : undefined;

      const summaries = await storage.getAllRaIncentiveSummary(periodFromDate, periodToDate);
      
      res.json({
        period: {
          fromDate: periodFromDate?.toISOString() || null,
          toDate: periodToDate?.toISOString() || null,
        },
        incentivePerCallBRL: 250,
        eligibilityWindowDays: 60,
        summaries,
      });
    } catch (error) {
      console.error("Error fetching RA incentives:", error);
      res.status(500).json({ error: "Failed to fetch RA incentives" });
    }
  });

  // GET /api/ra-incentives/:raId - Get detailed incentive info for specific RA
  app.get("/api/ra-incentives/:raId", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const raId = parseInt(req.params.raId);

      // RAs can only view their own incentives, admin/pm/finance can view all
      if (user.role === "ra" && user.id !== raId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!["admin", "pm", "finance", "ra"].includes(user.role)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { fromDate, toDate } = req.query;
      
      const periodFromDate = fromDate ? new Date(fromDate as string) : undefined;
      const periodToDate = toDate ? new Date(toDate as string) : undefined;

      const incentiveData = await storage.calculateRaIncentives(raId, periodFromDate, periodToDate);
      
      res.json({
        period: {
          fromDate: periodFromDate?.toISOString() || null,
          toDate: periodToDate?.toISOString() || null,
        },
        incentivePerCallBRL: 250,
        eligibilityWindowDays: 60,
        ...incentiveData,
      });
    } catch (error) {
      console.error("Error fetching RA incentive details:", error);
      res.status(500).json({ error: "Failed to fetch RA incentive details" });
    }
  });

  // GET /api/experts-with-recruiter - Get experts with their recruiter info
  app.get("/api/experts-with-recruiter", authMiddleware, async (req, res) => {
    try {
      // Get all experts with recruiter info via a join
      const expertsWithRecruiter = await db
        .select({
          id: experts.id,
          name: experts.name,
          email: experts.email,
          phone: experts.phone,
          expertise: experts.expertise,
          industry: experts.industry,
          company: experts.company,
          jobTitle: experts.jobTitle,
          yearsOfExperience: experts.yearsOfExperience,
          hourlyRate: experts.hourlyRate,
          status: experts.status,
          createdAt: experts.createdAt,
          sourcedByRaId: experts.sourcedByRaId,
          sourcedAt: experts.sourcedAt,
          recruiterName: users.fullName,
          recruiterEmail: users.email,
        })
        .from(experts)
        .leftJoin(users, eq(experts.sourcedByRaId, users.id))
        .orderBy(desc(experts.createdAt));

      res.json(expertsWithRecruiter);
    } catch (error) {
      console.error("Error fetching experts with recruiter:", error);
      res.status(500).json({ error: "Failed to fetch experts" });
    }
  });

  // =====================================================
  // SHORTLIST EXPORT ENDPOINT
  // Export experts with pipelineStatus = "interested" as CSV
  // Location: server/routes.ts - GET /api/projects/:projectId/export-shortlist
  // =====================================================
  app.get("/api/projects/:projectId/export-shortlist", authMiddleware, async (req, res) => {
    try {
      const user = (req as any).user;
      const projectId = parseInt(req.params.projectId);
      
      if (isNaN(projectId)) {
        return res.status(400).json({ error: "Invalid project ID" });
      }

      // Authorization: admin and PM can export any project, RA only assigned projects
      if (!["admin", "pm"].includes(user.role)) {
        if (user.role === "ra") {
          // Check if RA is assigned to this project
          const project = await storage.getProject(projectId);
          const isAssigned = project?.assignedRaIds?.includes(user.id);
          if (!isAssigned) {
            return res.status(403).json({ error: "Access denied - not assigned to this project" });
          }
        } else {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      // Fetch all project experts with pipelineStatus = "interested" (shortlisted experts)
      const shortlistedExperts = await db
        .select({
          projectExpertId: projectExperts.id,
          expertId: projectExperts.expertId,
          angleIds: projectExperts.angleIds,
          pipelineStatus: projectExperts.pipelineStatus,
          respondedAt: projectExperts.respondedAt,
          lastActivityAt: projectExperts.lastActivityAt,
          assignedAt: projectExperts.assignedAt,
          sourcedByRaId: projectExperts.sourcedByRaId,
          expertName: experts.name,
          expertEmail: experts.email,
          expertJobTitle: experts.jobTitle,
          expertSourcedByRaId: experts.sourcedByRaId,
          expertSourcedAt: experts.sourcedAt,
        })
        .from(projectExperts)
        .innerJoin(experts, eq(projectExperts.expertId, experts.id))
        .where(
          and(
            eq(projectExperts.projectId, projectId),
            eq(projectExperts.pipelineStatus, "interested")
          )
        )
        .orderBy(experts.name);

      if (shortlistedExperts.length === 0) {
        return res.status(404).json({ error: "No shortlisted experts to export" });
      }

      // Fetch angles for the project to map IDs to names
      const angles = await db
        .select()
        .from(projectAngles)
        .where(eq(projectAngles.projectId, projectId));
      
      const angleMap = new Map(angles.map(a => [a.id, a.title]));

      // Fetch RA names for recruiting info
      const raIdSet = new Set(
        shortlistedExperts
          .map(e => e.expertSourcedByRaId || e.sourcedByRaId)
          .filter((id): id is number => id !== null)
      );
      const raIds = Array.from(raIdSet);
      
      let raMap = new Map<number, string>();
      if (raIds.length > 0) {
        const ras = await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, raIds));
        raMap = new Map(ras.map(r => [r.id, r.fullName]));
      }

      // Helper function to escape CSV fields
      const escapeCSV = (value: string | null | undefined): string => {
        if (value === null || value === undefined) return "";
        const str = String(value);
        // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // CSV headers
      const headers = [
        "Expert Name",
        "Email",
        "Title / Position",
        "Angles",
        "Status",
        "Last Activity / Onboarding Date",
        "Recruited By",
        "Recruited At",
        "Expert ID"
      ];

      // Build CSV rows
      const rows = shortlistedExperts.map(expert => {
        // Get angle names from IDs
        const angleNames = expert.angleIds
          ? expert.angleIds.map(id => angleMap.get(id) || `Angle ${id}`).join("; ")
          : "";
        
        // Determine last activity date
        const lastActivityDate = expert.lastActivityAt || expert.respondedAt || expert.assignedAt;
        const formattedDate = lastActivityDate 
          ? new Date(lastActivityDate).toISOString().split("T")[0]
          : "";

        // Get recruiter info (prefer expert-level, fallback to project-expert level)
        const recruiterId = expert.expertSourcedByRaId || expert.sourcedByRaId;
        const recruiterName = recruiterId ? raMap.get(recruiterId) || "" : "";
        
        const recruitedAt = expert.expertSourcedAt 
          ? new Date(expert.expertSourcedAt).toISOString().split("T")[0]
          : "";

        return [
          escapeCSV(expert.expertName),
          escapeCSV(expert.expertEmail),
          escapeCSV(expert.expertJobTitle),
          escapeCSV(angleNames),
          "Interested", // Status is always "Interested" for shortlisted
          escapeCSV(formattedDate),
          escapeCSV(recruiterName),
          escapeCSV(recruitedAt),
          String(expert.expertId)
        ].join(",");
      });

      // Combine headers and rows
      const csvContent = [headers.join(","), ...rows].join("\n");

      // Set response headers for CSV download
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition", 
        `attachment; filename="shortlist_project_${projectId}.csv"`
      );
      res.send(csvContent);

    } catch (error) {
      console.error("Error exporting shortlist:", error);
      res.status(500).json({ error: "Failed to export shortlist" });
    }
  });

  return httpServer;
}
