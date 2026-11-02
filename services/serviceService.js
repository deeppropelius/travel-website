import express from 'express';
import { pool } from './db.js';
import { optionalAuth, isUUID, generateUUID } from './authService.js';
import { generateBookingRef } from './bookingService.js';
const SERVICES_DATA = [
    {
        id: 'srv-weather',
        slug: 'calculated-weather',
        title: 'Calculated Weather & Climate Forecasts',
        tagline: 'Hyper-local meteorological precision for seamless trip scheduling',
        category: 'Planning',
        icon: 'fa-solid fa-cloud-sun-rain',
        badge: 'Popular',
        short_desc: 'Predictive micro-climate forecasts, seasonal rainfall tracking, and AI-powered packing recommendations for any destination.',
        description: 'Never let unexpected monsoon showers or sudden temperature drops interrupt your holiday. Our Calculated Weather intelligence cross-analyzes multi-decade satellite records with real-time atmospheric radar to deliver hour-by-hour route forecasts, ideal sun-bathing hours, and wardrobe recommendations.',
        features: [
            'Hourly microclimate radar tracking',
            'AI wardrobe & equipment packing guides',
            'Historical seasonal rainfall heatmaps',
            'Extreme weather alerts & automatic route rerouting'
        ],
        starting_price: 'Included',
        unit: 'Free with any booking',
        rating: 4.9,
        reviews_count: 1420,
        included_perks: ['24/7 Weather Radar SMS alerts', 'Destination climate guide PDF', 'Route contingency guarantee'],
        banner_image: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-flights',
        slug: 'best-flights',
        title: 'Best Flights & Private Air Charter',
        tagline: 'Preferred corporate airfares, private charters, and priority sky lounges',
        category: 'Air & Flights',
        icon: 'fa-solid fa-plane-departure',
        badge: 'Bestseller',
        short_desc: 'Exclusive airline partnerships offering guaranteed best seat fares, business upgrades, and flexible charter routes worldwide.',
        description: 'Fly with distinguished luxury and peace of mind. Jadoo partners with Star Alliance, SkyTeam, and boutique private aviation networks across Europe, North America, and Asia to secure discounted business-class cabins, expedited terminal transfers, and private runway charters.',
        features: [
            'Global airfare price-drop guarantee',
            'Complimentary airport VIP lounge access',
            'Complimentary excess baggage allowance',
            'Flexible same-day itinerary rescheduling'
        ],
        starting_price: '$180',
        unit: 'per flight segment',
        rating: 4.95,
        reviews_count: 3280,
        included_perks: ['Fast-track security clearance pass', 'Dedicated air transit concierge', 'Flight delay compensation insurance'],
        banner_image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-events',
        slug: 'local-events',
        title: 'VIP Local Events & Cultural Pass',
        tagline: 'Front-row festival access, private museum tours, and cultural galas',
        category: 'VIP & Events',
        icon: 'fa-solid fa-masks-theater',
        badge: 'Exclusive',
        short_desc: 'Curated backstage passes, sold-out theatre tickets, historic gala admissions, and private after-hours museum entries.',
        description: 'Experience your destination through the eyes of an insider. Skip the 3-hour tourist queues with VIP skip-the-line privileges at the Vatican, private gondola serenades in Venice, Michelin-star chef table reservations, and front-row tickets to iconic opera and arts festivals.',
        features: [
            'Skip-the-line express admission to major world landmarks',
            'Private historian and certified local art guides',
            'Exclusive culinary tastings with Master Sommeliers',
            'Sold-out sports and cultural festival access'
        ],
        starting_price: '$65',
        unit: 'per experience pass',
        rating: 4.88,
        reviews_count: 980,
        included_perks: ['Bilingual private guide', 'Audio headset & private transport', 'Complimentary welcome aperitivo'],
        banner_image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-custom',
        slug: 'customization',
        title: 'Bespoke Itinerary Customization',
        tagline: 'Tailor-made journeys crafted around your personal passions',
        category: 'Bespoke',
        icon: 'fa-solid fa-sliders',
        badge: 'Signature',
        short_desc: 'Collaborate with dedicated travel architects to build unique multi-destination itineraries tailored to your pace and lifestyle.',
        description: 'No two travelers are identical. Whether you desire an architectural grand tour through Tuscany, an adrenaline-fueled Swiss helicopter safari, or a tranquil Maldives wellness retreat, our private travel designers engineer day-by-day itineraries tailored to your exact desires.',
        features: [
            '1-on-1 consultation with a Master Travel Architect',
            'Dynamic day-by-day digital mobile itinerary pass',
            'Flexible multi-city transport and hotel coordination',
            'Surprise anniversary and honeymoon bespoke touches'
        ],
        starting_price: '$120',
        unit: 'per customized plan',
        rating: 4.96,
        reviews_count: 2150,
        included_perks: ['24/7 Dedicated WhatsApp trip manager', 'Unlimited itinerary revisions', 'Personalized dining & shopping black book'],
        banner_image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-stays',
        slug: 'luxury-stays',
        title: 'Curated Luxury Stays & Villas',
        tagline: '5-star heritage palazzos, overwater bungalows, and alpine chalets',
        category: 'Stays',
        icon: 'fa-solid fa-hotel',
        badge: 'Luxury Tier',
        short_desc: 'Hand-selected luxury accommodations with room upgrades, complimentary champagne breakfasts, and early check-in.',
        description: 'Rest in extraordinary sanctuaries. Jadoo hand-inspects every property in our portfolio, guaranteeing breathtaking panoramic views, 400-thread-count Egyptian cotton linens, Michelin-starred in-house dining, and world-class spa facilities.',
        features: [
            'Guaranteed room category upgrade upon arrival',
            'Daily complimentary gourmet artisan breakfast',
            '$100 resort culinary and wellness spa credit',
            'Guaranteed 4:00 PM late check-out privilege'
        ],
        starting_price: '$240',
        unit: 'per night',
        rating: 4.92,
        reviews_count: 1840,
        included_perks: ['Welcome bottle of vintage champagne', 'High-speed encrypted fiber Wi-Fi', 'Private butler service on request'],
        banner_image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-transfers',
        slug: 'airport-transfers',
        title: 'Private Chauffeur & Executive Transit',
        tagline: 'Zero-wait airport pickups in premium Mercedes, BMW, and Tesla fleets',
        category: 'Logistics',
        icon: 'fa-solid fa-car-side',
        badge: 'Convenience',
        short_desc: 'Meet-and-greet airport transfers with flight tracking, luggage assistance, and luxury climate-controlled private vehicles.',
        description: 'Step off your flight directly into comfort. Your uniformed private chauffeur monitors your flight landing in real time, waits at arrivals with a personalized digital tablet, handles all luggage, and escorts you smoothly to your hotel suite.',
        features: [
            'Real-time flight arrival tracking and zero wait fees',
            'Executive Mercedes S-Class, V-Class, and Tesla Model X fleet',
            'Complimentary chilled bottled spring water and device charging',
            'Certified multi-lingual professional chauffeurs'
        ],
        starting_price: '$55',
        unit: 'per private transfer',
        rating: 4.89,
        reviews_count: 3100,
        included_perks: ['60-minute complimentary airport wait time', 'Child seats available upon request', 'Toll fees and baggage gratuity included'],
        banner_image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-visa',
        slug: 'visa-passport-concierge',
        title: 'Visa & Passport Concierge',
        tagline: 'Expedited diplomatic visa clearance and document processing',
        category: 'Planning',
        icon: 'fa-solid fa-passport',
        badge: 'Fast Track',
        short_desc: 'Hassle-free visa applications, embassy appointment scheduling, and fast-track digital e-Visa verification.',
        description: 'Eliminate bureaucratic headaches. Our licensed immigration specialists audit your travel documents, draft official consulate invitation itineraries, verify health entrance regulations, and expedite digital e-Visas within 24 to 48 hours.',
        features: [
            'Document error pre-check and consulate compliance audit',
            'Expedited biometric appointment booking',
            'Digital e-Visa processing with SMS status alerts',
            'Lost passport emergency consular assistance'
        ],
        starting_price: '$45',
        unit: 'per visa application',
        rating: 4.85,
        reviews_count: 890,
        included_perks: ['100% money-back document accuracy guarantee', 'Digital passport vault backup', '24/7 Embassy liaison hotline'],
        banner_image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80'
    },
    {
        id: 'srv-insurance',
        slug: 'travel-insurance',
        title: 'Global Travel Protection & Insurance',
        tagline: 'Comprehensive medical, flight cancellation, and baggage coverage',
        category: 'Logistics',
        icon: 'fa-solid fa-shield-halved',
        badge: 'Essential',
        short_desc: 'International emergency medical coverage up to $1M, baggage loss protection, and 100% trip cancellation reimbursement.',
        description: 'Travel fearlessly with gold-standard international travel insurance. Backed by world-class underwriters, our policies provide zero-deductible medical emergency care, emergency air evacuation, lost passport compensation, and full refunds for weather cancellations.',
        features: [
            'Up to $1,000,000 USD international emergency medical coverage',
            'Zero-deductible hospital admission with direct billing',
            'Cancel for Any Reason (CFAR) trip reimbursement',
            'Immediate luggage delay and replacement stipend'
        ],
        starting_price: '$35',
        unit: 'per traveler / trip',
        rating: 4.94,
        reviews_count: 2450,
        included_perks: ['Instant digital claims portal (24-hr payouts)', 'COVID-19 and epidemic medical inclusion', 'Global air ambulance dispatch network'],
        banner_image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80'
    }
];
const inquiriesStore = [];
export class ServiceService {
    static getAllServices() {
        return SERVICES_DATA;
    }
    static async getAllServicesFromDB(category) {
        try {
            const res = await pool.query('SELECT * FROM services ORDER BY created_at ASC');
            if (res.rows.length > 0) {
                return res.rows.map(row => ({
                    id: row.id,
                    slug: row.slug,
                    title: row.title,
                    tagline: row.tagline,
                    category: row.category,
                    icon: row.icon,
                    badge: row.badge,
                    short_desc: row.short_desc,
                    description: row.description,
                    features: typeof row.features === 'string' ? JSON.parse(row.features) : (row.features || []),
                    starting_price: row.starting_price,
                    unit: row.unit,
                    rating: parseFloat(row.rating) || 5.0,
                    reviews_count: parseInt(row.reviews_count, 10) || 0,
                    included_perks: typeof row.included_perks === 'string' ? JSON.parse(row.included_perks) : (row.included_perks || []),
                    banner_image: row.banner_image,
                    author_id: row.author_id,
                    author_name: row.author_name,
                    destination_id: row.destination_id,
                    destination_name: row.destination_name
                }));
            }
        }
        catch (err) {
            console.warn('PostgreSQL fetch services warning:', err);
        }
        return SERVICES_DATA;
    }
    static getServiceBySlug(slug) {
        return SERVICES_DATA.find(s => s.slug === slug || s.id === slug);
    }
    static async getServiceBySlugFromDB(slug) {
        try {
            const res = await pool.query('SELECT * FROM services WHERE slug = $1 OR id = $1 LIMIT 1', [slug]);
            if (res.rows.length > 0) {
                const row = res.rows[0];
                return {
                    id: row.id,
                    slug: row.slug,
                    title: row.title,
                    tagline: row.tagline,
                    category: row.category,
                    icon: row.icon,
                    badge: row.badge,
                    short_desc: row.short_desc,
                    description: row.description,
                    features: typeof row.features === 'string' ? JSON.parse(row.features) : (row.features || []),
                    starting_price: row.starting_price,
                    unit: row.unit,
                    rating: parseFloat(row.rating) || 5.0,
                    reviews_count: parseInt(row.reviews_count, 10) || 0,
                    included_perks: typeof row.included_perks === 'string' ? JSON.parse(row.included_perks) : (row.included_perks || []),
                    banner_image: row.banner_image,
                    author_id: row.author_id,
                    author_name: row.author_name,
                    destination_id: row.destination_id,
                    destination_name: row.destination_name
                };
            }
        }
        catch (err) {
            console.warn('PostgreSQL getServiceBySlug error:', err);
        }
        return this.getServiceBySlug(slug);
    }
    static getServicesByCategory(cat) {
        if (!cat || cat.toLowerCase() === 'all')
            return SERVICES_DATA;
        return SERVICES_DATA.filter(s => s.category.toLowerCase() === cat.toLowerCase());
    }
    static recordInquiry(inquiry) {
        const record = {
            ...inquiry,
            id: 'INQ-' + Math.floor(100000 + Math.random() * 900000),
            status: 'confirmed',
            created_at: new Date().toISOString()
        };
        inquiriesStore.unshift(record);
        return record;
    }
    static getInquiries() {
        return inquiriesStore;
    }
    static async createServiceInDB(serviceData) {
        const slug = (serviceData.slug || serviceData.title || 'custom-service')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        const newService = {
            id: 'srv-' + Date.now().toString(36),
            slug,
            title: serviceData.title || 'Bespoke Travel Concierge',
            tagline: serviceData.tagline || 'Customized luxury travel experience tailored to your itinerary',
            category: serviceData.category || 'Bespoke',
            icon: serviceData.icon || 'fa-solid fa-crown',
            badge: serviceData.badge || 'VIP Bespoke',
            short_desc: serviceData.short_desc || serviceData.description?.slice(0, 140) || 'Custom bespoke travel package designed for discerning explorers.',
            description: serviceData.description || 'Exclusive custom travel package designed for discerning explorers with dedicated concierge liaison.',
            features: Array.isArray(serviceData.features) && serviceData.features.length > 0
                ? serviceData.features
                : ['Personalized VIP concierge liaison', 'Direct priority reservation guarantees', '24/7 dedicated travel support hotline'],
            starting_price: serviceData.starting_price || '$500',
            unit: serviceData.unit || 'per booking',
            rating: 5.0,
            reviews_count: 1,
            included_perks: Array.isArray(serviceData.included_perks) && serviceData.included_perks.length > 0
                ? serviceData.included_perks
                : ['100% bespoke customization', 'Direct concierge access', 'Flexible cancellation'],
            banner_image: serviceData.banner_image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            author_id: serviceData.author_id,
            author_name: serviceData.author_name,
            destination_id: serviceData.destination_id,
            destination_name: serviceData.destination_name
        };
        SERVICES_DATA.unshift(newService);
        try {
            await pool.query(`INSERT INTO services (id, slug, title, tagline, category, icon, badge, short_desc, description, features, starting_price, unit, rating, reviews_count, included_perks, banner_image, author_id, author_name, destination_id, destination_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description`, [
                newService.id,
                newService.slug,
                newService.title,
                newService.tagline,
                newService.category,
                newService.icon,
                newService.badge,
                newService.short_desc,
                newService.description,
                JSON.stringify(newService.features),
                newService.starting_price,
                newService.unit,
                newService.rating,
                newService.reviews_count,
                JSON.stringify(newService.included_perks),
                newService.banner_image,
                newService.author_id || null,
                newService.author_name || null,
                newService.destination_id || null,
                newService.destination_name || null
            ]);
        }
        catch (err) {
            console.warn('Could not persist custom service to PostgreSQL:', err);
        }
        return newService;
    }
    static createService(serviceData) {
        const slug = (serviceData.slug || serviceData.title || 'custom-service')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
        const newService = {
            id: 'srv-' + Date.now().toString(36),
            slug,
            title: serviceData.title || 'Bespoke Travel Concierge',
            tagline: serviceData.tagline || 'Customized luxury travel experience tailored to your itinerary',
            category: serviceData.category || 'Bespoke',
            icon: serviceData.icon || 'fa-solid fa-crown',
            badge: serviceData.badge || 'VIP Bespoke',
            short_desc: serviceData.short_desc || serviceData.description?.slice(0, 140) || 'Custom bespoke travel package designed for discerning explorers.',
            description: serviceData.description || 'Exclusive custom travel package designed for discerning explorers with dedicated concierge liaison.',
            features: Array.isArray(serviceData.features) && serviceData.features.length > 0
                ? serviceData.features
                : ['Personalized VIP concierge liaison', 'Direct priority reservation guarantees', '24/7 dedicated travel support hotline'],
            starting_price: serviceData.starting_price || '$500',
            unit: serviceData.unit || 'per booking',
            rating: 5.0,
            reviews_count: 1,
            included_perks: Array.isArray(serviceData.included_perks) && serviceData.included_perks.length > 0
                ? serviceData.included_perks
                : ['100% bespoke customization', 'Direct concierge access', 'Flexible cancellation'],
            banner_image: serviceData.banner_image || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
            author_id: serviceData.author_id,
            author_name: serviceData.author_name,
            destination_id: serviceData.destination_id,
            destination_name: serviceData.destination_name
        };
        SERVICES_DATA.unshift(newService);
        return newService;
    }
}
// ══════════════════════════════════════════════════════════════
// SERVICE ROUTER
// ══════════════════════════════════════════════════════════════
export const serviceRouter = express.Router();
// GET /api/services
serviceRouter.get('/', async (_req, res) => {
    try {
        const category = _req.query.category;
        const services = await ServiceService.getAllServicesFromDB(category);
        res.json(services);
    }
    catch (err) {
        console.warn('GET /api/services error, fallback to memory:', err);
        res.json(ServiceService.getAllServices());
    }
});
// GET /api/services/:slug
serviceRouter.get('/:slug', async (req, res) => {
    try {
        const service = await ServiceService.getServiceBySlugFromDB(req.params.slug);
        if (!service)
            return res.status(404).json({ error: 'Service not found' });
        res.json(service);
    }
    catch (err) {
        console.error('GET /api/services/:slug error:', err);
        const fallback = ServiceService.getServiceBySlug(req.params.slug);
        if (!fallback)
            return res.status(404).json({ error: 'Service not found' });
        res.json(fallback);
    }
});
// POST /api/services/inquire (Separate booking per destination)
serviceRouter.post('/inquire', optionalAuth, async (req, res) => {
    try {
        let { service_id, service_title, customer_name, customer_email, customer_phone, travel_destination, destinations, travel_date, guests_count, package_type, message, customer_id } = req.body;
        if (req.user) {
            customer_id = customer_id || req.user.id;
            customer_email = customer_email || req.user.email;
            customer_name = customer_name || req.user.full_name;
        }
        if (!service_id || !customer_name || !customer_email) {
            return res.status(400).json({ error: 'service_id, customer_name, and customer_email are required' });
        }
        // 1. Resolve service
        const service = await ServiceService.getServiceBySlugFromDB(service_id);
        const resolvedTitle = service_title || service?.title || 'Jadoo Travel Service';
        // 2. Extract destinations list - every destination gets a separate booking
        let destList = [];
        if (Array.isArray(destinations) && destinations.length > 0) {
            destList = destinations.map((d) => String(d).trim()).filter(Boolean);
        }
        else if (typeof travel_destination === 'string' && travel_destination.trim()) {
            destList = travel_destination
                .split(/[,;&\/]|\band\b/i)
                .map((s) => s.trim())
                .filter(Boolean);
        }
        if (destList.length === 0) {
            destList = ['Rome']; // default destination fallback
        }
        // 3. Resolve / create customer in PostgreSQL
        let custId = customer_id;
        if (!custId || !isUUID(custId)) {
            const custCheck = await pool.query('SELECT id, full_name FROM customer WHERE email ILIKE $1 LIMIT 1', [customer_email.trim()]);
            if (custCheck.rows.length) {
                custId = custCheck.rows[0].id;
            }
            else {
                custId = generateUUID();
                await pool.query('INSERT INTO customer (id, full_name, email, phone) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING id', [custId, customer_name.trim(), customer_email.trim().toLowerCase(), customer_phone ? customer_phone.trim() : null]);
            }
        }
        // Pricing calculation
        const rawPrice = parseFloat((service?.starting_price || '').replace(/[^0-9.]/g, '')) || 0;
        const pricePerPerson = rawPrice > 0 ? rawPrice : 45.00;
        const guests = parseInt(String(guests_count || '1'), 10) || 1;
        const totalPrice = pricePerPerson * guests;
        // Package Type
        const rawPkg = String(package_type || 'VIP').toLowerCase();
        const pkg = rawPkg.includes('vip') ? 'VIP' : rawPkg.includes('lux') ? 'luxury' : 'standard';
        // Travel Date
        const validDate = travel_date && /^\d{4}-\d{2}-\d{2}$/.test(travel_date)
            ? travel_date
            : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // 4. Create a SEPARATE booking record for EVERY destination in PostgreSQL
        const createdBookings = [];
        for (const destName of destList) {
            let destId;
            let resolvedDestName = destName;
            let destHeroImg = service?.banner_image || './assets/destination-rome.png';
            const destCheck = await pool.query('SELECT id, name, country, hero_img FROM destination WHERE name ILIKE $1 LIMIT 1', [destName.trim()]);
            if (destCheck.rows.length > 0) {
                destId = destCheck.rows[0].id;
                resolvedDestName = destCheck.rows[0].name;
                if (destCheck.rows[0].hero_img)
                    destHeroImg = destCheck.rows[0].hero_img;
            }
            else {
                destId = generateUUID();
                const insDest = await pool.query('INSERT INTO destination (id, name, country, latitude, longitude, hero_img) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id, hero_img', [destId, destName.trim(), 'International', 0, 0, destHeroImg]);
                if (insDest.rows.length) {
                    destId = insDest.rows[0].id;
                    if (insDest.rows[0].hero_img)
                        destHeroImg = insDest.rows[0].hero_img;
                }
            }
            const bookingId = generateUUID();
            const bookingRef = generateBookingRef();
            const attractionName = `Service: ${resolvedTitle}`;
            const bookingResult = await pool.query(`
        INSERT INTO booking (
          id, booking_ref, name, customer_id, destination_id, destination_name, attraction_name,
          user_name, user_email, phone_number, travel_date, guests_count, package_type,
          price_per_person, total_price, special_request, status, image_url,
          service_id, service_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `, [
                bookingId,
                bookingRef,
                attractionName,
                custId,
                destId,
                resolvedDestName,
                attractionName,
                customer_name.trim(),
                customer_email.trim().toLowerCase(),
                customer_phone ? customer_phone.trim() : null,
                validDate,
                guests,
                pkg,
                pricePerPerson,
                totalPrice,
                message ? `[Service Booking: ${resolvedTitle}] ${message.trim()}` : `Service booking for ${resolvedDestName}`,
                'confirmed',
                destHeroImg,
                service_id,
                resolvedTitle
            ]);
            createdBookings.push(bookingResult.rows[0]);
        }
        // 5. Record inquiry tracking object
        const record = ServiceService.recordInquiry({
            customer_id: custId,
            service_id,
            service_title: resolvedTitle,
            customer_name,
            customer_email,
            customer_phone,
            travel_destination: destList.join(', '),
            travel_date: validDate,
            message
        });
        res.status(201).json({
            message: `Confirmed ${createdBookings.length} separate destination booking(s) for ${resolvedTitle}`,
            inquiry: record,
            bookings: createdBookings,
            count: createdBookings.length,
            destinations: destList
        });
    }
    catch (err) {
        console.error('POST /api/services/inquire error:', err);
        res.status(500).json({ error: 'Server error processing service inquiry and bookings' });
    }
});
// POST /api/services
serviceRouter.post('/', optionalAuth, async (req, res) => {
    try {
        const serviceData = req.body;
        if (!serviceData || !serviceData.title) {
            return res.status(400).json({ error: 'Service title is required' });
        }
        if (req.user) {
            serviceData.author_id = req.user.id;
            serviceData.author_name = req.user.full_name;
        }
        if (serviceData.destination_name) {
            const destCheck = await pool.query('SELECT id, name FROM destination WHERE name ILIKE $1 LIMIT 1', [serviceData.destination_name.trim()]);
            if (destCheck.rows.length) {
                serviceData.destination_id = destCheck.rows[0].id;
                serviceData.destination_name = destCheck.rows[0].name;
            }
        }
        const created = await ServiceService.createServiceInDB(serviceData);
        res.status(201).json(created);
    }
    catch (err) {
        console.error('POST /api/services error:', err);
        res.status(500).json({ error: 'Server error creating service' });
    }
});
