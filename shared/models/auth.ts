import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// Auth identities table - stores OIDC identity claims from Replit Auth
// This is separate from domain users to maintain Zero Trust separation
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const authIdentities = pgTable("auth_identities", {
  id: varchar("id").primaryKey(), // OIDC sub claim
  email: varchar("email"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  userId: varchar("user_id"), // Links to domain users table
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertAuthIdentity = typeof authIdentities.$inferInsert;
export type AuthIdentity = typeof authIdentities.$inferSelect;
