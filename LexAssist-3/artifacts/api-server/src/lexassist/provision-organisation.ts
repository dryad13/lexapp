/**
 * Shared firm provisioning used by create-org CLI and platform API.
 */
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { validatePassword } from "./password-policy";

export type ProvisionOrganisationInput = {
  name: string;
  adminUser: string;
  adminPass: string;
  adminDisplay?: string;
  plan?: string;
};

export type ProvisionOrganisationResult = {
  organisation: {
    id: number;
    name: string;
    subscriptionPlan: string;
    status: string;
    isPlatform: boolean;
  };
  admin: {
    id: number;
    username: string;
    displayName: string;
  };
};

export async function provisionOrganisation(
  input: ProvisionOrganisationInput,
): Promise<ProvisionOrganisationResult> {
  const name = input.name.trim();
  const adminUser = input.adminUser.trim();
  const adminPass = input.adminPass;
  const adminDisplay = (input.adminDisplay || adminUser).trim();
  const plan = input.plan || "basic";

  if (!name || !adminUser || !adminPass) {
    throw Object.assign(new Error("name, adminUser, and adminPass are required"), { status: 400 });
  }
  if (plan !== "basic" && plan !== "pro") {
    throw Object.assign(new Error("plan must be basic or pro"), { status: 400 });
  }

  const pw = validatePassword(adminPass);
  if (!pw.ok) {
    throw Object.assign(new Error(pw.error || "Invalid password"), { status: 400 });
  }

  const existing = await storage.getOrganisationByName(name);
  if (existing) {
    throw Object.assign(new Error(`Organisation already exists: ${name}`), { status: 409 });
  }

  const org = await storage.createOrganisation({
    name,
    subscriptionPlan: plan,
    isPlatform: false,
    status: "active",
  });

  const collision = await storage.getUserByUsernameInOrg(adminUser, org.id);
  if (collision) {
    throw Object.assign(new Error(`Admin username already exists in org: ${adminUser}`), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(adminPass, 10);
  const user = await storage.createUser({
    username: adminUser,
    passwordHash,
    displayName: adminDisplay,
    role: "admin",
    department: "both",
    organisationId: org.id,
  });

  return {
    organisation: {
      id: org.id,
      name: org.name,
      subscriptionPlan: org.subscriptionPlan,
      status: org.status,
      isPlatform: org.isPlatform,
    },
    admin: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
  };
}
