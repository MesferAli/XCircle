import { authIdentities, type AuthIdentity, type UpsertAuthIdentity } from "@shared/models/auth";
import { users, tenants, type User, type Tenant } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getAuthIdentity(id: string): Promise<AuthIdentity | undefined>;
  upsertAuthIdentity(identity: UpsertAuthIdentity): Promise<AuthIdentity>;
  getDomainUser(identityId: string): Promise<User | undefined>;
  linkIdentityToUser(identityId: string, userId: string): Promise<void>;
  provisionUserAndTenant(identityId: string, name: string, email: string): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getAuthIdentity(id: string): Promise<AuthIdentity | undefined> {
    const [identity] = await db.select().from(authIdentities).where(eq(authIdentities.id, id));
    return identity;
  }

  async upsertAuthIdentity(identityData: UpsertAuthIdentity): Promise<AuthIdentity> {
    const [identity] = await db
      .insert(authIdentities)
      .values(identityData)
      .onConflictDoUpdate({
        target: authIdentities.id,
        set: {
          email: identityData.email,
          firstName: identityData.firstName,
          lastName: identityData.lastName,
          profileImageUrl: identityData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return identity;
  }

  async getDomainUser(identityId: string): Promise<User | undefined> {
    const identity = await this.getAuthIdentity(identityId);
    if (!identity?.userId) return undefined;
    
    const [user] = await db.select().from(users).where(eq(users.id, identity.userId));
    return user;
  }

  async linkIdentityToUser(identityId: string, userId: string): Promise<void> {
    await db
      .update(authIdentities)
      .set({ userId, updatedAt: new Date() })
      .where(eq(authIdentities.id, identityId));
  }

  async provisionUserAndTenant(identityId: string, name: string, email: string): Promise<User> {
    const tenantName = name ? `${name}'s Organization` : `Organization`;
    
    const [tenant] = await db
      .insert(tenants)
      .values({ name: tenantName, status: "active" })
      .returning();

    const username = email || `user-${identityId.slice(0, 8)}`;
    const [user] = await db
      .insert(users)
      .values({
        username,
        password: "oauth-user",
        tenantId: tenant.id,
        role: "admin",
      })
      .returning();

    await this.linkIdentityToUser(identityId, user.id);
    return user;
  }
}

export const authStorage = new AuthStorage();
