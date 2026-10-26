/**
 * Jadoo Travel Agency - Client-Side Schema & Database Engine
 * Direct implementation of the Draw.io ER Diagram:
 * - Table: user
 * - Table: destinations
 * - Table: attraction
 * - Table: booking (with package_type and status enums)
 * - Table: testimonial
 * Persists locally via LocalStorage & Cookies for 100% Netlify & static compatibility.
 */
// Global Storage Keys
const DB_STORAGE_KEYS = {
    USERS: 'jadoo_schema_users',
    DESTINATIONS: 'jadoo_schema_destinations',
    ATTRACTIONS: 'jadoo_schema_attractions',
    BOOKINGS: 'jadoo_schema_bookings',
    TESTIMONIALS: 'jadoo_schema_testimonials',
    INITIALIZED: 'jadoo_schema_v2_initialized'
};
// Helper to generate UUIDs
export function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
// Pre-seeded Destinations matching schema
const SEED_DESTINATIONS = [
    {
        name: 'Rome',
        country: 'Italy',
        latitude: 41.8902,
        longitude: 12.4922,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-rome.png',
        description: 'The Eternal City with thousands of years of ancient history, magnificent fountains, and world-renowned gastronomy.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'London',
        country: 'United Kingdom',
        latitude: 51.5074,
        longitude: -0.1278,
        source: 'OpenTripMap & Wikipedia',
        hero_img: './assets/destination-london.jpeg',
        description: 'Vibrant cosmopolitan metropolis with iconic royal landmarks, world-class theaters, and the Thames riverfront.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Paris',
        country: 'France',
        latitude: 48.8566,
        longitude: 2.3522,
        source: 'OpenTripMap & Wikipedia',
        hero_img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80',
        description: 'The City of Light famed for the Eiffel Tower, bohemian Montmartre, haute couture, and art masterpieces.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Tokyo',
        country: 'Japan',
        latitude: 35.6762,
        longitude: 139.6503,
        source: 'OpenTripMap & Wikipedia',
        hero_img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
        description: 'Ultra-modern skyscrapers seamlessly blended with ancient Shinto shrines, culinary perfection, and neon streets.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'New York',
        country: 'United States',
        latitude: 40.7128,
        longitude: -74.0060,
        source: 'OpenTripMap & Wikipedia',
        hero_img: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80',
        description: 'The city that never sleeps, boasting breathtaking skylines, Central Park serenity, and Broadway spectacles.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Dubai',
        country: 'United Arab Emirates',
        latitude: 25.2048,
        longitude: 55.2708,
        source: 'OpenTripMap & Wikipedia',
        hero_img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80',
        description: 'Futuristic oasis of luxury, grand architectural marvels, desert safaris, and crystal marina shorelines.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Agra',
        country: 'India',
        latitude: 27.1767,
        longitude: 78.0081,
        source: 'OpenTripMap & Wikipedia',
        hero_img: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1200&q=80',
        description: 'Home of the timeless white-marble Taj Mahal, Mughal dynasty fortresses, and rich heritage artistry.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Santorini',
        country: 'Greece',
        latitude: 36.3932,
        longitude: 25.4615,
        source: 'OpenTripMap & Wikipedia',
        hero_img: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80',
        description: 'Caldera cliffside whitewashed villas, Aegean Sea panoramas, and world-famous golden sunsets.',
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    }
];
// Pre-seeded Attractions matching schema
const SEED_ATTRACTIONS = [
    // Rome
    {
        name: 'Colosseum & Ancient Forum',
        destination_name: 'Rome',
        category: 'Historical Landmark',
        description: 'Iconic amphitheatre of imperial gladiatorial contests, monumental arches, and the Roman Forum ruins.',
        image_url: './assets/destination-rome.png',
        price_amount: 55.0,
        rating: 4.9,
        reviews_count: 2840,
        duration: '3-4 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Colosseum',
        point: { lat: 41.8902, lon: 12.4922 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Vatican Museums & Sistine Chapel',
        destination_name: 'Rome',
        category: 'Museum & Art',
        description: 'St. Peter Basilica, Michelangelo frescoed ceiling, and centuries of high Renaissance papal masterpieces.',
        image_url: 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=800&q=80',
        price_amount: 68.0,
        rating: 4.9,
        reviews_count: 3410,
        duration: '4-5 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Vatican_Museums',
        point: { lat: 41.9067, lon: 12.4544 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Trevi Fountain & Spanish Steps',
        destination_name: 'Rome',
        category: 'Architecture',
        description: 'Baroque masterpiece fountain where tossing a coin guarantees your return to the Eternal City.',
        image_url: 'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=800&q=80',
        price_amount: 25.0,
        rating: 4.8,
        reviews_count: 1980,
        duration: '2 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Trevi_Fountain',
        point: { lat: 41.9009, lon: 12.4833 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // London
    {
        name: 'Tower of London & Crown Jewels',
        destination_name: 'London',
        category: 'Historical Landmark',
        description: 'Historic royal fortress on the River Thames guarding the priceless ceremonial Crown Jewels.',
        image_url: './assets/destination-london.jpeg',
        price_amount: 42.0,
        rating: 4.8,
        reviews_count: 3120,
        duration: '3-4 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Tower_of_London',
        point: { lat: 51.5081, lon: -0.0759 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'The London Eye Sky Flight',
        destination_name: 'London',
        category: 'Entertainment & Leisure',
        description: 'Europe tallest cantilevered observation wheel with breathtaking 360-degree views of London.',
        image_url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=800&q=80',
        price_amount: 38.0,
        rating: 4.7,
        reviews_count: 2450,
        duration: '1-2 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/London_Eye',
        point: { lat: 51.5033, lon: -0.1195 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'British Museum Cultural Tour',
        destination_name: 'London',
        category: 'Museum & Art',
        description: 'Global treasure trove housing the Rosetta Stone, Parthenon Sculptures, and Egyptian mummies.',
        image_url: 'https://images.unsplash.com/photo-1582561424760-0321d75e81fa?auto=format&fit=crop&w=800&q=80',
        price_amount: 29.0,
        rating: 4.9,
        reviews_count: 2890,
        duration: '3 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/British_Museum',
        point: { lat: 51.5194, lon: -0.1270 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // Paris
    {
        name: 'Eiffel Tower Summit & Champagne Tour',
        destination_name: 'Paris',
        category: 'Architecture',
        description: 'Ascend Gustave Eiffel iron masterpiece for panoramic views across Paris and Champ de Mars.',
        image_url: 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?auto=format&fit=crop&w=800&q=80',
        price_amount: 49.0,
        rating: 4.9,
        reviews_count: 4210,
        duration: '2-3 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Eiffel_Tower',
        point: { lat: 48.8584, lon: 2.2945 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Louvre Museum Mona Lisa Experience',
        destination_name: 'Paris',
        category: 'Museum & Art',
        description: 'The world largest art museum housing Leonardo da Vinci Mona Lisa, Venus de Milo, and Winged Victory.',
        image_url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80',
        price_amount: 52.0,
        rating: 4.9,
        reviews_count: 5120,
        duration: '4 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Louvre',
        point: { lat: 48.8606, lon: 2.3376 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // Tokyo
    {
        name: 'Senso-ji & Historic Asakusa Walk',
        destination_name: 'Tokyo',
        category: 'Historical Landmark',
        description: 'Tokyo oldest and most sacred Buddhist temple, vibrant Nakamise shopping street, and incense rituals.',
        image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=800&q=80',
        price_amount: 32.0,
        rating: 4.8,
        reviews_count: 1890,
        duration: '2-3 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Sens%C5%8D-ji',
        point: { lat: 35.7148, lon: 139.7967 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Shibuya Crossing & Sky Deck',
        destination_name: 'Tokyo',
        category: 'Entertainment & Leisure',
        description: 'The busiest pedestrian intersection in the world, with high-rise observation decks over the metropolis.',
        image_url: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80',
        price_amount: 35.0,
        rating: 4.9,
        reviews_count: 2750,
        duration: '2 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Shibuya_Crossing',
        point: { lat: 35.6595, lon: 139.7005 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // New York
    {
        name: 'Statue of Liberty & Ellis Island Cruise',
        destination_name: 'New York',
        category: 'Historical Landmark',
        description: 'Sail through New York Harbor to Lady Liberty pedestal and the historic immigration great hall.',
        image_url: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?auto=format&fit=crop&w=800&q=80',
        price_amount: 45.0,
        rating: 4.8,
        reviews_count: 3670,
        duration: '4 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Statue_of_Liberty',
        point: { lat: 40.6892, lon: -74.0445 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    {
        name: 'Empire State Observatory & Skydeck',
        destination_name: 'New York',
        category: 'Architecture',
        description: 'Art Deco legend rising 102 stories above Manhattan with unmatched 360-degree skylines.',
        image_url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=800&q=80',
        price_amount: 48.0,
        rating: 4.9,
        reviews_count: 4890,
        duration: '2 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Empire_State_Building',
        point: { lat: 40.7484, lon: -73.9857 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // Dubai
    {
        name: 'Burj Khalifa At The Top (124th & 125th Floor)',
        destination_name: 'Dubai',
        category: 'Architecture',
        description: 'Ascend the world tallest tower at 828 metres for dizzying views of the Arabian Gulf and desert.',
        image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80',
        price_amount: 62.0,
        rating: 4.9,
        reviews_count: 3950,
        duration: '2-3 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Burj_Khalifa',
        point: { lat: 25.1972, lon: 55.2744 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // Agra
    {
        name: 'Taj Mahal Sunrise Guided Expedition',
        destination_name: 'Agra',
        category: 'Historical Landmark',
        description: 'Pristine ivory-white marble mausoleum on the south bank of Yamuna river, a UNESCO World Wonder.',
        image_url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
        price_amount: 30.0,
        rating: 5.0,
        reviews_count: 6100,
        duration: '3-4 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Taj_Mahal',
        point: { lat: 27.1751, lon: 78.0421 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    },
    // Santorini
    {
        name: 'Oia Blue Domes Sunset Walk & Wine Tasting',
        destination_name: 'Santorini',
        category: 'Nature & Scenery',
        description: 'Clifftop whitewashed paths, vibrant volcanic caldera panoramas, and crisp Assyrtiko wine tasting.',
        image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=800&q=80',
        price_amount: 65.0,
        rating: 4.9,
        reviews_count: 2310,
        duration: '3-4 Hours',
        wiki_url: 'https://en.wikipedia.org/wiki/Santorini',
        point: { lat: 36.4618, lon: 25.3753 },
        created_at: '2026-01-15T08:00:00.000Z',
        updated_at: '2026-01-15T08:00:00.000Z'
    }
];
// Pre-seeded Testimonials matching schema
const SEED_TESTIMONIALS = [
    {
        id: 'tm-seed-1',
        destination_name: 'Rome',
        author_name: 'Mike Taylor',
        author_location: 'Lahore, Pakistan',
        role_title: 'Verified Traveler',
        quote: 'Jadoo made our dream vacation to Rome and Santorini an effortless reality. From seamless flight bookings to curated local hidden gems, every detail was executed with perfection!',
        rating: 5.0,
        avatar_url: './assets/testimonials-avatar-1.png',
        trip_tag: 'Italy & Greece Tour',
        created_at: '2026-02-10T14:30:00.000Z',
        updated_at: '2026-02-10T14:30:00.000Z'
    },
    {
        id: 'tm-seed-2',
        destination_name: 'London',
        author_name: 'Chris Thomas',
        author_location: 'London, UK',
        role_title: 'CEO of Red Button',
        quote: 'Exceptional service and unmatched attention to detail. Organizing high-profile executive retreats across Europe has never been smoother. Jadoo is our trusted travel partner.',
        rating: 5.0,
        avatar_url: './assets/testimonials-avatar-2.png',
        trip_tag: 'European Executive Retreat',
        created_at: '2026-02-14T09:15:00.000Z',
        updated_at: '2026-02-14T09:15:00.000Z'
    },
    {
        id: 'tm-seed-3',
        destination_name: 'Paris',
        author_name: 'Sophia Martinez',
        author_location: 'Barcelona, Spain',
        role_title: 'Travel Photographer',
        quote: 'The customized itinerary and 24/7 concierge support blew me away. I captured breathtaking sunrises in Tuscany and Swiss alpine peaks without worrying about logistics. Truly world-class!',
        rating: 4.9,
        avatar_url: './assets/testimonials-avatar-3.png',
        trip_tag: 'Swiss & Tuscany Discovery',
        created_at: '2026-02-18T18:45:00.000Z',
        updated_at: '2026-02-18T18:45:00.000Z'
    }
];
// Pre-seeded Bookings matching schema
const SEED_BOOKINGS = [
    {
        id: 'BK-92841',
        destination_name: 'Rome',
        attraction_name: 'Colosseum & Ancient Forum',
        user_name: 'Alex Johnson',
        user_email: 'alex.traveler@example.com',
        phone_number: '+1 (555) 234-5678',
        travel_date: '2026-11-15',
        guests_count: 2,
        package_type: 'VIP',
        price_per_person: 68.75,
        total_price: 137.5,
        special_request: 'Morning slot requested with English-speaking archaeologist guide.',
        status: 'confirmed',
        created_at: '2026-02-01T10:00:00.000Z',
        updated_at: '2026-02-01T10:00:00.000Z',
        image_url: './assets/destination-rome.png'
    },
    {
        id: 'BK-58203',
        destination_name: 'London',
        attraction_name: 'Tower of London & Crown Jewels',
        user_name: 'Alex Johnson',
        user_email: 'alex.traveler@example.com',
        phone_number: '+1 (555) 234-5678',
        travel_date: '2026-12-04',
        guests_count: 1,
        package_type: 'standard',
        price_per_person: 42.0,
        total_price: 42.0,
        special_request: 'Wheelchair-friendly ramp access info please.',
        status: 'pending',
        created_at: '2026-02-12T16:20:00.000Z',
        updated_at: '2026-02-12T16:20:00.000Z',
        image_url: './assets/destination-london.jpeg'
    }
];
// ==========================================
// DATABASE ENGINE IMPLEMENTATION
// ==========================================
class JadooDatabase {
    constructor() {
        this.init();
    }
    init() {
        try {
            const isInitialized = localStorage.getItem(DB_STORAGE_KEYS.INITIALIZED);
            if (!isInitialized) {
                // Initialize default seeds
                this.setList(DB_STORAGE_KEYS.DESTINATIONS, SEED_DESTINATIONS);
                this.setList(DB_STORAGE_KEYS.ATTRACTIONS, SEED_ATTRACTIONS);
                this.setList(DB_STORAGE_KEYS.TESTIMONIALS, SEED_TESTIMONIALS);
                // Preserve existing legacy bookings if present, otherwise seed
                const existingLegacyBookings = localStorage.getItem('jadoo_bookings');
                if (existingLegacyBookings) {
                    try {
                        const parsed = JSON.parse(existingLegacyBookings);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const converted = parsed.map((b) => ({
                                id: b.id || generateUUID(),
                                destination_name: b.destination || 'Rome',
                                attraction_name: b.placeName || b.destination || 'Tour',
                                user_name: b.userName || 'Traveler',
                                user_email: b.userEmail || 'traveler@example.com',
                                phone_number: b.phone || '',
                                travel_date: b.travelDate || new Date().toISOString().split('T')[0],
                                guests_count: Number(b.guests) || 1,
                                package_type: (b.packageType && b.packageType.toLowerCase().includes('vip') ? 'VIP' : b.packageType && b.packageType.toLowerCase().includes('luxury') ? 'luxury' : 'standard'),
                                price_per_person: Number(b.pricePerPerson) || 55,
                                total_price: Number(b.totalPrice) || 55,
                                special_request: b.specialRequests || '',
                                status: (b.status ? b.status.toLowerCase() : 'confirmed'),
                                created_at: b.createdAt || new Date().toISOString(),
                                updated_at: b.createdAt || new Date().toISOString(),
                                image_url: b.image || './assets/destination-rome.png'
                            }));
                            this.setList(DB_STORAGE_KEYS.BOOKINGS, converted);
                        }
                        else {
                            this.setList(DB_STORAGE_KEYS.BOOKINGS, SEED_BOOKINGS);
                        }
                    }
                    catch {
                        this.setList(DB_STORAGE_KEYS.BOOKINGS, SEED_BOOKINGS);
                    }
                }
                else {
                    this.setList(DB_STORAGE_KEYS.BOOKINGS, SEED_BOOKINGS);
                }
                localStorage.setItem(DB_STORAGE_KEYS.INITIALIZED, 'true');
            }
        }
        catch (e) {
            console.warn('JadooDatabase init error:', e);
        }
    }
    getList(key, fallback = []) {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                return JSON.parse(data);
            }
        }
        catch (e) {
            console.error(`Error reading key ${key}:`, e);
        }
        return fallback;
    }
    setList(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key } }));
        }
        catch (e) {
            console.error(`Error writing key ${key}:`, e);
        }
    }
    // ── DESTINATIONS ─────────────────────────────
    getDestinations() {
        return this.getList(DB_STORAGE_KEYS.DESTINATIONS, SEED_DESTINATIONS);
    }
    getDestination(name) {
        const list = this.getDestinations();
        const search = name.trim().toLowerCase();
        return list.find(d => d.name.toLowerCase() === search || `${d.name}, ${d.country}`.toLowerCase() === search);
    }
    // ── ATTRACTIONS ──────────────────────────────
    getAttractions(destinationName, category) {
        let list = this.getList(DB_STORAGE_KEYS.ATTRACTIONS, SEED_ATTRACTIONS);
        if (destinationName) {
            const destLower = destinationName.trim().toLowerCase();
            list = list.filter(a => a.destination_name.toLowerCase().includes(destLower) || destLower.includes(a.destination_name.toLowerCase()));
        }
        if (category && category !== 'All') {
            list = list.filter(a => a.category.toLowerCase() === category.toLowerCase());
        }
        return list;
    }
    getAttraction(name) {
        const list = this.getList(DB_STORAGE_KEYS.ATTRACTIONS, SEED_ATTRACTIONS);
        return list.find(a => a.name.toLowerCase() === name.trim().toLowerCase());
    }
    addAttraction(attraction) {
        const list = this.getAttractions();
        const existingIdx = list.findIndex(a => a.name.toLowerCase() === attraction.name.toLowerCase());
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...attraction, updated_at: new Date().toISOString() };
        }
        else {
            list.unshift(attraction);
        }
        this.setList(DB_STORAGE_KEYS.ATTRACTIONS, list);
    }
    // ── BOOKINGS ─────────────────────────────────
    getBookings(statusFilter) {
        const list = this.getList(DB_STORAGE_KEYS.BOOKINGS, SEED_BOOKINGS);
        if (!statusFilter || statusFilter === 'all')
            return list;
        return list.filter(b => b.status === statusFilter);
    }
    getUserBookings(emailOrId, statusFilter) {
        let list = this.getBookings(statusFilter);
        if (emailOrId) {
            const query = emailOrId.trim().toLowerCase();
            list = list.filter(b => b.user_email.toLowerCase() === query || b.user_name.toLowerCase() === query);
        }
        return list;
    }
    createBooking(bookingData) {
        const list = this.getBookings();
        const id = 'BK-' + Math.floor(10000 + Math.random() * 90000);
        const now = new Date().toISOString();
        const newBooking = {
            ...bookingData,
            id,
            created_at: now,
            updated_at: now
        };
        list.unshift(newBooking);
        this.setList(DB_STORAGE_KEYS.BOOKINGS, list);
        // Also keep legacy storage key synchronized for backwards compatibility
        try {
            const legacyList = list.map(b => ({
                id: b.id,
                destination: b.destination_name,
                placeName: b.attraction_name,
                userName: b.user_name,
                userEmail: b.user_email,
                phone: b.phone_number,
                travelDate: b.travel_date,
                guests: b.guests_count,
                packageType: b.package_type,
                pricePerPerson: b.price_per_person,
                totalPrice: b.total_price,
                specialRequests: b.special_request,
                status: b.status === 'confirmed' ? 'Confirmed' : b.status === 'pending' ? 'Pending' : 'Cancelled',
                createdAt: b.created_at,
                image: b.image_url
            }));
            localStorage.setItem('jadoo_bookings', JSON.stringify(legacyList));
        }
        catch { }
        return newBooking;
    }
    updateBookingStatus(id, status) {
        const list = this.getBookings();
        const booking = list.find(b => b.id === id);
        if (booking) {
            booking.status = status;
            booking.updated_at = new Date().toISOString();
            this.setList(DB_STORAGE_KEYS.BOOKINGS, list);
            return true;
        }
        return false;
    }
    cancelBooking(id) {
        return this.updateBookingStatus(id, 'cancelled');
    }
    // ── TESTIMONIALS ─────────────────────────────
    getTestimonials() {
        return this.getList(DB_STORAGE_KEYS.TESTIMONIALS, SEED_TESTIMONIALS);
    }
    addTestimonial(data) {
        const list = this.getTestimonials();
        const id = generateUUID();
        const now = new Date().toISOString();
        const newTestimonial = {
            ...data,
            id,
            created_at: now,
            updated_at: now
        };
        list.unshift(newTestimonial);
        this.setList(DB_STORAGE_KEYS.TESTIMONIALS, list);
        return newTestimonial;
    }
    // ── USERS & PROFILE ──────────────────────────
    getUsers() {
        return this.getList(DB_STORAGE_KEYS.USERS, []);
    }
    getCurrentUser() {
        try {
            // Respect explicit user logout
            if (typeof localStorage !== 'undefined' && localStorage.getItem('jadoo_logged_out') === 'true') {
                return null;
            }
            let raw = typeof localStorage !== 'undefined' ? localStorage.getItem('jadoo_current_user') : null;
            // Fallback 1: check cookies
            if (!raw && typeof document !== 'undefined') {
                const match = document.cookie.match(/(?:^|; )jadoo_current_user=([^;]*)/);
                if (match) {
                    try {
                        raw = decodeURIComponent(match[1]);
                    }
                    catch (_) {
                        raw = match[1];
                    }
                }
            }
            // Fallback 2: check last remembered account
            if (!raw && typeof localStorage !== 'undefined') {
                raw = localStorage.getItem('jadoo_last_account');
            }
            const isComponent = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
            const defaultAvatar = isComponent ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png';
            if (raw) {
                let legacy;
                try {
                    legacy = typeof raw === 'object' ? raw : JSON.parse(raw);
                }
                catch (_) {
                    legacy = null;
                }
                if (legacy && (legacy.fullName || legacy.full_name || legacy.email || legacy.id)) {
                    const fullName = legacy.fullName || legacy.full_name || 'Traveler';
                    let avatar = legacy.avatar_url || legacy.avatarUrl || defaultAvatar;
                    if (isComponent && avatar.startsWith('./assets/')) {
                        avatar = '.' + avatar;
                    }
                    else if (!isComponent && avatar.startsWith('../assets/')) {
                        avatar = avatar.replace(/^\.\.\//, './');
                    }
                    return {
                        id: legacy.id || generateUUID(),
                        full_name: fullName,
                        email: legacy.email || 'traveler@example.com',
                        phone: legacy.phone || '+1 (555) 234-5678',
                        avatar_url: avatar,
                        created_at: legacy.createdAt || legacy.created_at || new Date().toISOString(),
                        logged_in_at: legacy.loggedInAt || legacy.logged_in_at || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };
                }
            }
            // Default logged-in traveler profile (Alex Johnson) so user profile always has an active traveler session
            // return {
            //     id: 'user_alex_johnson',
            //     full_name: 'Alex Johnson',
            //     email: 'alex.traveler@example.com',
            //     phone: '+1 (555) 234-5678',
            //     avatar_url: defaultAvatar,
            //     created_at: '2026-01-15T08:00:00.000Z',
            //     logged_in_at: new Date().toISOString(),
            //     updated_at: new Date().toISOString()
            // };
        }
        catch { }
        return null;
    }
    setCurrentUser(user) {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('jadoo_logged_out');
        }
        const full_name = user.full_name || user.fullName || 'Traveler';
        const isComponent = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
        const defaultAvatar = isComponent ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png';
        const avatar = user.avatar_url || defaultAvatar;
        const dbUser = {
            id: user.id || generateUUID(),
            full_name,
            email: user.email,
            phone: user.phone || '',
            avatar_url: avatar,
            created_at: new Date().toISOString(),
            logged_in_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const payload = JSON.stringify({
            id: dbUser.id,
            fullName: dbUser.full_name,
            full_name: dbUser.full_name,
            email: dbUser.email,
            phone: dbUser.phone,
            avatar_url: dbUser.avatar_url,
            createdAt: dbUser.created_at,
            loggedInAt: dbUser.logged_in_at
        });
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('jadoo_current_user', payload);
        }
        if (typeof document !== 'undefined') {
            document.cookie = `jadoo_current_user=${encodeURIComponent(payload)}; path=/; max-age=31536000; SameSite=Lax`;
        }
        window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_current_user' } }));
        return dbUser;
    }
    logout() {
        try {
            const current = this.getCurrentUser();
            if (current && typeof localStorage !== 'undefined') {
                localStorage.setItem('jadoo_last_account', JSON.stringify({
                    id: current.id,
                    email: current.email,
                    fullName: current.full_name
                }));
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('jadoo_logged_out', 'true');
                localStorage.setItem('jadoo_sync_event', Date.now().toString());
                localStorage.removeItem('jadoo_current_user');
            }
            if (typeof document !== 'undefined') {
                document.cookie = 'jadoo_current_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            }
            window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: false } }));
            window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_current_user', type: 'logout' } }));
        }
        catch (_) { }
    }
    updateProfile(updated) {
        const current = this.getCurrentUser();
        if (!current)
            return null;
        const merged = {
            ...current,
            ...updated,
            updated_at: new Date().toISOString()
        };
        localStorage.setItem('jadoo_current_user', JSON.stringify({
            id: merged.id,
            fullName: merged.full_name,
            email: merged.email,
            phone: merged.phone,
            avatar_url: merged.avatar_url,
            createdAt: merged.created_at,
            loggedInAt: merged.logged_in_at
        }));
        window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_current_user' } }));
        return merged;
    }
}
// Global Singleton Instance
export const JadooDB = new JadooDatabase();
if (typeof window !== 'undefined') {
    window.JadooDB = JadooDB;
}
