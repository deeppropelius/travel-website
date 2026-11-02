const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const arg = process.argv[2] ? process.argv[2].trim() : '';
const limit = process.argv[3] ? parseInt(process.argv[3], 10) : 20;

async function run() {
  try {
    if (!arg || arg === 'list' || arg === 'all') {
      console.log('\n📊 Jadoo PostgreSQL Database - Tables & Views\n');
      const tables = await pool.query(`
        SELECT 
          t.table_type,
          t.table_name,
          COALESCE(c.reltuples::bigint, 0) as approximate_rows
        FROM information_schema.tables t
        LEFT JOIN pg_class c ON c.relname = t.table_name
        WHERE t.table_schema = 'public'
        ORDER BY t.table_type, t.table_name;
      `);

      // Get exact row counts
      const results = [];
      for (const row of tables.rows) {
        try {
          const countRes = await pool.query(`SELECT count(*) FROM "${row.table_name}"`);
          results.push({
            'Table Name': row.table_name,
            'Type': row.table_type,
            'Total Rows': parseInt(countRes.rows[0].count, 10)
          });
        } catch (_) {
          results.push({
            'Table Name': row.table_name,
            'Type': row.table_type,
            'Total Rows': 'N/A'
          });
        }
      }
      console.table(results);
      console.log('💡 Tip: To view data in a specific table, run:');
      console.log('   node scripts/view-tables.cjs <table_name>');
      console.log('   Example: node scripts/view-tables.cjs users\n');
      return;
    }

    // If arg is a full SQL query
    if (/^select\s+/i.test(arg)) {
      console.log(`\n🔍 Executing Custom Query: ${arg}\n`);
      const res = await pool.query(arg);
      if (res.rows.length === 0) {
        console.log('Query returned 0 rows.');
      } else {
        console.table(res.rows);
        console.log(`Showing ${res.rows.length} rows.`);
      }
      return;
    }

    // Otherwise, arg is a table name
    const tableName = arg.toLowerCase().replace(/[^a-z0-9_]/g, '');
    console.log(`\n📋 Table: "${tableName}" (Showing up to ${limit} rows)\n`);

    // Verify table exists
    const check = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    `, [tableName]);

    if (check.rows.length === 0) {
      console.error(`❌ Table or view "${tableName}" does not exist in database.`);
      console.log('Available tables: users, booking, destination, attraction, services, testimonials, newsletter_subscribers, customer');
      return;
    }

    // Query columns
    const cols = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    // Query data
    let query = `SELECT * FROM "${tableName}"`;
    if (cols.rows.some(c => c.column_name === 'created_at')) {
      query += ` ORDER BY created_at DESC`;
    }
    query += ` LIMIT ${limit}`;

    const data = await pool.query(query);

    if (data.rows.length === 0) {
      console.log(`Table "${tableName}" is currently empty (0 rows).`);
    } else {
      // If table is booking, format json fields and dates for clean CLI display
      const formatted = data.rows.map(row => {
        const item = { ...row };
        // Truncate long passwords or fields for terminal readability
        if (item.password) item.password = item.password.substring(0, 15) + '...';
        if (item.booked_services && Array.isArray(item.booked_services)) {
          item.booked_services = `${item.booked_services.length} attached`;
        }
        if (item.features && Array.isArray(item.features)) {
          item.features = `[${item.features.length} features]`;
        }
        if (item.included_perks && Array.isArray(item.included_perks)) {
          item.included_perks = `[${item.included_perks.length} perks]`;
        }
        if (item.point && typeof item.point === 'object') {
          item.point = JSON.stringify(item.point);
        }
        return item;
      });

      console.table(formatted);
      console.log(`Showing ${data.rows.length} rows.`);
    }

  } catch (err) {
    console.error('Database Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();

