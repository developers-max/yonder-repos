import { db } from '../src/lib/db';
import { processStepsTable, yonderPartnersTable, organizationStepsTable } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Seed script to populate master process steps for Portugal land acquisition
 * Run with: tsx scripts/seed-process-steps.ts
 */

const PORTUGAL_ACQUISITION_STEPS = [
  {
    name: 'find_land',
    title: 'Find land',
    detailedDescription: 'Browse and search for suitable land plots using Yonder\'s search tools. Filter by location, price, size, and other criteria to find plots that match your requirements.',
    category: 'planning',
    orderIndex: 1,
    estimatedTime: 'Ongoing',
    isRequired: true,
    yonderPartner: false,
    docsNeeded: []
  },
  {
    name: 'add_plot_to_project',
    title: 'Add plot to project',
    detailedDescription: 'Select and add your chosen plot to your project. This allows you to track progress and access detailed information about the plot.',
    category: 'planning',
    orderIndex: 2,
    estimatedTime: '5 minutes',
    isRequired: true,
    yonderPartner: false,
    docsNeeded: []
  },
  {
    name: 'quick_scan',
    title: 'Quick scan (PDM + zoning)',
    detailedDescription: 'Review the Municipal Master Plan (PDM) and zoning information for your plot. Read the AI-generated report to understand building regulations, restrictions, and development potential.',
    category: 'planning',
    orderIndex: 3,
    estimatedTime: '1-2 days',
    isRequired: true,
    yonderPartner: false,
    docsNeeded: ['PDM documents', 'Zoning certificate', 'AI Report']
  },
  {
    name: 'outreach_to_realtors',
    title: 'Outreach to realtors / request info',
    detailedDescription: 'Contact realtors or property owners to request additional information, schedule viewings, and initiate negotiations.',
    category: 'planning',
    orderIndex: 4,
    estimatedTime: '1-2 weeks',
    isRequired: true,
    yonderPartner: false,
    docsNeeded: ['Letter of interest', 'Initial questions']
  },
  {
    name: 'unlock_next_steps',
    title: 'Unlock next steps (handover to experts)',
    detailedDescription: 'Complete the initial assessment and unlock access to Yonder\'s expert network for legal due diligence, financing, and acquisition support.',
    category: 'planning',
    orderIndex: 5,
    estimatedTime: '1 day',
    isRequired: true,
    yonderPartner: true,
    docsNeeded: ['Project summary', 'Plot details']
  },
];

async function seedProcessSteps() {
  console.log('🌱 Starting process steps seeding...');

  try {
    // Check if steps already exist
    const existingSteps = await db.select().from(processStepsTable);
    
    if (existingSteps.length > 0) {
      console.log(`⚠️  Found ${existingSteps.length} existing process steps. Clearing them first...`);
      
      // First, clear all organization steps (foreign key constraint)
      const orgSteps = await db.select().from(organizationStepsTable);
      if (orgSteps.length > 0) {
        console.log(`   Clearing ${orgSteps.length} organization steps first...`);
        await db.delete(organizationStepsTable);
        console.log('   ✅ Cleared organization steps');
      }
      
      // Now clear master process steps
      await db.delete(processStepsTable);
      console.log('✅ Cleared existing master steps');
    }

    // Create a default Yonder partner (legal advisor) for steps that require partner support
    const [yonderPartner] = await db
      .select()
      .from(yonderPartnersTable)
      .where(eq(yonderPartnersTable.type, 'legal_advisor'))
      .limit(1);

    let partnerId: string | undefined;

    if (!yonderPartner) {
      console.log('Creating default Yonder legal partner...');
      const [newPartner] = await db
        .insert(yonderPartnersTable)
        .values({
          name: 'Yonder Legal Team',
          type: 'legal_advisor',
          email: 'legal@yonder.com',
          specialties: ['Property law', 'Land acquisition', 'Portuguese real estate'],
          isActive: true,
        })
        .returning();
      partnerId = newPartner.id;
      console.log('✅ Created default Yonder partner');
    } else {
      partnerId = yonderPartner.id;
      console.log('✅ Using existing Yonder partner');
    }

    // Insert all process steps
    const stepsToInsert = PORTUGAL_ACQUISITION_STEPS.map(step => ({
      ...step,
      yonderPartnerId: step.yonderPartner ? partnerId : undefined,
    }));

    await db.insert(processStepsTable).values(stepsToInsert);

    console.log(`✅ Successfully seeded ${stepsToInsert.length} process steps!`);
    console.log('\nSeeded steps:');
    stepsToInsert.forEach((step, idx) => {
      console.log(`  ${idx + 1}. ${step.title} (${step.category})`);
    });

    console.log('\n✨ Process steps seeding complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Existing organizations need steps: Run the backfill script');
    console.log('  2. New organizations will automatically get these steps on creation');
    
  } catch (error) {
    console.error('❌ Error seeding process steps:', error);
    throw error;
  }
}

// Run the seed
seedProcessSteps()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
