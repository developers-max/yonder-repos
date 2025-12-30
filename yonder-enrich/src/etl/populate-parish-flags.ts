/**
 * Utility script to populate isParish and parentMunicipalityName fields
 * in the municipalities table based on portugal_parishes data
 */

import dotenv from 'dotenv';
import { getPgPool } from '@yonder/persistence';

dotenv.config();

async function populateParishFlags() {
  const pool = getPgPool();
  const client = await pool.connect();
  
  try {
    console.log('🔍 Starting parish flag population...\n');

    // First, ensure the columns exist
    console.log('Ensuring columns exist...');
    await client.query(`
      ALTER TABLE municipalities 
      ADD COLUMN IF NOT EXISTS is_parish BOOLEAN DEFAULT FALSE
    `);
    await client.query(`
      ALTER TABLE municipalities 
      ADD COLUMN IF NOT EXISTS parent_municipality_name VARCHAR(255)
    `);
    console.log('✓ Columns ensured\n');

    // Create indexes if they don't exist
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_municipalities_is_parish 
      ON municipalities(is_parish)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_municipalities_parent_name 
      ON municipalities(parent_municipality_name)
    `);
    console.log('✓ Indexes created\n');

    // Reset all municipalities to not parish first
    console.log('Resetting all municipalities to is_parish=false...');
    await client.query(`
      UPDATE municipalities 
      SET is_parish = false, parent_municipality_name = NULL
    `);
    console.log('✓ Reset complete\n');

    // Find all parishes and their parent municipalities
    console.log('Finding parishes from portugal_parishes table...');
    const parishResult = await client.query(`
      SELECT 
        pp.name as parish_name,
        pm.name as parent_municipality_name
      FROM portugal_parishes pp
      INNER JOIN portugal_municipalities pm ON pp.municipality_id = pm.id
      WHERE pp.name IS NOT NULL
    `);

    console.log(`Found ${parishResult.rows.length} parishes in portugal_parishes\n`);

    // Update municipalities table based on parish data
    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundParishes: string[] = [];

    for (const row of parishResult.rows) {
      const { parish_name, parent_municipality_name } = row;
      
      const updateResult = await client.query(`
        UPDATE municipalities 
        SET 
          is_parish = true,
          parent_municipality_name = $1
        WHERE name = $2
      `, [parent_municipality_name, parish_name]);

      if (updateResult.rowCount && updateResult.rowCount > 0) {
        updatedCount++;
        if (updatedCount % 100 === 0) {
          console.log(`  Updated ${updatedCount} municipalities...`);
        }
      } else {
        notFoundCount++;
        notFoundParishes.push(parish_name);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✓ Updated ${updatedCount} municipalities as parishes`);
    console.log(`  ⚠ ${notFoundCount} parishes not found in municipalities table`);
    
    if (notFoundParishes.length > 0 && notFoundParishes.length <= 20) {
      console.log('\nParishes not found in municipalities table:');
      notFoundParishes.forEach(name => console.log(`  - ${name}`));
    }

    // Show statistics
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_parish = true) as parish_count,
        COUNT(*) FILTER (WHERE is_parish = false) as municipality_count,
        COUNT(*) as total_count
      FROM municipalities
    `);

    console.log('\n📈 Final statistics:');
    console.log(`  Parishes: ${statsResult.rows[0].parish_count}`);
    console.log(`  Municipalities: ${statsResult.rows[0].municipality_count}`);
    console.log(`  Total: ${statsResult.rows[0].total_count}`);

    console.log('\n✅ Parish flag population complete!');
  } catch (error) {
    console.error('❌ Error populating parish flags:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  populateParishFlags()
    .then(() => {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Script failed:', error);
      process.exit(1);
    });
}

export { populateParishFlags };
