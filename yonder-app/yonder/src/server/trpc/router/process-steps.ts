import { z } from 'zod';
import { protectedProcedure, router } from '../trpc';
import { db } from '../../../lib/db';
import { 
  processStepsTable, 
  organizationStepsTable, 
  membersTable,
  yonderPartnersTable 
} from '../../../lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export const processStepsRouter = router({
  // Get list of all process steps
  getProcessSteps: protectedProcedure
    .query(async () => {
      const processSteps = await db
        .select({
          id: processStepsTable.id,
          orderIndex: processStepsTable.orderIndex,
          name: processStepsTable.name,
          title: processStepsTable.title,
          detailedDescription: processStepsTable.detailedDescription,
          yonderPartner: processStepsTable.yonderPartner,
          yonderPartnerId: processStepsTable.yonderPartnerId,
          isRequired: processStepsTable.isRequired,
          category: processStepsTable.category,
          estimatedTime: processStepsTable.estimatedTime,
          docsNeeded: processStepsTable.docsNeeded,
          createdAt: processStepsTable.createdAt,
          // Partner details
          partnerName: yonderPartnersTable.name,
          partnerType: yonderPartnersTable.type,
          partnerEmail: yonderPartnersTable.email,
        })
        .from(processStepsTable)
        .leftJoin(yonderPartnersTable, eq(processStepsTable.yonderPartnerId, yonderPartnersTable.id))
        .orderBy(asc(processStepsTable.orderIndex));

      return processSteps;
    }),

  // Create organization steps for an organization (initializes all process steps)
  createOrganizationSteps: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify organization membership
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(and(
          eq(membersTable.userId, ctx.user.id),
          eq(membersTable.organizationId, input.organizationId)
        ))
        .limit(1);

      if (!membership) {
        throw new Error('You are not a member of this organization');
      }

      // Get all process steps
      const processSteps = await db
        .select({ id: processStepsTable.id, yonderPartnerId: processStepsTable.yonderPartnerId })
        .from(processStepsTable)
        .orderBy(asc(processStepsTable.orderIndex));

      // Check if organization steps already exist
      const existingOrgSteps = await db
        .select()
        .from(organizationStepsTable)
        .where(eq(organizationStepsTable.organizationId, input.organizationId));

      if (existingOrgSteps.length > 0) {
        throw new Error('Organization steps already exist for this organization');
      }

      // Create organization steps for all process steps
      const orgStepsToInsert = processSteps.map(processStep => ({
        organizationId: input.organizationId,
        processStepId: processStep.id,
        status: 'pending' as const,
        assignedTo: processStep.yonderPartnerId, // Auto-assign to Yonder partner if available
      }));

      const createdOrgSteps = await db
        .insert(organizationStepsTable)
        .values(orgStepsToInsert)
        .returning();

      return {
        organizationId: input.organizationId,
        stepsCreated: createdOrgSteps.length,
        organizationSteps: createdOrgSteps,
      };
    }),

  // Update organization step status
  updateOrganizationStepStatus: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      processStepId: z.string(),
      status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
      assignedTo: z.string().optional(), // Yonder partner ID
      completed: z.boolean().optional(), // Shorthand for marking as completed/not completed
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify organization membership
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(and(
          eq(membersTable.userId, ctx.user.id),
          eq(membersTable.organizationId, input.organizationId)
        ))
        .limit(1);

      if (!membership) {
        throw new Error('You are not a member of this organization');
      }

      // Verify process step exists
      const [processStep] = await db
        .select()
        .from(processStepsTable)
        .where(eq(processStepsTable.id, input.processStepId));

      if (!processStep) {
        throw new Error('Process step not found');
      }

      // If assignedTo is provided, verify partner exists
      if (input.assignedTo) {
        const [partner] = await db
          .select()
          .from(yonderPartnersTable)
          .where(eq(yonderPartnersTable.id, input.assignedTo));

        if (!partner) {
          throw new Error('Yonder partner not found');
        }
      }

      // Build update object
      const updateData: Partial<typeof organizationStepsTable.$inferInsert> = {};
      
      // Handle completed shorthand
      if (input.completed !== undefined) {
        updateData.status = input.completed ? 'completed' : 'pending';
        updateData.completedAt = input.completed ? new Date() : null;
      } else if (input.status) {
        updateData.status = input.status;
        updateData.completedAt = input.status === 'completed' ? new Date() : null;
      }

      if (input.assignedTo !== undefined) {
        updateData.assignedTo = input.assignedTo;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('No fields to update');
      }

      // Update the organization step
      const [updatedOrgStep] = await db
        .update(organizationStepsTable)
        .set(updateData)
        .where(and(
          eq(organizationStepsTable.organizationId, input.organizationId),
          eq(organizationStepsTable.processStepId, input.processStepId)
        ))
        .returning();

      if (!updatedOrgStep) {
        throw new Error('Organization step not found');
      }

      return updatedOrgStep;
    }),

  // Get organization steps for an organization
  getOrganizationSteps: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify organization membership
      const [membership] = await db
        .select()
        .from(membersTable)
        .where(and(
          eq(membersTable.userId, ctx.user.id),
          eq(membersTable.organizationId, input.organizationId)
        ))
        .limit(1);

      if (!membership) {
        throw new Error('You are not a member of this organization');
      }

      // Get organization steps with process step details and partner info
      const organizationSteps = await db
        .select({
          // Organization step fields
          id: organizationStepsTable.id,
          organizationId: organizationStepsTable.organizationId,
          processStepId: organizationStepsTable.processStepId,
          status: organizationStepsTable.status,
          assignedTo: organizationStepsTable.assignedTo,
          completedAt: organizationStepsTable.completedAt,
          createdAt: organizationStepsTable.createdAt,
          // Process step details
          orderIndex: processStepsTable.orderIndex,
          name: processStepsTable.name,
          title: processStepsTable.title,
          detailedDescription: processStepsTable.detailedDescription,
          yonderPartner: processStepsTable.yonderPartner,
          isRequired: processStepsTable.isRequired,
          category: processStepsTable.category,
          estimatedTime: processStepsTable.estimatedTime,
          docsNeeded: processStepsTable.docsNeeded,
          // Assigned partner details
          partnerName: yonderPartnersTable.name,
          partnerType: yonderPartnersTable.type,
          partnerEmail: yonderPartnersTable.email,
        })
        .from(organizationStepsTable)
        .innerJoin(processStepsTable, eq(organizationStepsTable.processStepId, processStepsTable.id))
        .leftJoin(yonderPartnersTable, eq(organizationStepsTable.assignedTo, yonderPartnersTable.id))
        .where(eq(organizationStepsTable.organizationId, input.organizationId))
        .orderBy(asc(processStepsTable.orderIndex));

      return organizationSteps;
    }),


}); 