require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  console.log('--- Migrating customer table to users in PostgreSQL ---');

  // 1. Check if users table already exists
  const checkUsers = await pool.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='users'
  `);
  const checkCustomer = await pool.query(`
    SELECT table_name, table_type FROM information_schema.tables WHERE table_schema='public' AND table_name='customer'
  `);

  console.log('Current state: users exists?', checkUsers.rows.length > 0, '| customer exists?', checkCustomer.rows.length > 0);

  if (checkCustomer.rows.length > 0 && checkCustomer.rows[0].table_type === 'BASE TABLE' && checkUsers.rows.length === 0) {
    console.log('Renaming table customer -> users...');
    await pool.query('ALTER TABLE customer RENAME TO users;');
    console.log('✅ Table customer successfully renamed to users.');
  }

  // 2. Ensure customer view exists for backwards compatibility
  console.log('Ensuring customer view/alias exists for backwards compatibility...');
  await pool.query('CREATE OR REPLACE VIEW customer AS SELECT * FROM users;');
  console.log('✅ View customer created pointing to users.');

  // 3. Verify users table structure
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position
  `);
  console.log('Users table columns:', cols.rows);

  // 4. Verify existing rows in users
  const rows = await pool.query('SELECT id, full_name, email, created_at, logged_in_at FROM users');
  console.log(`Current users in PostgreSQL (${rows.rows.length} total):`, rows.rows);

  await pool.end();
  console.log('Migration completed successfully.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

