const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  let dbUrl = '';
  for (const line of envContent.split(/\r?\n/)) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      dbUrl = line.trim().substring('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
    }
  }

  if (!dbUrl) {
    console.error("DATABASE_URL not found in .env.local");
    process.exit(1);
  }

  console.log("Connecting to Database...");
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log("Running schema.sql...");
  
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(schemaSql);
    console.log("Schema applied successfully!");
    
    // Check tables
    const tables = await pool.query(`
      SELECT tablename 
      FROM pg_catalog.pg_tables 
      WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
    `);
    
    console.log("\nTables created:");
    tables.rows.forEach(r => console.log(`- ${r.tablename}`));
    
    // Seed Demo Data
    console.log("\nSeeding demo organization...");
    await pool.query(`
      INSERT INTO organizations (id, name, plan) 
      VALUES ('org_goatsaas', 'GOAT SaaS Inc.', 'enterprise')
      ON CONFLICT (id) DO NOTHING;
    `);
    
    console.log("Done!");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await pool.end();
  }
}

migrate();
