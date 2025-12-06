import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { 
  usersTable, 
  accountsTable, 
  sessionsTable, 
  verificationsTable,
  organizationsTable,
  membersTable,
  invitationsTable,
  processStepsTable,
  organizationStepsTable,
  organizationPlotsTable,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail, emailTemplates, isResendConfigured } from "@/lib/email";

// Testable helper to run post-organization-create logic
export async function seedOrganizationAfterCreate(
  dbInst: typeof db,
  organization: { id: string; name?: string; slug?: string; metadata?: Record<string, unknown> | null }
) {
  console.log(`[seedOrganizationAfterCreate] Starting for organization ${organization.id} (${organization.name})`);
  
  // Seed initial organization steps from the master process steps
  const steps = await dbInst
    .select({ id: processStepsTable.id })
    .from(processStepsTable);

  console.log(`[seedOrganizationAfterCreate] Found ${steps.length} master process steps`);

  if (steps.length > 0) {
    const orgSteps = steps.map((s) => ({
      id: randomUUID(),
      organizationId: organization.id,
      processStepId: s.id,
      status: 'pending' as const,
      createdAt: new Date(),
    }));
    
    await dbInst.insert(organizationStepsTable).values(orgSteps);
    console.log(`[seedOrganizationAfterCreate] Successfully created ${orgSteps.length} organization steps`);
  } else {
    console.warn(`[seedOrganizationAfterCreate] WARNING: No master process steps found! Organization ${organization.id} will have no steps. Run: npm run seed:process-steps`);
  }

  // Ensure base fields are set similarly to user bootstrap org
  await dbInst
    .update(organizationsTable)
    .set({
      // Preserve provided values but ensure they are present
      name: organization.name ?? undefined,
      slug: organization.slug ?? undefined,
      metadata: organization.metadata ?? {},
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(organizationsTable.id, organization.id));
  
  console.log(`[seedOrganizationAfterCreate] Completed for organization ${organization.id}`);
}

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: usersTable,
      account: accountsTable,
      session: sessionsTable,
      verification: verificationsTable,
      organization: organizationsTable,
      member: membersTable,
      invitation: invitationsTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      mapProfileToUser: (profile) => {
        return {
          first_name: profile.given_name || profile.name?.split(' ')[0] || 'User',
          last_name: profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '',
        };
      },
    },
  },
  pages: {
    error: '/auth/error', // Custom error page
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!isResendConfigured()) {
        console.warn('[Email Verification] Resend not configured, skipping email');
        return;
      }
      
      const template = emailTemplates.verification(url);
      const result = await sendEmail({
        to: user.email,
        subject: template.subject,
        html: template.html,
      });
      
      if (result.success) {
        console.log(`[Email Verification] Sent verification email to ${user.email}`);
      } else {
        console.error(`[Email Verification] Failed to send: ${result.error}`);
      }
    },
  },
  user: {
    additionalFields: {
      first_name: {
        type: "string",
        required: true,
        input: true,
      },
      last_name: {
        type: "string", 
        required: true,
        input: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: Number(process.env.ORGANIZATION_LIMIT ?? '10'),
      creatorRole: "owner",
      membershipLimit: 100,
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    })
  ],
  databaseHooks: {
    organization: {
      create: {
        after: async (organization: { id: string; name?: string; slug?: string; metadata?: Record<string, unknown> | null }) => {
          try {
            await seedOrganizationAfterCreate(db, organization);
            console.log(`Seeded process steps and defaults for new organization ${organization.id}`);
          } catch (error) {
            console.error('Failed in organization.create.after hook:', error);
          }
        }
      }
    },
    user: {
      create: {
        after: async (user) => {
          try {
            // Auto-assign realtor role if:
            // 1. Email domain matches a known realtor company website, OR
            // 2. User has plots assigned to them in organization_plots
            try {
              let shouldBeRealtor = false;
              const userEmail = (user.email || "").toLowerCase();
              const emailDomain = userEmail.split("@")[1];

              // Check 1: Domain match with realtors website_url
              if (emailDomain) {
                const match = await db.execute(sql`
                  SELECT 1 FROM realtors
                  WHERE website_url ILIKE ${'%' + emailDomain + '%'}
                  LIMIT 1
                `);
                const rows = (match && typeof match === 'object' && 'rows' in match)
                  ? (match as unknown as { rows: unknown[] }).rows
                  : (match as unknown as unknown[]);
                if (Array.isArray(rows) && rows.length > 0) {
                  shouldBeRealtor = true;
                  console.log(`User ${user.id} matched realtor domain: ${emailDomain}`);
                }
              }

              // Check 2: Has plots assigned to this email
              if (!shouldBeRealtor && userEmail) {
                const assignedPlots = await db
                  .select({ id: organizationPlotsTable.id })
                  .from(organizationPlotsTable)
                  .where(eq(organizationPlotsTable.realtorEmail, userEmail))
                  .limit(1);
                
                if (assignedPlots.length > 0) {
                  shouldBeRealtor = true;
                  console.log(`User ${user.id} has plots assigned to email: ${userEmail}`);
                }
              }

              // Assign realtor role if either condition is met
              if (shouldBeRealtor) {
                await db
                  .update(usersTable)
                  .set({ role: 'realtor' })
                  .where(eq(usersTable.id, user.id));
                console.log(`Assigned realtor role to user ${user.id}`);
              }
            } catch (e) {
              console.error('Realtor role auto-assign check failed:', e);
            }

            // Create default organization for new user (organization = project)
            const [defaultOrganization] = await db.insert(organizationsTable).values({
              id: randomUUID(),
              name: "My Dream Home",
              slug: `my-dream-home-${user.id}`,
              status: "active", // Set default project status
              createdAt: new Date(),
              updatedAt: new Date(),
            }).returning();

            // Add user as owner of the organization
            await db.insert(membersTable).values({
              id: randomUUID(),
              userId: user.id,
              organizationId: defaultOrganization.id,
              role: "owner",
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            // Seed process steps for the default organization
            // (direct insert bypasses organization.create.after hook)
            await seedOrganizationAfterCreate(db, defaultOrganization);

            console.log(`Created default organization/project for user ${user.id}: ${defaultOrganization.id}`);
          } catch (error) {
            console.error('Failed to create default organization for user:', error);
          }
        }
      }
    },
    session: {
      create: {
        after: async (session) => {
          try {
            // Ensure realtor role on login (fallback for existing users)
            // Check website domain match and plot assignments
            try {
              const [u] = await db
                .select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
                .from(usersTable)
                .where(eq(usersTable.id, session.userId))
                .limit(1);

              if (u && u.email && (u.role === 'user' || !u.role)) {
                let shouldBeRealtor = false;
                const userEmail = u.email.toLowerCase();
                const emailDomain = userEmail.split('@')[1];

                // Check 1: Domain match with realtors website_url
                if (emailDomain) {
                  const match = await db.execute(sql`
                    SELECT 1 FROM realtors
                    WHERE website_url ILIKE ${'%' + emailDomain + '%'}
                    LIMIT 1
                  `);
                  const rows = (match && typeof match === 'object' && 'rows' in match)
                    ? (match as unknown as { rows: unknown[] }).rows
                    : (match as unknown as unknown[]);
                  if (Array.isArray(rows) && rows.length > 0) {
                    shouldBeRealtor = true;
                    console.log(`User ${u.id} matched realtor domain on login: ${emailDomain}`);
                  }
                }

                // Check 2: Has plots assigned to this email
                if (!shouldBeRealtor) {
                  const assignedPlots = await db
                    .select({ id: organizationPlotsTable.id })
                    .from(organizationPlotsTable)
                    .where(eq(organizationPlotsTable.realtorEmail, userEmail))
                    .limit(1);
                  
                  if (assignedPlots.length > 0) {
                    shouldBeRealtor = true;
                    console.log(`User ${u.id} has plots assigned on login: ${userEmail}`);
                  }
                }

                // Assign realtor role if either condition is met
                if (shouldBeRealtor) {
                  await db
                    .update(usersTable)
                    .set({ role: 'realtor' })
                    .where(eq(usersTable.id, session.userId));
                  console.log(`Assigned realtor role to user ${u.id} on login`);
                }
              }
            } catch (e) {
              console.error('Realtor role auto-assign on login failed:', e);
            }

            // Auto-set active organization if user doesn't have one
            // Cast session to include our custom fields
            const sessionWithCustomFields = session as typeof session & { activeOrganizationId?: string | null };
            
            if (!sessionWithCustomFields.activeOrganizationId) {
              // Get user's first organization
              const userMemberships = await db
                .select({
                  organizationId: membersTable.organizationId,
                })
                .from(membersTable)
                .where(eq(membersTable.userId, session.userId))
                .limit(1);

              if (userMemberships.length > 0) {
                const organizationId = userMemberships[0].organizationId;
                
                // Update session with active organization
                await db
                  .update(sessionsTable)
                  .set({ activeOrganizationId: organizationId })
                  .where(eq(sessionsTable.id, session.id));
                
                console.log(`Auto-set active organization ${organizationId} for session ${session.id}`);
              }
            }
          } catch (error) {
            console.error('Failed to auto-set active organization:', error);
          }
        }
      }
    }
  }
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user & {
  first_name: string;
  last_name: string;
}; 