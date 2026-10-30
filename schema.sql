
-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── 1. Customer ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name   TEXT        NOT NULL,
  email       TEXT        NOT NULL UNIQUE,
  password    TEXT,                        -- hashed (bcrypt)
  phone       TEXT,
  avatar_url  TEXT,
  logged_in_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Destination ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS destination (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  country     TEXT        NOT NULL,
  latitude    FLOAT       NOT NULL,
  longitude   FLOAT       NOT NULL,
  source      TEXT,
  hero_img    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Attraction (child of destination) ─────────────────────
CREATE TABLE IF NOT EXISTS attraction (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,
  destination_name TEXT        NOT NULL REFERENCES destination(name) ON UPDATE CASCADE ON DELETE CASCADE,
  category         TEXT        NOT NULL CHECK (category IN (
                     'Historical Landmark','Museum & Art','Architecture',
                     'Nature & Scenery','Entertainment & Leisure')),
  description      TEXT,
  image_url        TEXT,
  price_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  rating           NUMERIC(3,2)  NOT NULL DEFAULT 0,
  reviews_count    INTEGER       NOT NULL DEFAULT 0,
  duration         TEXT,
  wiki_url         TEXT,
  point            JSONB,                  -- { lat, lon }
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Booking ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref     TEXT          UNIQUE NOT NULL DEFAULT 'BK-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0'),
  customer_id     UUID          NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  destination_id  UUID          NOT NULL REFERENCES destination(id) ON DELETE CASCADE,
  destination_name TEXT         NOT NULL,
  attraction_name TEXT          NOT NULL,
  user_name       TEXT          NOT NULL,
  user_email      TEXT          NOT NULL,
  phone_number    TEXT,
  travel_date     DATE          NOT NULL,
  guests_count    INTEGER       NOT NULL DEFAULT 1,
  package_type    TEXT          NOT NULL CHECK (package_type IN ('standard','VIP','luxury')),
  price_per_person NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price     NUMERIC(10,2) NOT NULL DEFAULT 0,
  special_request TEXT,
  status          TEXT          NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  image_url       TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 5. Testimonials ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS testimonials (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  custumer_id      UUID        REFERENCES customer(id) ON DELETE SET NULL,  -- FK (matches ER diagram spelling)
  destination_id   UUID        REFERENCES destination(id) ON DELETE SET NULL,
  destination_name TEXT        NOT NULL,
  author_name      TEXT        NOT NULL,
  author_location  TEXT,
  role_title       TEXT,
  quote            TEXT        NOT NULL,
  rating           NUMERIC(3,2) NOT NULL DEFAULT 5.0,
  avatar_url       TEXT,
  trip_tag         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Updated-at trigger function ───────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['customer','destination','attraction','booking','testimonials']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

-- ── Seed: Destinations ────────────────────────────────────────
INSERT INTO destination (id, name, country, latitude, longitude, hero_img, description) VALUES
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e01', 'Rome',       'Italy',   41.9028,  12.4964, './assets/destination-rome.png',    'The Eternal City – ancient ruins, Renaissance art, and world-class cuisine.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e02', 'London',     'UK',      51.5074,  -0.1278, './assets/destination-london.jpeg', 'A cosmopolitan capital blending history, culture, and modern innovation.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e03', 'Paris',      'France',  48.8566,   2.3522, './assets/destination-paris.jpg',   'The City of Light – fashion, art, gastronomy and the iconic Eiffel Tower.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e04', 'Santorini',  'Greece',  36.3932,  25.4615, './assets/destination-santorini.jpg','Volcanic cliffs, blue-domed churches, and Aegean sunsets.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e05', 'Venice',     'Italy',   45.4408,  12.3155, './assets/destination-venice.jpg',  'Canals, gondolas, and breathtaking baroque architecture.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e06', 'Tokyo',      'Japan',   35.6762, 139.6503, './assets/destination-tokyo.jpg',   'A neon-lit metropolis where ancient traditions meet the future.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e07', 'New York',   'USA',     40.7128, -74.0060, './assets/destination-newyork.jpg', 'The city that never sleeps – skyscrapers, culture, and endless energy.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e08', 'Dubai',      'UAE',     25.2048,  55.2708, './assets/destination-dubai.jpg',   'Ultra-modern skyline, world-record towers, and desert luxury.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e09', 'Agra',       'India',   27.1767,  78.0081, './assets/destination-agra.jpg',    'Home of the Taj Mahal, one of the seven wonders of the world.'),
  ('c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e10', 'Bali',       'Indonesia',-8.3405, 115.0920,'./assets/destination-bali.jpg',    'Tropical paradise with terraced rice paddies and ancient Hindu temples.')
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Demo Customer ───────────────────────────────────────
INSERT INTO customer (id, full_name, email, phone, avatar_url) VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Alex Johnson', 'alex.traveler@example.com', '+1 (555) 234-5678', './assets/testimonials-avatar-1.png')
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Demo Bookings ───────────────────────────────────────
INSERT INTO booking (id, booking_ref, customer_id, destination_id, destination_name, attraction_name, user_name, user_email, phone_number, travel_date, guests_count, package_type, price_per_person, total_price, special_request, status, image_url) VALUES
  ('b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01','BK-92841','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e01','Rome','Colosseum & Ancient Forum','Alex Johnson','alex.traveler@example.com','+1 (555) 234-5678','2026-11-15',2,'VIP',68.75,137.50,'Morning slot requested with English-speaking archaeologist guide.','confirmed','./assets/destination-rome.png'),
  ('b1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02','BK-58203','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e02','London','Tower of London & Crown Jewels','Alex Johnson','alex.traveler@example.com','+1 (555) 234-5678','2026-12-04',1,'standard',42.00,42.00,'Wheelchair-friendly ramp access info please.','pending','./assets/destination-london.jpeg')
ON CONFLICT (id) DO NOTHING;

-- ── Seed: Testimonials ────────────────────────────────────────
INSERT INTO testimonials (id, costumer_id, destination_id, destination_name, author_name, author_location, role_title, quote, rating, avatar_url, trip_tag) VALUES
  ('f1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e01','Rome','Mike Taylor','Lahore, Pakistan','Verified Traveler','Jadoo made our dream vacation to Rome and Santorini an effortless reality. Every detail was executed with perfection!',5.0,'./assets/testimonials-avatar-1.png','Italy & Greece Tour'),
  ('f1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e02','London','Chris Thomas','London, UK','CEO of Red Button','Exceptional service and unmatched attention to detail. Organizing high-profile executive retreats across Europe has never been smoother.',5.0,'./assets/testimonials-avatar-2.png','European Executive Retreat'),
  ('f1a2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03','a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11','c7b3d8e0-1a2b-4c3d-8e4f-5a6b7c8d9e03','Paris','Sophia Martinez','Barcelona, Spain','Travel Photographer','The customized itinerary and 24/7 concierge support blew me away. I captured breathtaking sunrises in Tuscany without worrying about logistics.',4.9,'./assets/testimonials-avatar-3.png','Swiss & Tuscany Discovery')
ON CONFLICT (id) DO NOTHING;
