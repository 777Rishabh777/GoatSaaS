const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function seed() {
  const envPath = path.join(__dirname, '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  let dbUrl = '';
  for (const line of envContent.split(/\r?\n/)) {
    if (line.trim().startsWith('DATABASE_URL=')) {
      dbUrl = line.trim().substring('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();
    }
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Seeding Admin User...");
    await pool.query(`
      INSERT INTO users (id, email, name, role, plan, password_hash, avatar, status, org_id, org_name, org_role)
      VALUES (
        'usr_admin_001',
        'admin@goatsaas.com',
        'Super Admin',
        'admin',
        'enterprise',
        '$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW',
        'SA',
        'active',
        'org_goatsaas',
        'GOAT SaaS Inc.',
        'owner'
      )
      ON CONFLICT (id) DO NOTHING;
    `);
    
    // Create an API key for the admin
    await pool.query(`
      INSERT INTO api_keys (id, org_id, user_id, name, key_hash, key_prefix, key_suffix, plan, calls_today, total_calls)
      VALUES (
        'key_123456',
        'org_goatsaas',
        'usr_admin_001',
        'Production Key',
        'dummy_hash_for_seed',
        'gsk_live_seed',
        'seed',
        'enterprise',
        0,
        0
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    console.log("Seeding Regular Demo User...");
    await pool.query(`
      INSERT INTO users (id, email, name, role, plan, password_hash, avatar, status, org_id, org_name, org_role)
      VALUES (
        'usr_demo_002',
        'rishabh@goatsaas.com',
        'Rishabh (Demo)',
        'user',
        'free',
        '$2b$10$AhKkOeoccvLnw2x67/9Yr.3JyaeDmEsCqTX3sBWQHRxd.wY3Zx5NW',
        'RD',
        'active',
        'org_goatsaas',
        'GOAT SaaS Inc.',
        'member'
      )
      ON CONFLICT (id) DO NOTHING;
    `);

    // Setup initial quota
    await pool.query(`
      INSERT INTO quota_daily (org_id, date, total_calls)
      VALUES ('org_goatsaas', CURRENT_DATE, 0)
      ON CONFLICT (org_id, date) DO NOTHING;
    `);

    console.log("Seeding complete! You can now login as admin@goatsaas.com / password");
  } catch (e) {
    console.error("Seeding failed:", e);
  } finally {
    await pool.end();
  }
}

seed();
