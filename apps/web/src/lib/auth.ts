import jwt from "jsonwebtoken";

function getJwtSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    return "goatsaas-dev-jwt-secret-key-2024-super-secure-random-hex-string";
  }
  return secret;
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: "user" | "admin";
  plan: "free" | "pro" | "enterprise";
  avatar?: string;
  orgId?: string;
  orgName?: string;
  orgRole?: "owner" | "admin" | "member";
}

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string | undefined): UserPayload | null {
  if (!token) return null;

  try {
    return jwt.verify(token, getJwtSecret()) as UserPayload;
  } catch {
    return null;
  }
}

// In-memory user store (replace with DB in production)
export const USERS_DB: (UserPayload & { password: string; createdAt: string; lastLogin: string; status: string })[] = [
  {
    id: "usr_admin_001",
    email: "admin@goatsaas.com",
    name: "Super Admin",
    role: "admin",
    plan: "enterprise",
    password: "$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW", // "password"
    createdAt: "2024-01-01T00:00:00Z",
    lastLogin: new Date().toISOString(),
    status: "active",
    avatar: "SA",
    orgId: "org_goatsaas",
    orgName: "GOATSaaS Inc.",
    orgRole: "owner",
  },
  {
    id: "usr_001",
    email: "rishabh@goatsaas.com",
    name: "Rishabh Dev",
    role: "user",
    plan: "pro",
    password: "$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW", // "password"
    createdAt: "2024-02-15T10:30:00Z",
    lastLogin: new Date().toISOString(),
    status: "active",
    avatar: "RD",
    orgId: "org_goatsaas",
    orgName: "GOATSaaS Inc.",
    orgRole: "admin",
  },
  {
    id: "usr_002",
    email: "jane@acmecorp.com",
    name: "Jane Smith",
    role: "user",
    plan: "enterprise",
    password: "$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW", // "password"
    createdAt: "2024-03-10T08:00:00Z",
    lastLogin: "2024-05-18T14:22:00Z",
    status: "active",
    avatar: "JS",
    orgId: "org_acme",
    orgName: "Acme Corp",
    orgRole: "owner",
  },
  {
    id: "usr_003",
    email: "mike@startupxyz.io",
    name: "Mike Chen",
    role: "user",
    plan: "free",
    password: "$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW", // "password"
    createdAt: "2024-04-20T12:45:00Z",
    lastLogin: "2024-05-15T09:10:00Z",
    status: "active",
    avatar: "MC",
    orgId: "org_startup",
    orgName: "StartupXYZ",
    orgRole: "owner",
  },
  {
    id: "usr_004",
    email: "sara@techventures.com",
    name: "Sara Patel",
    role: "user",
    plan: "pro",
    password: "$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW", // "password"
    createdAt: "2024-05-01T16:00:00Z",
    lastLogin: "2024-05-19T11:30:00Z",
    status: "suspended",
    avatar: "SP",
    orgId: "org_tech",
    orgName: "Tech Ventures",
    orgRole: "owner",
  },
];

export interface Invite {
  id: string;
  email: string;
  orgId: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "revoked";
  invitedBy: string;
  createdAt: string;
}

export const INVITES_DB: Invite[] = [
  {
    id: "inv_001",
    email: "collaborator@goatsaas.com",
    orgId: "org_goatsaas",
    role: "member",
    status: "pending",
    invitedBy: "usr_001",
    createdAt: "2026-05-20T10:00:00Z",
  },
];

