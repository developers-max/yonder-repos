import { db } from '../src/lib/db';
import { organizationsTable, processStepsTable, organizationStepsTable } from '../src/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Backfill script to populate organization steps for existing organizations
 * Run AFTER seed-process-steps.ts
 * Run with: tsx scripts/backfill-organization-steps.ts
 */

async function backfillOrganizationSteps() {
  console.log('🔄 Starting organization steps backfill...');

  try {
    // Get all process steps
    const processSteps = await db
      .select({ id: processStepsTable.id })
      .from(processStepsTable)
      .orderBy(asc(processStepsTable.orderIndex));

    if (processSteps.length === 0) {
      console.error('❌ No process steps found! Please run seed-process-steps.ts first.');
      process.exit(1);
    }

    console.log(`✅ Found ${processSteps.length} process steps to backfill`);

    // Get all organizations
    const organizations = await db
      .select({ id: organizationsTable.id, name: organizationsTable.name })
      .from(organizationsTable);

    console.log(`✅ Found ${organizations.length} organizations`);

    if (organizations.length === 0) {
      console.log('ℹ️  No organizations to backfill');
      return;
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    // Process each organization
    for (const org of organizations) {
      console.log(`\nProcessing organization: ${org.name} (${org.id})`);

      // Check if organization already has steps
      const existingOrgSteps = await db
        .select()
        .from(organizationStepsTable)
        .where(eq(organizationStepsTable.organizationId, org.id));

      if (existingOrgSteps.length > 0) {
        console.log(`  ⏭️  Skipping - already has ${existingOrgSteps.length} steps`);
        totalSkipped++;
        continue;
      }

      // Create organization steps for all process steps
      const orgStepsToInsert = processSteps.map(processStep => ({
        id: randomUUID(),
        organizationId: org.id,
        processStepId: processStep.id,
        status: 'pending' as const,
        createdAt: new Date(),
      }));

      await db
        .insert(organizationStepsTable)
        .values(orgStepsToInsert);

      console.log(`  ✅ Created ${orgStepsToInsert.length} steps`);
      totalCreated++;
    }

    console.log('\n' + '='.repeat(50));
    console.log('✨ Backfill complete!');
    console.log(`  Organizations processed: ${organizations.length}`);
    console.log(`  Organizations updated: ${totalCreated}`);
    console.log(`  Organizations skipped: ${totalSkipped}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}

// Run the backfill
backfillOrganizationSteps()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
