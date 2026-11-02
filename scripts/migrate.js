import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../services/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  console.log('Running PostgreSQL migration for Jadoo Travel...');
  
  const sqlPath = path.resolve(__dirname, '../schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL. Applying schema & seeds...');

    await client.query(sql);

    // Also verify or seed attractions
    const checkAttractions = await client.query('SELECT count(*) FROM attraction');
    if (parseInt(checkAttractions.rows[0].count, 10) === 0) {
      console.log(' Seeding attractions...');
      await client.query(`
        INSERT INTO attraction (id, name, destination_name, category, description, image_url, price_amount, rating, reviews_count, duration, wiki_url, point) VALUES
        ('d1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01', 'Colosseum & Roman Forum', 'Rome', 'Historical Landmark', 'Ancient amphitheatre and center of the Roman Empire.', './assets/destination-rome.png', 35.00, 4.9, 1420, '3 Hours', 'https://en.wikipedia.org/wiki/Colosseum', '{"lat": 41.8902, "lon": 12.4922}'),
        ('d1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02', 'Vatican Museums & Sistine Chapel', 'Rome', 'Museum & Art', 'World renowned art collections and Michelangelo frescoes.', './assets/destination-rome.png', 45.00, 4.8, 980, '4 Hours', 'https://en.wikipedia.org/wiki/Vatican_Museums', '{"lat": 41.9065, "lon": 12.4536}'),
        ('d1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03', 'Tower of London & Crown Jewels', 'London', 'Historical Landmark', 'Historic castle on the north bank of the River Thames.', './assets/destination-london.jpeg', 32.00, 4.8, 1150, '3 Hours', 'https://en.wikipedia.org/wiki/Tower_of_London', '{"lat": 51.5081, "lon": -0.0759}'),
        ('d1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c04', 'British Museum Highlights Tour', 'London', 'Museum & Art', 'Human history, art and culture from antiquity to present.', './assets/destination-london.jpeg', 25.00, 4.7, 860, '2.5 Hours', 'https://en.wikipedia.org/wiki/British_Museum', '{"lat": 51.5194, "lon": -0.1270}'),
        ('d1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c05', 'Eiffel Tower Summit Tour', 'Paris', 'Architecture', 'Iconic wrought-iron lattice tower on the Champ de Mars.', './assets/destination-paris.jpg', 40.00, 4.9, 2100, '2.5 Hours', 'https://en.wikipedia.org/wiki/Eiffel_Tower', '{"lat": 48.8584, "lon": 2.2945}'),
        ('d1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c06', 'Louvre Masterpieces & Mona Lisa', 'Paris', 'Museum & Art', 'The world’s most visited museum and historic landmark.', './assets/destination-paris.jpg', 38.00, 4.8, 1750, '3 Hours', 'https://en.wikipedia.org/wiki/Louvre', '{"lat": 48.8606, "lon": 2.3376}')
        ON CONFLICT (id) DO NOTHING;
      `);
    }

    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('PostgreSQL migration finished successfully!');
    console.log('Current tables:', tablesRes.rows.map(r => r.table_name).join(', '));

    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
