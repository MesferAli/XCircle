import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import bcrypt from "bcryptjs";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { db } from "../db";
import { users, tenants, type User } from "@shared/schema";
import { eq, or } from "drizzle-orm";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function findUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user;
}

async function findUserByGoogleId(googleId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
  return user;
}

async function findUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

async function createUserWithTenant(data: {
  email: string;
  password?: string;
  googleId?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}): Promise<User> {
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || "مستخدم جديد";
  const tenantName = `${name}'s Organization`;
  
  const [tenant] = await db
    .insert(tenants)
    .values({ 
      name: tenantName, 
      status: "active",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days trial
    })
    .returning();

  const [user] = await db
    .insert(users)
    .values({
      username: data.email,
      email: data.email,
      password: data.password,
      googleId: data.googleId,
      firstName: data.firstName,
      lastName: data.lastName,
      profileImageUrl: data.profileImageUrl,
      tenantId: tenant.id,
      role: "admin",
    })
    .returning();

  return user;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await findUserById(id);
      done(null, user || null);
    } catch (error) {
      done(error, null);
    }
  });

  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const user = await findUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "البريد الإلكتروني غير مسجل" });
          }
          if (!user.password) {
            return done(null, false, { message: "يرجى تسجيل الدخول عبر Google" });
          }
          const isValid = await verifyPassword(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "كلمة المرور غير صحيحة" });
          }
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
          scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            const firstName = profile.name?.givenName;
            const lastName = profile.name?.familyName;
            const profileImageUrl = profile.photos?.[0]?.value;

            let user = await findUserByGoogleId(googleId);
            
            if (!user && email) {
              user = await findUserByEmail(email);
              if (user) {
                await db
                  .update(users)
                  .set({ 
                    googleId, 
                    firstName: firstName || user.firstName,
                    lastName: lastName || user.lastName,
                    profileImageUrl: profileImageUrl || user.profileImageUrl,
                  })
                  .where(eq(users.id, user.id));
                user = await findUserById(user.id);
              }
            }

            if (!user && email) {
              user = await createUserWithTenant({
                email,
                googleId,
                firstName,
                lastName,
                profileImageUrl,
              });
            }

            if (!user) {
              return done(null, false, { message: "لم يتم العثور على البريد الإلكتروني" });
            }

            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "حدث خطأ في الخادم" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "فشل تسجيل الدخول" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "حدث خطأ في تسجيل الدخول" });
        }
        return res.json({ 
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
          }
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "البريد الإلكتروني وكلمة المرور مطلوبان" });
      }

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "البريد الإلكتروني مسجل مسبقاً" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await createUserWithTenant({
        email,
        password: hashedPassword,
        firstName,
        lastName,
      });

      req.logIn(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "حدث خطأ في تسجيل الدخول" });
        }
        return res.json({ 
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
          }
        });
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      return res.status(500).json({ message: "حدث خطأ في التسجيل" });
    }
  });

  app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google_auth_failed" }),
    (req, res) => {
      res.redirect("/");
    }
  );

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/login");
    });
  });

  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "غير مصرح" });
    }
    const user = req.user as User;
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      platformRole: user.platformRole,
      tenantId: user.tenantId,
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};
