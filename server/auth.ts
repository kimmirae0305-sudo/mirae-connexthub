import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required for authentication");
}

const JWT_SECRET: string = process.env.SESSION_SECRET;

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ error: "Unauthorized - Invalid token" });
  }

  req.user = user;
  next();
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden - Insufficient permissions" });
    }

    next();
  };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden - Admin access required" });
  }

  next();
}

/**
 * 개발용 임시 로그인 핸들러
 * DB나 storage 없이, 고정된 계정만 로그인 허용
 */
export async function loginHandler(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // ⬇⬇ 여기 자격 증명은 필요하면 너가 바꿔도 됨 ⬇⬇
    const DEV_EMAIL = "mirae@miraeconnexthub.com";
    const DEV_PASSWORD = "password123";

    if (email !== DEV_EMAIL || password !== DEV_PASSWORD) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const authUser: AuthUser = {
      id: 1,
      fullName: "Mirae (Dev Admin)",
      email: DEV_EMAIL,
      role: "admin",
      mustChangePassword: false,
    };

    const token = generateToken(authUser);

    return res.json({ token, user: authUser });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Login failed" });
  }
}

export async function getMeHandler(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json(req.user);
}
