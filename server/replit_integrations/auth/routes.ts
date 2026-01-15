import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user with identity and domain user info
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const identityId = req.user.claims.sub;
      const identity = await authStorage.getAuthIdentity(identityId);
      
      if (!identity) {
        return res.status(404).json({ message: "Identity not found" });
      }
      
      // Try to get linked domain user
      let domainUser = await authStorage.getDomainUser(identityId);
      
      // Auto-provision tenant and user on first login
      if (!domainUser) {
        const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ");
        domainUser = await authStorage.provisionUserAndTenant(
          identityId, 
          name, 
          identity.email || ""
        );
        console.log(`Provisioned new user and tenant for identity ${identityId}`);
      }
      
      // Return combined user info
      res.json({
        id: identity.id,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        profileImageUrl: identity.profileImageUrl,
        // Domain user fields (always present after provisioning)
        userId: domainUser.id,
        tenantId: domainUser.tenantId,
        role: domainUser.role,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
