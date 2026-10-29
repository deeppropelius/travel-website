
interface User {
    id: string;
    fullName: string;
    email: string;
    password?: string;
    createdAt?: string;
    loggedInAt?: string;
}

interface AuthResponse {
    success: boolean;
    message: string;
    user?: User;
}

interface Booking {
    id: string;
    userId?: string;
    userEmail: string;
    userName: string;
    phone?: string;
    destination: string;
    placeName: string;
    image?: string;
    travelDate: string;
    guests: number;
    packageType: string;
    pricePerPerson: number;
    totalPrice: number;
    specialRequests?: string;
    status: 'Confirmed' | 'Completed' | 'Cancelled';
    createdAt: string;
}

interface IJadooBooking {
    getAllBookings(): Booking[];
    getUserBookings(emailOrId?: string): Booking[];
    createBooking(booking: Omit<Booking, 'id' | 'createdAt' | 'status'>): Booking;
    cancelBooking(id: string): boolean;
    count(emailOrId?: string): number;
}

interface IJadooUI {
    openBookingModal(details: { placeName: string; destination: string; price: number | string; image?: string }): void;
    closeBookingModal(): void;
    openMyBookingsModal(): void;
    closeMyBookingsModal(): void;
    openPlaceModal?(place: any): void;
    updateNavbar(): void;
}

interface IJadooStorage {
    get<T = unknown>(key: string, defaultValue?: T | null): T | null;
    set(key: string, value: unknown): boolean;
    remove(key: string): boolean;
    clear(): boolean;
}

interface IJadooAuth {
    getUsers(): User[];
    getCurrentUser(): User | null;
    isAuthenticated(): boolean;
    signUp(fullName: string, email: string, password: string): Promise<AuthResponse>;
    signIn(identifier: string, password: string): Promise<AuthResponse>;
    createSession(user: User): User;
    logout(): void;
}

interface Window {
    JadooStorage?: IJadooStorage;
    JadooAuth?: IJadooAuth;
    JadooBooking?: IJadooBooking;
    JadooUI?: IJadooUI;
}

(function (): void {
    'use strict';

    // ==========================================
    // 1. COOKIE STORAGE SERVICE
    // ==========================================
    const CookieStorage = {
        set(name: string, value: unknown, days = 365): void {
            try {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                const expires = "; expires=" + date.toUTCString();
                document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(JSON.stringify(value)) + expires + "; path=/; SameSite=Lax";
            } catch (e) {
                console.warn('CookieStorage set error:', e);
            }
        },

        get<T = unknown>(name: string): T | null {
            try {
                const nameEQ = encodeURIComponent(name) + "=";
                const ca = document.cookie.split(';');
                for (let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                    if (c.indexOf(nameEQ) === 0) {
                        const rawVal = decodeURIComponent(c.substring(nameEQ.length, c.length));
                        return JSON.parse(rawVal) as T;
                    }
                }
            } catch (e) {
                console.warn('CookieStorage get error:', e);
            }
            return null;
        },

        remove(name: string): void {
            try {
                document.cookie = encodeURIComponent(name) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
            } catch (e) {
                console.warn('CookieStorage remove error:', e);
            }
        }
    };

    function getApiBase(): string {
        if (typeof window !== 'undefined' && window.location) {
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port;

            // If served as a file:// URL, backend is always on localhost:3000
            if (protocol === 'file:') return 'http://localhost:3000';

            // If already on port 3000 (Express serves HTML directly), use same origin
            if (port === '3000') return window.location.origin;

            // Any other port means a static dev server (Live Server 5500-5510, Vite 5173, etc.)
            // Backend is always on port 3000 of the same hostname
            if (port && port !== '' && port !== '80' && port !== '443') {
                return `http://${hostname}:3000`;
            }

            // Standard HTTP/HTTPS (production or reverse-proxy) — use origin
            if (protocol === 'http:' || protocol === 'https:') {
                return window.location.origin;
            }
        }
        return 'http://localhost:3000';
    }

    const API_BASE = getApiBase();

    function getStoredAuthToken(): string | null {
        if (typeof localStorage !== 'undefined') {
            const token = localStorage.getItem('jadoo_auth_token');
            if (token) return token;
        }
        if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|; )jadoo_auth_token=([^;]*)/);
            if (match) {
                try { return decodeURIComponent(match[1]); } catch (_) { return match[1]; }
            }
        }
        return null;
    }

    // Storage Keys Constants
    const STORAGE_KEYS = {
        USERS: 'jadoo_users',
        CURRENT_USER: 'jadoo_current_user',
        LAST_ACCOUNT: 'jadoo_last_account',
        BOOKINGS: 'jadoo_bookings',
        LANGUAGE: 'jadoo_selected_language',
        DRAFTS: 'jadoo_form_drafts',
        THEME: 'jadoo_dark_theme',
        DESTINATIONS: 'jadoo_destinations_cache'
    } as const;

    const Storage: IJadooStorage = {
        get<T = unknown>(key: string, defaultValue: T | null = null): T | null {
            try {
                // 1. Read from LocalStorage
                const localItem = localStorage.getItem(key);
                if (localItem !== null) {
                    const parsed = JSON.parse(localItem) as T;
                    CookieStorage.set(key, parsed);
                    return parsed;
                }

                // 2. Fallback to Cookie backup if LocalStorage was empty
                const cookieItem = CookieStorage.get<T>(key);
                if (cookieItem !== null) {
                    localStorage.setItem(key, JSON.stringify(cookieItem));
                    return cookieItem;
                }

                return defaultValue;
            } catch (error) {
                console.error(`Storage read error for "${key}":`, error);
                return defaultValue;
            }
        },

        set(key: string, value: unknown): boolean {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                CookieStorage.set(key, value);
                return true;
            } catch (error) {
                console.error(`Storage write error for "${key}":`, error);
                return false;
            }
        },

        remove(key: string): boolean {
            try {
                localStorage.removeItem(key);
                CookieStorage.remove(key);
                return true;
            } catch (error) {
                console.error(`Storage remove error for "${key}":`, error);
                return false;
            }
        },

        clear(): boolean {
            try {
                localStorage.clear();
                CookieStorage.remove(STORAGE_KEYS.USERS);
                CookieStorage.remove(STORAGE_KEYS.CURRENT_USER);
                CookieStorage.remove(STORAGE_KEYS.LAST_ACCOUNT);
                CookieStorage.remove(STORAGE_KEYS.BOOKINGS);
                CookieStorage.remove(STORAGE_KEYS.LANGUAGE);
                CookieStorage.remove(STORAGE_KEYS.DRAFTS);
                CookieStorage.remove(STORAGE_KEYS.THEME);
                return true;
            } catch (error) {
                console.error('Storage clear error:', error);
                return false;
            }
        }
    };

    const AuthService: IJadooAuth = {
        getUsers(): User[] {
            return Storage.get<User[]>(STORAGE_KEYS.USERS, []) ?? [];
        },

        getCurrentUser(): User | null {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('jadoo_logged_out') === 'true') {
                return null;
            }
            let user = Storage.get<User>(STORAGE_KEYS.CURRENT_USER, null);
            if (!user && typeof document !== 'undefined') {
                const match = document.cookie.match(/(?:^|; )jadoo_current_user=([^;]*)/);
                if (match) {
                    try {
                        const parsed = JSON.parse(decodeURIComponent(match[1]));
                        if (parsed && (parsed.email || parsed.fullName || parsed.full_name)) {
                            user = {
                                id: parsed.id,
                                fullName: parsed.fullName || parsed.full_name,
                                email: parsed.email,
                                password: '',
                                createdAt: parsed.createdAt || new Date().toISOString()
                            };
                        }
                    } catch {}
                }
            }
            return user;
        },

        isAuthenticated(): boolean {
            return this.getCurrentUser() !== null;
        },

        async signUp(fullName: string, email: string, password: string): Promise<AuthResponse> {
            const cleanName = (fullName || '').trim();
            const cleanEmail = (email || '').trim().toLowerCase();

            if (!cleanName || !cleanEmail || !password) {
                return { success: false, message: 'Please fill out all fields.' };
            }

            // Always register directly in PostgreSQL backend first
            try {
                const res = await fetch(`${API_BASE}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_name: cleanName,
                        email: cleanEmail,
                        password: password
                    })
                });

                if (res.status === 409) {
                    return { success: false, message: 'An account with this email already exists in PostgreSQL. Please log in.' };
                }

                if (res.ok) {
                    const saved = await res.json();
                    const newUser: User = {
                        id: saved.id, // Real PostgreSQL UUID
                        fullName: saved.full_name || cleanName,
                        email: saved.email || cleanEmail,
                        password: '',
                        createdAt: saved.created_at || new Date().toISOString()
                    };
                    (newUser as any).token = saved.token;

                    const users = this.getUsers().filter(u => u.email !== cleanEmail);
                    users.push(newUser);
                    Storage.set(STORAGE_KEYS.USERS, users);

                    this.createSession(newUser);

                    try {
                        if (typeof (window as any).JadooDB !== 'undefined') {
                            (window as any).JadooDB.setCurrentUser({
                                id: saved.id,
                                full_name: newUser.fullName,
                                email: newUser.email,
                                token: saved.token
                            });
                        }
                    } catch (_) {}

                    return { success: true, message: 'Account created successfully in PostgreSQL!', user: newUser };
                } else {
                    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
                    return { success: false, message: err.error || 'Registration failed' };
                }
            } catch (networkErr) {
                console.warn('Backend register failed, falling back to offline storage:', networkErr);
                const users = this.getUsers();
                if (users.find(u => u.email === cleanEmail)) {
                    return { success: false, message: 'An account with this email already exists.' };
                }
                const fallbackUser: User = {
                    id: 'user_' + Date.now(),
                    fullName: cleanName,
                    email: cleanEmail,
                    password: password,
                    createdAt: new Date().toISOString()
                };
                users.push(fallbackUser);
                Storage.set(STORAGE_KEYS.USERS, users);
                this.createSession(fallbackUser);
                return { success: true, message: 'Account created in offline mode.', user: fallbackUser };
            }
        },

        async signIn(identifier: string, password: string): Promise<AuthResponse> {
            const cleanId = (identifier || '').trim().toLowerCase();

            if (!cleanId || !password) {
                return { success: false, message: 'Please enter your email and password.' };
            }

            // Always authenticate with PostgreSQL backend first
            try {
                const res = await fetch(`${API_BASE}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanId, password })
                });

                if (res.ok) {
                    const dbUser = await res.json();
                    if (dbUser && dbUser.id) {
                        const loggedIn: User = {
                            id: dbUser.id, // Real PostgreSQL UUID
                            fullName: dbUser.full_name || 'Traveler',
                            email: dbUser.email,
                            password: '',
                            createdAt: dbUser.created_at || new Date().toISOString()
                        };
                        (loggedIn as any).token = dbUser.token;

                        // Clean out any stale local dummy users
                        const users = this.getUsers().filter(u => u.email !== loggedIn.email);
                        users.push(loggedIn);
                        Storage.set(STORAGE_KEYS.USERS, users);

                        this.createSession(loggedIn);

                        try {
                            if (typeof (window as any).JadooDB !== 'undefined') {
                                (window as any).JadooDB.setCurrentUser({
                                    id: dbUser.id,
                                    full_name: dbUser.full_name,
                                    email: dbUser.email,
                                    token: dbUser.token
                                });
                            }
                        } catch (_) {}

                        window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: true, user: loggedIn } }));
                        return { success: true, message: 'Logged in successfully via PostgreSQL!', user: loggedIn };
                    }
                } else if (res.status === 401) {
                    return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
                }
            } catch (networkErr) {
                console.warn('Backend login unreachable, falling back to local session:', networkErr);
            }

            // Local fallback only if backend was unreachable
            const users = this.getUsers();
            const localUser = users.find(
                u => (u.email === cleanId || u.id === cleanId || ((u.fullName || (u as any).full_name || '').toLowerCase() === cleanId)) && u.password === password
            );

            if (localUser) {
                this.createSession(localUser);
                return { success: true, message: 'Logged in from local session cache.', user: localUser };
            }

            return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
        },

        createSession(user: User): User {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('jadoo_logged_out');
                if ((user as any).token) {
                    localStorage.setItem('jadoo_auth_token', (user as any).token);
                    document.cookie = `jadoo_auth_token=${encodeURIComponent((user as any).token)}; path=/; max-age=604800; SameSite=Lax`;
                }
            }
            const sessionUser: any = {
                id: user.id,
                fullName: user.fullName,
                full_name: user.fullName,
                email: user.email,
                avatar_url: (user as any).avatar_url || './assets/testimonials-avatar-1.png',
                token: (user as any).token || (typeof localStorage !== 'undefined' ? localStorage.getItem('jadoo_auth_token') : null),
                loggedInAt: new Date().toISOString()
            };
            Storage.set(STORAGE_KEYS.CURRENT_USER, sessionUser);
            try {
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { type: 'auth', user: sessionUser } }));
                window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: true, user: sessionUser } }));
            } catch (_) {}
            return sessionUser;
        },

        logout(): void {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('jadoo_logged_out', 'true');
                localStorage.setItem('jadoo_sync_event', Date.now().toString());
                localStorage.removeItem('jadoo_auth_token');
                document.cookie = 'jadoo_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            }
            const current = this.getCurrentUser();
            if (current) {
                Storage.set(STORAGE_KEYS.LAST_ACCOUNT, {
                    id: current.id,
                    email: current.email,
                    fullName: current.fullName
                });
            }
            Storage.remove(STORAGE_KEYS.CURRENT_USER);
            CookieStorage.remove(STORAGE_KEYS.CURRENT_USER);

            try {
                if (typeof (window as any).JadooDB !== 'undefined') {
                    (window as any).JadooDB.logout();
                }
            } catch (_) {}

            updateNavbarAuthState();
            try {
                window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: false } }));
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { type: 'logout' } }));
            } catch (_) {}
        }
    };

    const BookingService: IJadooBooking = {
        getAllBookings(): Booking[] {
            try {
                return Storage.get<Booking[]>(STORAGE_KEYS.BOOKINGS, []) ?? [];
            } catch {
                return [];
            }
        },

        getUserBookings(emailOrId?: string): Booking[] {
            const all = this.getAllBookings();
            if (!emailOrId) {
                const user = AuthService.getCurrentUser();
                if (user) {
                    const uEmail = (user.email || '').toLowerCase().trim();
                    const uId = String(user.id || '').toLowerCase().trim();
                    return all.filter(b => {
                        const bEmail = (b.userEmail || (b as any).user_email || (b as any).email || '').toLowerCase().trim();
                        const bId = String(b.userId || (b as any).user_id || (b as any).customer_id || (b as any).id || '').toLowerCase().trim();
                        return (uEmail && bEmail === uEmail) || (uId && bId === uId);
                    });
                }
                return all;
            }
            const clean = (emailOrId || '').toLowerCase().trim();
            return all.filter(b => {
                const bEmail = (b.userEmail || (b as any).user_email || (b as any).email || '').toLowerCase().trim();
                const bId = String(b.userId || (b as any).user_id || (b as any).customer_id || (b as any).id || '').toLowerCase().trim();
                return (bEmail && bEmail === clean) || (bId && bId === clean);
            });
        },

        createBooking(data: Omit<Booking, 'id' | 'createdAt' | 'status'>): Booking {
            const bookings = this.getAllBookings();
            const tempId = 'BK-' + Math.floor(100000 + Math.random() * 900000);
            const newBooking: Booking = {
                ...data,
                id: tempId,
                status: 'Confirmed',
                createdAt: new Date().toISOString()
            };
            bookings.unshift(newBooking);
            Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
            try { updateNavbarAuthState(); } catch (_) {}
            window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_bookings' } }));

            // Save directly into PostgreSQL via Express API
            try {
                const token = getStoredAuthToken();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                fetch(`${API_BASE}/api/bookings`, {
                    method: 'POST',
                    headers,
                    credentials: 'include',
                    body: JSON.stringify({
                        booking_ref: newBooking.id,
                        user_name: data.userName,
                        user_email: data.userEmail,
                        phone_number: data.phone,
                        destination_name: data.destination,
                        attraction_name: data.placeName,
                        travel_date: data.travelDate,
                        guests_count: data.guests,
                        package_type: data.packageType,
                        price_per_person: data.pricePerPerson,
                        total_price: data.totalPrice,
                        special_request: data.specialRequests,
                        status: 'confirmed',
                        image_url: data.image
                    })
                }).then(async r => {
                    if (r.ok) {
                        const saved = await r.json();
                        console.log('✅ Booking successfully stored in PostgreSQL:', saved);
                    } else {
                        console.error('Failed to store booking in PostgreSQL:', r.statusText);
                    }
                }).catch(err => {
                    console.error('Error saving booking to PostgreSQL:', err);
                });
            } catch (e) {
                console.error(e);
            }

            return newBooking;
        },

        cancelBooking(id: string): boolean {
            const bookings = this.getAllBookings();
            const target = bookings.find(b => b.id === id || (b as any).booking_ref === id || (b as any).bookingRef === id);
            if (target) {
                target.status = 'Cancelled';
                (target as any).status = 'cancelled';
                Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
                try { updateNavbarAuthState(); } catch (_) {}
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_bookings' } }));

                // Sync cancellation to PostgreSQL
                try {
                    const token = getStoredAuthToken();
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    fetch(`${API_BASE}/api/bookings/${encodeURIComponent(id)}/status`, {
                        method: 'PATCH',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify({ status: 'cancelled' })
                    }).catch(console.error);
                } catch (_) {}

                return true;
            }
            return false;
        },

        count(emailOrId?: string): number {
            return this.getUserBookings(emailOrId).filter(b => {
                const s = (b.status || '').toLowerCase();
                return s === 'confirmed';
            }).length;
        }
    };

    window.JadooStorage = Storage;
    window.JadooAuth = AuthService;
    window.JadooBooking = BookingService;

    document.addEventListener('DOMContentLoaded', () => {

        // --- A. Scroll Reveal Engine (run early so all sections animate and appear immediately) ---
        try {
            initScrollReveal();
        } catch (e) {
            console.error('initScrollReveal error:', e);
        }

        // --- B. Mobile Drawer Navigation ---
        try {
            const hamburger = document.getElementById('hamburger-btn');
            const navMenu = document.getElementById('navitems');
            const navLinks = document.querySelectorAll<HTMLElement>('.navlink, .navitems .signup');

            if (hamburger && navMenu) {
                hamburger.onclick = (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const willBeActive = !navMenu.classList.contains('active');
                    hamburger.classList.toggle('active', willBeActive);
                    navMenu.classList.toggle('active', willBeActive);
                    hamburger.setAttribute('aria-expanded', willBeActive ? 'true' : 'false');
                };

                navLinks.forEach((link: HTMLElement) => {
                    link.addEventListener('click', () => {
                        hamburger.classList.remove('active');
                        navMenu.classList.remove('active');
                        hamburger.setAttribute('aria-expanded', 'false');
                    });
                });

                if (!(window as any)._scriptHamburgerDocClick) {
                    (window as any)._scriptHamburgerDocClick = true;
                    document.addEventListener('click', (e: MouseEvent) => {
                        const target = e.target as Node | null;
                        if (target && !navMenu.contains(target) && !hamburger.contains(target) && navMenu.classList.contains('active')) {
                            hamburger.classList.remove('active');
                            navMenu.classList.remove('active');
                            hamburger.setAttribute('aria-expanded', 'false');
                        }
                    });
                }
            }

            // Direct Sign Up navigation listener
            const navSignupBtns = document.querySelectorAll<HTMLElement>('#nav-signup-btn, .navitems button.signup, .navitems .signup');
            navSignupBtns.forEach((btn: HTMLElement) => {
                if (!(btn as any)._scriptNavSignupBound) {
                    (btn as any)._scriptNavSignupBound = true;
                    btn.addEventListener('click', (e: MouseEvent) => {
                        const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
                        const target = isComp ? './auth.html#signup' : './components/auth.html#signup';
                        if (!window.location.href.includes('auth.html#signup')) {
                            window.location.href = target;
                        }
                    });
                }
            });
        } catch (e) {
            console.error('Drawer init error:', e);
        }

        // --- C. Language Preference Persistence ---
        try {
            const langSelect = document.getElementById('lang') as HTMLSelectElement | null;
            if (langSelect) {
                const savedLang = Storage.get<string>(STORAGE_KEYS.LANGUAGE);
                if (savedLang) {
                    langSelect.value = savedLang;
                }

                langSelect.addEventListener('change', (e: Event) => {
                    const target = e.target as HTMLSelectElement | null;
                    if (target) {
                        Storage.set(STORAGE_KEYS.LANGUAGE, target.value);
                    }
                });
            }
        } catch (e) {
            console.error('Language select init error:', e);
        }

        // --- D. Update Navbar for Logged-In User ---
        try {
            updateNavbarAuthState();
        } catch (e) {
            console.error('updateNavbarAuthState error:', e);
        }

        // --- E. Form Handlers & Input Auto-Save/Restore ---
        try { initAuthForms(); } catch (e) { console.error('initAuthForms error:', e); }
        try { restoreFormDrafts(); } catch (e) { console.error('restoreFormDrafts error:', e); }

        // --- F. Newsletter Subscription & Demo Player ---
        try { initNewsletter(); } catch (e) { console.error('initNewsletter error:', e); }
        try { initDemoPlayer(); } catch (e) { console.error('initDemoPlayer error:', e); }

        // --- G. Trip Booking System & Homepage Card Triggers ---
        try { initBookingSystem(); } catch (e) { console.error('initBookingSystem error:', e); }
        try { initHomepageBookingTriggers(); } catch (e) { console.error('initHomepageBookingTriggers error:', e); }
    });

    let activeBookingDetails = {
        placeName: 'Colosseum & Historic Walking Tour',
        destination: 'Rome, Italy',
        pricePerPerson: 55,
        image: './assets/destination-rome.png'
    };

    function parseNumericPrice(val: number | string | undefined | null): number {
        if (typeof val === 'number') return isNaN(val) ? 55 : val;
        if (!val) return 55;
        const str = val.toString().trim();
        if (str.toLowerCase().includes('k')) {
            const clean = str.replace(/[^\d.]/g, '');
            const parsed = parseFloat(clean);
            return isNaN(parsed) ? 55 : Math.round(parsed * 1000);
        }
        const clean = str.replace(/[^\d.]/g, '');
        const parsed = parseFloat(clean);
        return isNaN(parsed) ? 55 : parsed;
    }

    function formatDateDisplay(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (_) {
            return dateStr;
        }
    }

    // Update navbar with user greeting, profile icon, and dropdown
    function updateNavbarAuthState(): void {
        const currentUser = AuthService.getCurrentUser();
        const bookingCount = BookingService.count(currentUser ? currentUser.email : undefined);

        // 1. Homepage Navbar (#navitems ul)
        const loginLi = document.getElementById('nav-login-li');
        const signupLi = document.getElementById('nav-signup-li');
        const userLi = document.getElementById('nav-user-li');
        const firstNameDisplay = document.getElementById('userFirstNameDisplay');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');
        const navBookingBadge = document.getElementById('navBookingBadge');

        // 2. Destination Page Navbar (.nav-actions)
        const destLoginBtn = document.getElementById('destinationNavLoginBtn');
        const destUserDropdown = document.getElementById('destUserProfileDropdown');
        const destFirstNameDisplay = document.getElementById('destUserFirstNameDisplay');
        const destDropdownUserName = document.getElementById('destDropdownUserName');
        const destDropdownUserEmail = document.getElementById('destDropdownUserEmail');
        const destBookingBadge = document.getElementById('destNavBookingBadge');

        const isAuthenticated = Boolean(currentUser);

        if (isAuthenticated && currentUser) {
            document.documentElement.classList.add('user-logged-in');
            if (document.body) document.body.classList.add('user-logged-in');
            const fullName = currentUser.fullName || 'Traveler';
            const userEmail = currentUser.email || '';
            const firstName = fullName.split(' ')[0] || 'Traveler';

            // Index Navbar
            if (loginLi) loginLi.style.setProperty('display', 'none', 'important');
            if (signupLi) signupLi.style.setProperty('display', 'none', 'important');
            if (userLi) userLi.style.setProperty('display', 'flex', 'important');
            if (firstNameDisplay) firstNameDisplay.textContent = firstName;
            if (dropdownUserName) dropdownUserName.textContent = fullName;
            if (dropdownUserEmail) dropdownUserEmail.textContent = userEmail;
            
            const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
            const avatarSrc = (currentUser as any).avatar_url || (isComp ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png');
            const navAvatarImg = document.getElementById('navUserAvatarImg') as HTMLImageElement | null;
            if (navAvatarImg) {
                navAvatarImg.src = avatarSrc;
                navAvatarImg.style.display = 'block';
            }
            const dropdownAvatarImgs = document.querySelectorAll<HTMLImageElement>('#dropdownUserAvatarImg, #destDropdownUserAvatarImg, .dropdown-avatar-circle img');
            dropdownAvatarImgs.forEach((img) => {
                img.src = avatarSrc;
                img.style.display = 'block';
                if (img.nextElementSibling) {
                    (img.nextElementSibling as HTMLElement).style.display = 'none';
                }
            });
            if (navBookingBadge) {
                navBookingBadge.textContent = bookingCount.toString();
                navBookingBadge.style.display = bookingCount > 0 ? 'inline-block' : 'none';
            }

            // Destination Navbar
            if (destLoginBtn) destLoginBtn.style.setProperty('display', 'none', 'important');
            if (destUserDropdown) destUserDropdown.style.setProperty('display', 'inline-block', 'important');
            if (destFirstNameDisplay) destFirstNameDisplay.textContent = firstName;
            if (destDropdownUserName) destDropdownUserName.textContent = fullName;
            if (destDropdownUserEmail) destDropdownUserEmail.textContent = userEmail;
            if (destBookingBadge) {
                destBookingBadge.textContent = bookingCount.toString();
                destBookingBadge.style.display = bookingCount > 0 ? 'inline-block' : 'none';
            }
        } else {
            // Logged Out
            document.documentElement.classList.remove('user-logged-in');
            if (document.body) document.body.classList.remove('user-logged-in');

            if (loginLi) loginLi.style.display = '';
            if (signupLi) signupLi.style.display = '';
            if (userLi) {
                userLi.style.setProperty('display', 'none', 'important');
            }

            if (destLoginBtn) destLoginBtn.style.display = '';
            if (destUserDropdown) {
                destUserDropdown.style.setProperty('display', 'none', 'important');
            }
            if (firstNameDisplay) firstNameDisplay.textContent = '';
            if (dropdownUserName) dropdownUserName.textContent = '';
            if (dropdownUserEmail) dropdownUserEmail.textContent = '';
        }

        bindNavbarEvents();
    }

    let navbarBound = false;
    function bindNavbarEvents(): void {
        if (navbarBound) return;
        navbarBound = true;

        const userProfileBtn = document.getElementById('userProfileBtn');
        const userProfileDropdown = document.getElementById('userProfileDropdown');
        const destUserProfileBtn = document.getElementById('destUserProfileBtn');
        const destUserProfileDropdown = document.getElementById('destUserProfileDropdown');

        if (typeof (window as any).toggleUserNavDropdown !== 'function') {
            (window as any).toggleUserNavDropdown = (e?: Event) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof (e as any).stopImmediatePropagation === 'function') {
                        (e as any).stopImmediatePropagation();
                    }
                }
                const dropdown = document.getElementById('userProfileDropdown') || document.getElementById('destUserProfileDropdown');
                const btn = document.getElementById('userProfileBtn') || document.getElementById('destUserProfileBtn');
                if (!dropdown) return;
                const isOpen = dropdown.classList.toggle('open');
                btn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            };
        }

        if (userProfileBtn) {
            userProfileBtn.onclick = (e) => (window as any).toggleUserNavDropdown(e);
        }
        if (destUserProfileBtn) {
            destUserProfileBtn.onclick = (e) => (window as any).toggleUserNavDropdown(e);
        }

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            const target = e.target as Node | null;
            const dropdown = document.getElementById('userProfileDropdown') || document.getElementById('destUserProfileDropdown');
            const btn = document.getElementById('userProfileBtn') || document.getElementById('destUserProfileBtn');
            if (dropdown && dropdown.classList.contains('open')) {
                if (target && !dropdown.contains(target)) {
                    dropdown.classList.remove('open');
                    btn?.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const dropdown = document.getElementById('userProfileDropdown') || document.getElementById('destUserProfileDropdown');
                const btn = document.getElementById('userProfileBtn') || document.getElementById('destUserProfileBtn');
                dropdown?.classList.remove('open');
                btn?.setAttribute('aria-expanded', 'false');
            }
        });

        // My Bookings click
        const myBookingsBtn = document.getElementById('navMyBookingsBtn');
        const destMyBookingsBtn = document.getElementById('destNavMyBookingsBtn');

        const handleOpenMyBookings = (e: Event) => {
            e.preventDefault();
            userProfileDropdown?.classList.remove('open');
            destUserProfileDropdown?.classList.remove('open');
            openMyBookingsModal();
        };

        myBookingsBtn?.addEventListener('click', handleOpenMyBookings);
        destMyBookingsBtn?.addEventListener('click', handleOpenMyBookings);

        // Logout click with instant sync and redirect if on private page
        const logoutBtns = document.querySelectorAll('.dropdown-logout-btn, #navLogoutBtn, #destNavLogoutBtn');
        const handleLogout = (e: Event) => {
            e.preventDefault();
            userProfileDropdown?.classList.remove('open');
            destUserProfileDropdown?.classList.remove('open');
            userProfileBtn?.setAttribute('aria-expanded', 'false');
            destUserProfileBtn?.setAttribute('aria-expanded', 'false');

            AuthService.logout();

            const isProtectedPage = window.location.pathname.includes('profile.html') || window.location.pathname.includes('ticket.html');
            if (isProtectedPage) {
                const homeUrl = window.location.pathname.includes('/components/') ? '../index.html' : './index.html';
                window.location.href = homeUrl;
            } else {
                if (typeof (window as any).JadooToast !== 'undefined') {
                    (window as any).JadooToast.show('Logged Out', 'You have been successfully logged out.', 'info');
                }
            }
        };

        if (typeof (window as any).handleLogoutAction !== 'function') {
            (window as any).handleLogoutAction = handleLogout;
        }

        logoutBtns.forEach(btn => {
            (btn as HTMLElement).onclick = (e) => {
                if (typeof (window as any).handleLogoutAction === 'function') {
                    (window as any).handleLogoutAction(e);
                } else {
                    handleLogout(e);
                }
            };
        });

        // Cross-tab and global synchronization
        if (!(window as any)._jadooGlobalAuthSyncBound) {
            (window as any)._jadooGlobalAuthSyncBound = true;
            window.addEventListener('storage', (e) => {
                if (!e.key || e.key.includes('user') || e.key.includes('logout') || e.key.includes('account') || e.key === 'jadoo_sync_event') {
                    updateNavbarAuthState();
                    const isProtected = window.location.pathname.includes('profile.html') || window.location.pathname.includes('ticket.html');
                    if (isProtected && localStorage.getItem('jadoo_logged_out') === 'true') {
                        const homeUrl = window.location.pathname.includes('/components/') ? '../index.html' : './index.html';
                        window.location.href = homeUrl;
                    }
                }
            });
            window.addEventListener('jadoo:auth_change', () => updateNavbarAuthState());
            window.addEventListener('jadoo:db_change', () => updateNavbarAuthState());
        }

        // Navbar Bookings trigger link
        const navBookingsTrigger = document.getElementById('navBookingsTrigger');
        navBookingsTrigger?.addEventListener('click', (e) => {
            const isDestPage = window.location.pathname.toLowerCase().includes('destination-page');
            const currentUser = AuthService.getCurrentUser();
            if (isDestPage && currentUser) {
                e.preventDefault();
                openMyBookingsModal();
            }
        });
    }

    // Modal & Booking Functions
    function openBookingModal(details: { placeName: string; destination: string; price: number | string; image?: string }): void {
        const currentUser = AuthService.getCurrentUser();
        if (!currentUser) {
            const isComponent = window.location.pathname.toLowerCase().includes('components');
            const authUrl = isComponent ? 'auth.html#signin' : 'components/auth.html#signin';
            const proceed = confirm('You must be logged in to book a trip or ticket.\n\nClick OK to Sign In or Create an Account.');
            if (proceed) {
                window.location.href = authUrl;
            }
            return;
        }

        const modal = document.getElementById('bookingModalOverlay');
        if (!modal) return;

        const isComponent = window.location.pathname.toLowerCase().includes('components');
        const fallbackImg = isComponent ? '../assets/destination-rome.png' : './assets/destination-rome.png';

        activeBookingDetails = {
            placeName: details.placeName || 'Iconic Sightseeing Tour',
            destination: details.destination || 'Top Destination',
            pricePerPerson: parseNumericPrice(details.price),
            image: details.image || fallbackImg
        };

        // Populate Preview
        const previewImg = document.getElementById('bookingPreviewImg') as HTMLImageElement | null;
        const previewDest = document.getElementById('bookingPreviewDestination');
        const previewTitle = document.getElementById('bookingPreviewTitle');
        const previewRate = document.getElementById('bookingPreviewRate');

        if (previewImg) previewImg.src = activeBookingDetails.image;
        if (previewDest) previewDest.textContent = activeBookingDetails.destination;
        if (previewTitle) previewTitle.textContent = activeBookingDetails.placeName;
        if (previewRate) previewRate.textContent = `$${activeBookingDetails.pricePerPerson.toFixed(0)}`;

        // Populate Form Fields
        const fullNameInput = document.getElementById('bookingFullName') as HTMLInputElement | null;
        const emailInput = document.getElementById('bookingEmail') as HTMLInputElement | null;
        const dateInput = document.getElementById('bookingDate') as HTMLInputElement | null;
        const guestsInput = document.getElementById('bookingGuests') as HTMLInputElement | null;
        const packageSelect = document.getElementById('bookingPackage') as HTMLSelectElement | null;
        const requestsInput = document.getElementById('bookingRequests') as HTMLTextAreaElement | null;

        if (fullNameInput && currentUser?.fullName) {
            fullNameInput.value = currentUser.fullName;
        }
        if (emailInput && currentUser?.email) {
            emailInput.value = currentUser.email;
        }

        // Set date constraints: min today, default tomorrow
        if (dateInput) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            dateInput.min = today.toISOString().split('T')[0];
            if (!dateInput.value) {
                dateInput.value = tomorrow.toISOString().split('T')[0];
            }
        }

        if (guestsInput) guestsInput.value = '1';
        if (packageSelect) packageSelect.value = 'Standard';
        if (requestsInput) requestsInput.value = '';

        // Reset views
        const formContent = document.getElementById('bookingFormContent');
        const successView = document.getElementById('bookingSuccessView');
        if (formContent) formContent.style.display = 'block';
        if (successView) successView.style.display = 'none';

        // Clear error messages
        document.querySelectorAll('.booking-field-error').forEach(el => el.classList.remove('visible'));

        updateBookingPriceCalculation();

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeBookingModal(): void {
        const modal = document.getElementById('bookingModalOverlay');
        if (!modal) return;
        if (typeof document !== 'undefined' && document.activeElement && modal.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function updateBookingPriceCalculation(): number {
        const guestsInput = document.getElementById('bookingGuests') as HTMLInputElement | null;
        const packageSelect = document.getElementById('bookingPackage') as HTMLSelectElement | null;
        const guests = Math.max(1, parseInt(guestsInput?.value || '1', 10));

        let multiplier = 1.0;
        let tierLabel = '';
        if (packageSelect) {
            const selectedOpt = packageSelect.options[packageSelect.selectedIndex];
            multiplier = parseFloat(selectedOpt?.getAttribute('data-multiplier') || '1.0');
            tierLabel = packageSelect.value;
        }

        const basePrice = activeBookingDetails.pricePerPerson;
        const subtotal = basePrice * guests;
        const total = subtotal * multiplier;
        const tierDifference = total - subtotal;

        const summaryGuests = document.getElementById('summaryGuests');
        const summaryBasePrice = document.getElementById('summaryBasePrice');
        const summarySubtotal = document.getElementById('summarySubtotal');
        const summaryTierRow = document.getElementById('summaryTierRow');
        const summaryTierLabel = document.getElementById('summaryTierLabel');
        const summaryTierAmount = document.getElementById('summaryTierAmount');
        const totalAmountEl = document.getElementById('bookingTotalAmount');

        if (summaryGuests) summaryGuests.textContent = guests.toString();
        if (summaryBasePrice) summaryBasePrice.textContent = `$${basePrice.toFixed(0)}`;
        if (summarySubtotal) summarySubtotal.textContent = `$${subtotal.toFixed(2)}`;

        if (summaryTierRow) {
            if (multiplier > 1.0) {
                summaryTierRow.style.display = 'flex';
                if (summaryTierLabel) summaryTierLabel.textContent = `${tierLabel} Upgrade:`;
                if (summaryTierAmount) summaryTierAmount.textContent = `+$${tierDifference.toFixed(2)}`;
            } else {
                summaryTierRow.style.display = 'none';
            }
        }

        if (totalAmountEl) totalAmountEl.textContent = `$${total.toFixed(2)}`;
        return total;
    }

    function openMyBookingsModal(): void {
        const modal = document.getElementById('myBookingsModalOverlay');
        const list = document.getElementById('myBookingsList');
        if (!modal || !list) return;

        const currentUser = AuthService.getCurrentUser();
        const bookings = BookingService.getUserBookings(currentUser ? currentUser.email : undefined);

        const isComponent = window.location.pathname.toLowerCase().includes('components');
        const fallbackImg = isComponent ? '../assets/destination-rome.png' : './assets/destination-rome.png';
        const exploreLink = isComponent ? 'destination-page.html' : 'components/destination-page.html';

        if (bookings.length === 0) {
            list.innerHTML = `
                <div class="bookings-empty-state">
                    <div class="empty-icon-wrap">
                        <i class="fa-solid fa-plane-circle-exclamation"></i>
                    </div>
                    <h3>No Bookings Yet</h3>
                    <p>You don't have any booked trips right now. Explore top worldwide destinations and plan your next journey!</p>
                    <a href="${exploreLink}" class="btn-empty-explore" id="emptyExploreBtn">
                        <i class="fa-solid fa-compass"></i>
                        <span>Explore Destinations</span>
                    </a>
                </div>
            `;
            const exploreBtn = document.getElementById('emptyExploreBtn');
            exploreBtn?.addEventListener('click', () => {
                closeMyBookingsModal();
            });
        } else {
            list.innerHTML = bookings.map(b => {
                const item = b as any;
                const price = parseFloat(item.totalPrice || item.total_price || item.price || '0') || 0;
                const place = item.placeName || item.place_name || item.attraction_name || item.destination_name || 'Sightseeing Tour';
                const dest = item.destination || item.destination_name || '';
                const travelDate = item.travelDate || item.travel_date || item.created_at;
                const guests = item.guests || item.guests_count || 1;
                const img = item.image || item.image_url || fallbackImg;
                const status = item.status || 'confirmed';
                const pkg = item.packageType || item.package_type || 'Standard';

                return `
                <div class="booking-item-card" data-id="${b.id}">
                    <div class="booking-item-img">
                        <img src="${img}" alt="${place}" onerror="this.src='${fallbackImg}'">
                        <span class="booking-status-tag"><i class="fa-solid fa-circle-check"></i> ${status}</span>
                    </div>
                    <div class="booking-item-info">
                        <div class="booking-ref-row">
                            <span class="booking-ref-badge">${b.id}</span>
                            <span class="booking-package-badge">${pkg}</span>
                        </div>
                        <h3 class="booking-place-title">${place}</h3>
                        <p class="booking-destination-meta"><i class="fa-solid fa-location-dot"></i> ${dest}</p>
                        <div class="booking-meta-row">
                            <span><i class="fa-regular fa-calendar"></i> ${formatDateDisplay(travelDate)}</span>
                            <span><i class="fa-solid fa-user-group"></i> ${guests} ${guests > 1 ? 'Guests' : 'Guest'}</span>
                            <span class="booking-price-highlight">${price.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="booking-item-actions">
                        <a href="${isComponent ? 'ticket.html' : 'components/ticket.html'}?id=${b.id}" class="btn-print-ticket btn-view-ticket" style="text-decoration: none;" title="Open Boarding Pass">
                            <i class="fa-solid fa-ticket"></i>
                            <span>E-Ticket</span>
                        </a>
                        <button type="button" class="btn-cancel-trip" data-cancel-id="${b.id}" title="Cancel this booking">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Cancel</span>
                        </button>
                    </div>
                </div>
            `;
            }).join('');

            // Attach cancel event handlers
            list.querySelectorAll<HTMLButtonElement>('[data-cancel-id]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const bookingId = btn.getAttribute('data-cancel-id');
                    if (!bookingId) return;
                    const confirmCancel = confirm(`Are you sure you want to cancel booking ${bookingId}?`);
                    if (confirmCancel) {
                        BookingService.cancelBooking(bookingId);
                        openMyBookingsModal();
                    }
                });
            });
        }

        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeMyBookingsModal(): void {
        const modal = document.getElementById('myBookingsModalOverlay');
        if (!modal) return;
        if (typeof document !== 'undefined' && document.activeElement && modal.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    let bookingSystemInitialized = false;
    function initBookingSystem(): void {
        if (bookingSystemInitialized) return;
        bookingSystemInitialized = true;

        const bookingModal = document.getElementById('bookingModalOverlay');
        const bookingClose = document.getElementById('bookingModalClose');
        const bookingCancel = document.getElementById('bookingCancelBtn');
        const bookingBackdrop = document.getElementById('bookingModalBackdrop');
        const tripBookingForm = document.getElementById('tripBookingForm') as HTMLFormElement | null;

        const myBookingsModal = document.getElementById('myBookingsModalOverlay');
        const myBookingsClose = document.getElementById('myBookingsClose');
        const myBookingsBackdrop = document.getElementById('myBookingsBackdrop');

        // Close handlers for Booking Modal
        bookingClose?.addEventListener('click', closeBookingModal);
        bookingCancel?.addEventListener('click', closeBookingModal);
        bookingBackdrop?.addEventListener('click', closeBookingModal);

        // Close handlers for My Bookings Modal
        myBookingsClose?.addEventListener('click', closeMyBookingsModal);
        myBookingsBackdrop?.addEventListener('click', closeMyBookingsModal);

        // Escape key closes modals
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (bookingModal?.classList.contains('active')) closeBookingModal();
                if (myBookingsModal?.classList.contains('active')) closeMyBookingsModal();
            }
        });

        // Stepper buttons for guests
        const guestsInput = document.getElementById('bookingGuests') as HTMLInputElement | null;
        const minusBtn = document.getElementById('stepperMinusBtn');
        const plusBtn = document.getElementById('stepperPlusBtn');
        const packageSelect = document.getElementById('bookingPackage') as HTMLSelectElement | null;

        minusBtn?.addEventListener('click', () => {
            if (!guestsInput) return;
            const current = parseInt(guestsInput.value || '1', 10);
            if (current > 1) {
                guestsInput.value = (current - 1).toString();
                updateBookingPriceCalculation();
            }
        });

        plusBtn?.addEventListener('click', () => {
            if (!guestsInput) return;
            const current = parseInt(guestsInput.value || '1', 10);
            if (current < 15) {
                guestsInput.value = (current + 1).toString();
                updateBookingPriceCalculation();
            }
        });

        packageSelect?.addEventListener('change', () => {
            updateBookingPriceCalculation();
        });

        // Booking Form Submission
        tripBookingForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            const currentUser = AuthService.getCurrentUser();
            if (!currentUser) {
                alert('You must be logged in to book a trip.');
                const isComponent = window.location.pathname.toLowerCase().includes('components');
                window.location.href = isComponent ? 'auth.html#signin' : 'components/auth.html#signin';
                return;
            }

            const fullNameInput = document.getElementById('bookingFullName') as HTMLInputElement | null;
            const emailInput = document.getElementById('bookingEmail') as HTMLInputElement | null;
            const phoneInput = document.getElementById('bookingPhone') as HTMLInputElement | null;
            const dateInput = document.getElementById('bookingDate') as HTMLInputElement | null;
            const requestsInput = document.getElementById('bookingRequests') as HTMLTextAreaElement | null;

            const nameVal = fullNameInput?.value.trim() || '';
            const emailVal = emailInput?.value.trim() || '';
            const dateVal = dateInput?.value || '';

            let isValid = true;
            const nameError = document.getElementById('bookingFullNameError');
            const emailError = document.getElementById('bookingEmailError');
            const dateError = document.getElementById('bookingDateError');

            if (!nameVal) {
                if (nameError) nameError.classList.add('visible');
                isValid = false;
            } else {
                if (nameError) nameError.classList.remove('visible');
            }

            if (!emailVal || !emailVal.includes('@')) {
                if (emailError) emailError.classList.add('visible');
                isValid = false;
            } else {
                if (emailError) emailError.classList.remove('visible');
            }

            if (!dateVal) {
                if (dateError) dateError.classList.add('visible');
                isValid = false;
            } else {
                if (dateError) dateError.classList.remove('visible');
            }

            if (!isValid) return;

            const guests = parseInt(guestsInput?.value || '1', 10);
            const packageVal = packageSelect?.value || 'Standard';
            const total = updateBookingPriceCalculation();

            const newBooking = BookingService.createBooking({
                userId: currentUser?.id,
                userEmail: emailVal,
                userName: nameVal,
                phone: phoneInput?.value.trim() || '',
                destination: activeBookingDetails.destination,
                placeName: activeBookingDetails.placeName,
                image: activeBookingDetails.image,
                travelDate: dateVal,
                guests: guests,
                packageType: packageVal,
                pricePerPerson: activeBookingDetails.pricePerPerson,
                totalPrice: total,
                specialRequests: requestsInput?.value.trim() || ''
            });

            // Display Success Receipt View
            const formContent = document.getElementById('bookingFormContent');
            const successView = document.getElementById('bookingSuccessView');
            const successBookingId = document.getElementById('successBookingId');
            const successDestination = document.getElementById('successDestination');
            const successTripTitle = document.getElementById('successTripTitle');
            const successDate = document.getElementById('successDate');
            const successGuests = document.getElementById('successGuests');
            const successPackage = document.getElementById('successPackage');
            const successTotal = document.getElementById('successTotal');

            if (successBookingId) successBookingId.textContent = `#${newBooking.id}`;
            if (successDestination) successDestination.textContent = newBooking.destination;
            if (successTripTitle) successTripTitle.textContent = newBooking.placeName;
            if (successDate) successDate.textContent = formatDateDisplay(newBooking.travelDate);
            if (successGuests) successGuests.textContent = `${newBooking.guests} ${newBooking.guests > 1 ? 'Guests' : 'Guest'}`;
            if (successPackage) successPackage.textContent = newBooking.packageType;
            if (successTotal) successTotal.textContent = `$${newBooking.totalPrice.toFixed(2)}`;

            if (formContent) formContent.style.display = 'none';
            if (successView) successView.style.display = 'block';

            // Wire success view buttons
            const viewBookingsBtn = document.getElementById('successViewBookingsBtn');
            const doneBtn = document.getElementById('successDoneBtn');

            viewBookingsBtn?.addEventListener('click', () => {
                viewBookingsBtn.blur();
                closeBookingModal();
                openMyBookingsModal();
            }, { once: true });

            doneBtn?.addEventListener('click', () => {
                doneBtn.blur();
                closeBookingModal();
            }, { once: true });
        });
    }

    interface DestinationCardMeta {
        cityKey: string;
        placeName: string;
        destination: string;
        price: number;
        priceFormatted: string;
        image: string;
        badge: string;
        rating: number;
        reviews: number;
        duration: string;
        description: string;
        url?: string;
    }

    // Default cached destinations saved immediately from the start
    const DEFAULT_CACHED_DESTINATIONS: DestinationCardMeta[] = [
        {
            cityKey: 'Rome',
            placeName: 'Colosseum & Ancient Rome Walking Tour',
            destination: 'Rome, Italy',
            price: 54,
            priceFormatted: '$5.42k',
            image: './assets/destination-rome.png',
            badge: 'Bestseller',
            rating: 4.9,
            reviews: 2840,
            duration: '10 Days Trip',
            description: 'Walk through history at the iconic Flavian Amphitheatre, explore the Roman Forum, and wander historic cobbled piazzas.',
            url: 'https://en.wikipedia.org/wiki/Colosseum'
        },
        {
            cityKey: 'London',
            placeName: 'Big Ben & River Thames Royal Cruise',
            destination: 'London, UK',
            price: 42,
            priceFormatted: '$4.2k',
            image: './assets/destination-london.jpeg',
            badge: 'Popular',
            rating: 4.8,
            reviews: 3120,
            duration: '12 Days Trip',
            description: 'Experience iconic Westminster, majestic royal palaces, scenic river cruises, and vibrant West End theatre culture.',
            url: 'https://en.wikipedia.org/wiki/Big_Ben'
        },
        {
            cityKey: 'Paris',
            placeName: 'Eiffel Tower & Louvre Grand Tour',
            destination: 'Paris, France',
            price: 58,
            priceFormatted: '$5.8k',
            image: './assets/destination-europe.png',
            badge: 'Trending',
            rating: 4.9,
            reviews: 3450,
            duration: '8 Days Trip',
            description: 'Grand tour of Paris spanning the Eiffel Tower, the Louvre Museum, and romantic Seine river cruises.',
            url: 'https://en.wikipedia.org/wiki/Eiffel_Tower'
        },
        {
            cityKey: 'Santorini',
            placeName: 'Aegean Coastal Sunset & Caldera Tour',
            destination: 'Santorini, Greece',
            price: 68,
            priceFormatted: '$6.8k',
            image: './assets/easy-fast-trip-to-greece.jpeg',
            badge: 'Hot Deal',
            rating: 4.9,
            reviews: 2410,
            duration: '14 Days Trip',
            description: 'Dazzling whitewashed cliffside villages, world-famous Oia sunsets, volcanic beaches, and private catamaran cruises.',
            url: 'https://en.wikipedia.org/wiki/Santorini'
        },
        {
            cityKey: 'Venice',
            placeName: 'Venice Gondola & Grand Canal Tour',
            destination: 'Venice, Italy',
            price: 48,
            priceFormatted: '$4.85k',
            image: './assets/destination-rome.png',
            badge: 'Romantic',
            rating: 4.7,
            reviews: 1680,
            duration: '8 Days Trip',
            description: 'Glide along historic canals in handcrafted gondolas, tour Renaissance art galleries, and historic Venetian bridges.',
            url: 'https://en.wikipedia.org/wiki/Venice'
        },
        {
            cityKey: 'Tokyo',
            placeName: 'Tokyo Shinjuku & Historic Asakusa Tour',
            destination: 'Tokyo, Japan',
            price: 51,
            priceFormatted: '$5.1k',
            image: './assets/destination-london.jpeg',
            badge: 'Adventure',
            rating: 4.9,
            reviews: 2190,
            duration: '11 Days Trip',
            description: 'Futuristic neon skyline views, ancient Asakusa shrines, vibrant Shibuya crossing, and majestic Mount Fuji views.',
            url: 'https://en.wikipedia.org/wiki/Tokyo'
        }
    ];

    function getOrInitSavedDestinations(): DestinationCardMeta[] {
        let saved = Storage.get<DestinationCardMeta[]>(STORAGE_KEYS.DESTINATIONS, null);
        if (!saved || !Array.isArray(saved) || saved.length === 0) {
            saved = DEFAULT_CACHED_DESTINATIONS;
            Storage.set(STORAGE_KEYS.DESTINATIONS, saved);
        }
        return saved;
    }

    let destinationCardsData: DestinationCardMeta[] = getOrInitSavedDestinations();
    let currentActivePlaceModal: DestinationCardMeta | null = null;

    function openPlaceModal(place: DestinationCardMeta): void {
        const modalOverlay = document.getElementById("place-modal-overlay");
        const modalBgCover = document.getElementById("modal-bg-cover");
        const modalBadge = document.getElementById("modal-badge");
        const modalRating = document.getElementById("modal-rating");
        const modalReviews = document.getElementById("modal-reviews");
        const modalTitle = document.getElementById("modal-title");
        const modalDestName = document.getElementById("modal-destination-name");
        const modalDescription = document.getElementById("modal-description");
        const modalDuration = document.getElementById("modal-duration");
        const modalPrice = document.getElementById("modal-price");
        const modalWikiLink = document.getElementById("modal-wiki-link") as HTMLAnchorElement | null;

        if (!modalOverlay) return;
        currentActivePlaceModal = place;

        if (modalBgCover) {
            modalBgCover.style.backgroundImage = `url("${place.image}")`;
        }
        if (modalBadge) modalBadge.textContent = place.badge || "Featured Landmark";
        if (modalRating) modalRating.textContent = place.rating.toFixed(1);
        if (modalReviews) modalReviews.textContent = `(${place.reviews.toLocaleString()} reviews)`;
        if (modalTitle) modalTitle.textContent = place.placeName;
        if (modalDestName) modalDestName.textContent = place.destination;
        if (modalDescription) modalDescription.textContent = place.description;
        if (modalDuration) modalDuration.textContent = place.duration;
        if (modalPrice) modalPrice.textContent = place.priceFormatted;

        if (modalWikiLink) {
            if (place.url) {
                modalWikiLink.href = place.url;
                modalWikiLink.style.display = "inline-flex";
            } else {
                modalWikiLink.style.display = "none";
            }
        }

        modalOverlay.classList.add("active");
        modalOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closePlaceModal(): void {
        const modalOverlay = document.getElementById("place-modal-overlay");
        if (!modalOverlay) return;
        if (typeof document !== 'undefined' && document.activeElement && modalOverlay.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
        modalOverlay.classList.remove("active");
        modalOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function bindDestinationCardEvents(cards: DestinationCardMeta[]): void {
        const carouselCards = document.querySelectorAll<HTMLElement>('#carouselTrack .tcard');

        carouselCards.forEach((card, idx) => {
            const meta = cards[idx] || destinationCardsData[idx];
            if (!meta) return;

            // Details button click -> open Place Details Modal
            const viewBtn = card.querySelector<HTMLElement>('.place-view-btn');
            if (viewBtn) {
                const newViewBtn = viewBtn.cloneNode(true) as HTMLElement;
                viewBtn.parentNode?.replaceChild(newViewBtn, viewBtn);
                newViewBtn.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();
                    openPlaceModal(meta);
                });
            }

            // Book button click -> open Booking Form Modal
            const bookBtn = card.querySelector<HTMLElement>('.place-book-btn');
            if (bookBtn) {
                const newBookBtn = bookBtn.cloneNode(true) as HTMLElement;
                bookBtn.parentNode?.replaceChild(newBookBtn, bookBtn);
                newBookBtn.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();
                    openBookingModal({
                        placeName: meta.placeName,
                        destination: meta.destination,
                        price: meta.price,
                        image: meta.image
                    });
                });
            }

            // Clicking card opens Place Details Modal
            card.onclick = (e: MouseEvent) => {
                const carousel = document.getElementById('destCarousel');
                if (carousel?.classList.contains('is-dragging')) return;
                if ((e.target as HTMLElement).closest('.place-book-btn') || (e.target as HTMLElement).closest('.place-view-btn')) {
                    return;
                }
                openPlaceModal(meta);
            };
        });
    }

    function renderDestinationCardsDOM(cards: DestinationCardMeta[]): void {
        const carouselCards = document.querySelectorAll<HTMLElement>('#carouselTrack .tcard');
        carouselCards.forEach((card, idx) => {
            const meta = cards[idx];
            if (!meta) return;

            card.setAttribute('data-destination', meta.destination);

            const img = card.querySelector<HTMLImageElement>('.place-img');
            if (img && meta.image) {
                img.src = meta.image;
                img.alt = meta.placeName;
                img.onerror = () => {
                    img.onerror = null;
                    img.src = DEFAULT_CACHED_DESTINATIONS[idx]?.image || './assets/destination-rome.png';
                };
            }

            const badgeEl = card.querySelector<HTMLElement>('.place-badge');
            if (badgeEl) badgeEl.textContent = meta.badge;

            const ratingEl = card.querySelector<HTMLElement>('.place-rating');
            if (ratingEl) ratingEl.innerHTML = `<i class="fa-solid fa-star"></i> ${meta.rating.toFixed(1)}`;

            const reviewsEl = card.querySelector<HTMLElement>('.place-reviews');
            if (reviewsEl) reviewsEl.textContent = `(${meta.reviews.toLocaleString()} reviews)`;

            const durationEl = card.querySelector<HTMLElement>('.place-duration');
            if (durationEl) durationEl.textContent = `• ${meta.duration}`;

            const titleEl = card.querySelector<HTMLElement>('.place-title');
            if (titleEl) titleEl.textContent = meta.destination;

            const descEl = card.querySelector<HTMLElement>('.place-description');
            if (descEl) descEl.textContent = meta.description;

            const priceEl = card.querySelector<HTMLElement>('.place-price');
            if (priceEl) priceEl.textContent = meta.priceFormatted;

            const viewBtn = card.querySelector<HTMLElement>('.place-view-btn');
            if (viewBtn) viewBtn.setAttribute('aria-label', `View details for ${meta.destination}`);

            const bookBtn = card.querySelector<HTMLElement>('.place-book-btn');
            if (bookBtn) bookBtn.setAttribute('aria-label', `Book ${meta.destination}`);
        });

        bindDestinationCardEvents(cards);
    }

    async function fetchAndSyncLiveDestinations(): Promise<void> {
        // Pure client-side synchronization via JadooDB (no localhost or backend server needed)
        try {
            if (typeof window !== 'undefined' && (window as any).JadooDB) {
                const jadooDB = (window as any).JadooDB;
                const dbDestinations = jadooDB.getDestinations();
                let hasUpdates = false;

                if (Array.isArray(dbDestinations) && dbDestinations.length > 0) {
                    destinationCardsData.forEach((card) => {
                        const matchedDest = dbDestinations.find((d: any) => {
                            const dName = (d && d.name) ? String(d.name).toLowerCase() : '';
                            const cDest = card.destination ? String(card.destination).toLowerCase() : '';
                            const cKey = card.cityKey ? String(card.cityKey).toLowerCase() : '';
                            return (dName && cDest && cDest.includes(dName)) || (dName && cKey && dName.includes(cKey));
                        });
                        if (matchedDest) {
                            const attractions = jadooDB.getAttractions(matchedDest.name);
                            if (attractions && attractions.length > 0) {
                                const topAttraction = attractions[0];
                                card.placeName = topAttraction.name || card.placeName;
                                card.destination = `${matchedDest.name}, ${matchedDest.country}`;
                                card.price = topAttraction.price_amount || card.price;
                                card.priceFormatted = `$${card.price}`;
                                card.image = topAttraction.image_url || matchedDest.hero_img || card.image;
                                card.rating = topAttraction.rating || card.rating;
                                card.reviews = topAttraction.reviews_count || card.reviews;
                                card.duration = topAttraction.duration || card.duration;
                                card.description = topAttraction.description || card.description;
                                hasUpdates = true;
                            }
                        }
                    });

                    if (hasUpdates) {
                        Storage.set(STORAGE_KEYS.DESTINATIONS, destinationCardsData);
                        renderDestinationCardsDOM(destinationCardsData);
                    }
                }
            }
        } catch (_) {
            // Silently maintain existing destination cards
        }
    }

    function initHomepageBookingTriggers(): void {
        const modalOverlay = document.getElementById("place-modal-overlay");
        const modalCloseBtn = document.getElementById("modal-close-btn");
        const modalBookCta = document.getElementById("modal-book-cta");

        modalCloseBtn?.addEventListener("click", closePlaceModal);
        modalOverlay?.addEventListener("click", (e: MouseEvent) => {
            if (e.target === modalOverlay || (e.target as HTMLElement).classList.contains("place-modal-backdrop")) {
                closePlaceModal();
            }
        });

        window.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape" && modalOverlay?.classList.contains("active")) {
                closePlaceModal();
            }
        });

        modalBookCta?.addEventListener("click", () => {
            if (currentActivePlaceModal) {
                const place = currentActivePlaceModal;
                closePlaceModal();
                openBookingModal({
                    placeName: place.placeName,
                    destination: place.destination,
                    price: place.price,
                    image: place.image
                });
            }
        });

        // 1. Load saved data from start and render immediately
        destinationCardsData = getOrInitSavedDestinations();
        renderDestinationCardsDOM(destinationCardsData);

        // 2. Fetch fresh live data from API key endpoint asynchronously and update cache
        fetchAndSyncLiveDestinations();

        // Greece Booking Card in 4th section
        const greeceCard = document.querySelector<HTMLElement>('.fcard');
        if (greeceCard) {
            greeceCard.style.cursor = 'pointer';
            greeceCard.title = 'Click to book Trip to Greece';
            greeceCard.addEventListener('click', () => {
                openBookingModal({
                    placeName: 'Aegean Islands & Historic Ruins',
                    destination: 'Trip to Greece',
                    price: 85,
                    image: './assets/easy-fast-trip-to-greece.jpeg'
                });
            });
        }
    }

    window.JadooUI = {
        openBookingModal,
        closeBookingModal,
        openMyBookingsModal,
        closeMyBookingsModal,
        openPlaceModal,
        updateNavbar: updateNavbarAuthState
    };

    // Persist & Restore Non-Sensitive Form Fields (Strictly Excluding Passwords for Security)
    function restoreFormDrafts(): void {
        const drafts = Storage.get<Record<string, string>>(STORAGE_KEYS.DRAFTS, {}) ?? {};

        // Security purge: instantly delete any passwords that were previously leaked in localStorage drafts
        let draftsSanitized = false;
        if (drafts['signup-password'] || drafts['signin-password']) {
            delete drafts['signup-password'];
            delete drafts['signin-password'];
            draftsSanitized = true;
        }
        if (draftsSanitized) {
            Storage.set(STORAGE_KEYS.DRAFTS, drafts);
        }

        // Security purge: ensure no passwords exist in jadoo_users in localStorage
        const cachedUsers = Storage.get<any[]>(STORAGE_KEYS.USERS, []);
        if (Array.isArray(cachedUsers)) {
            let usersSanitized = false;
            cachedUsers.forEach(u => {
                if (u && u.password) {
                    delete u.password;
                    usersSanitized = true;
                }
            });
            if (usersSanitized) {
                Storage.set(STORAGE_KEYS.USERS, cachedUsers);
            }
        }

        // STRICT SECURITY RULE: Only track safe identifiers (Full Name, Email). NEVER passwords!
        const inputsToTrack = [
            'signup-fullname',
            'signup-email',
            'user-id'
        ];

        inputsToTrack.forEach(id => {
            const inputEl = document.getElementById(id) as HTMLInputElement | null;
            if (inputEl) {
                // Restore saved value if available
                if (drafts[id] !== undefined && drafts[id] !== '') {
                    inputEl.value = drafts[id];
                }

                // Auto-save safe non-sensitive fields
                inputEl.addEventListener('input', () => {
                    const currentDrafts = Storage.get<Record<string, string>>(STORAGE_KEYS.DRAFTS, {}) ?? {};
                    currentDrafts[id] = inputEl.value;
                    // Double check password is never written
                    delete currentDrafts['signup-password'];
                    delete currentDrafts['signin-password'];
                    Storage.set(STORAGE_KEYS.DRAFTS, currentDrafts);
                });
            }
        });
    }

    // Bind auth forms & status banner
    function initAuthForms(): void {
        // 0. Sync Auth Status Banner on signin-signup page
        const banner = document.getElementById('authStatusBanner');
        const currentUser = AuthService.getCurrentUser();
        if (banner) {
            if (currentUser) {
                const firstName = currentUser.fullName ? currentUser.fullName.split(' ')[0] : 'User';
                banner.style.display = 'flex';
                banner.innerHTML = `<span>Currently logged in as <strong>${firstName}</strong></span> <a href="../index.html">Homepage</a> • <button type="button" id="bannerLogoutBtn">Logout</button>`;
                const bannerLogoutBtn = document.getElementById('bannerLogoutBtn');
                if (bannerLogoutBtn) {
                    bannerLogoutBtn.addEventListener('click', () => {
                        AuthService.logout();
                        banner.style.display = 'none';
                        alert('You have logged out successfully.');
                        window.location.reload();
                    });
                }
            } else {
                banner.style.display = 'none';
            }
        }

        // Initialize Remembered Account on Sign In form
        initRememberedAccount();

        // 1. Sign Up
        const signupForm = (document.getElementById('signupForm') || document.querySelector('.signup-form form')) as HTMLFormElement | null;
        if (signupForm) {
            signupForm.addEventListener('submit', async (e: Event) => {
                e.preventDefault();
                const nameInput = (document.getElementById('signup-fullname') || signupForm.querySelector('input[type="text"]')) as HTMLInputElement | null;
                const emailInput = (document.getElementById('signup-email') || signupForm.querySelector('input[type="email"]')) as HTMLInputElement | null;
                const passwordInput = (document.getElementById('signup-password') || signupForm.querySelector('input[type="password"]')) as HTMLInputElement | null;
                const submitBtn = signupForm.querySelector<HTMLButtonElement>('button[type="submit"]');

                const name = nameInput ? nameInput.value : '';
                const email = emailInput ? emailInput.value : '';
                const password = passwordInput ? passwordInput.value : '';

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.setAttribute('data-orig-text', submitBtn.textContent || '');
                    submitBtn.textContent = 'Creating Account...';
                }

                try {
                    const result = await AuthService.signUp(name, email, password);
                    if (result.success) {
                        const drafts = Storage.get<Record<string, string>>(STORAGE_KEYS.DRAFTS, {}) ?? {};
                        drafts['user-id'] = email;
                        Storage.set(STORAGE_KEYS.DRAFTS, drafts);

                        alert(`Welcome, ${name}! Your account has been saved in PostgreSQL.`);
                        const isComponent = window.location.pathname.toLowerCase().includes('components');
                        window.location.href = isComponent ? '../index.html' : 'index.html';
                    } else {
                        alert(result.message);
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitBtn.getAttribute('data-orig-text') || 'Sign Up';
                    }
                }
            });
        }

        // 2. Sign In
        const signinForm = (document.getElementById('signinForm') || document.querySelector('.signin-form form')) as HTMLFormElement | null;
        if (signinForm) {
            signinForm.addEventListener('submit', async (e: Event) => {
                e.preventDefault();
                const idInput = (document.getElementById('user-id') || signinForm.querySelector('input[type="text"], input[type="email"]')) as HTMLInputElement | null;
                const passwordInput = (document.getElementById('signin-password') || signinForm.querySelector('input[type="password"]')) as HTMLInputElement | null;
                const submitBtn = signinForm.querySelector<HTMLButtonElement>('button[type="submit"]');

                const identifier = idInput ? idInput.value : '';
                const password = passwordInput ? passwordInput.value : '';

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.setAttribute('data-orig-text', submitBtn.textContent || '');
                    submitBtn.textContent = 'Logging In...';
                }

                try {
                    const result = await AuthService.signIn(identifier, password);
                    if (result.success && result.user) {
                        alert(`Welcome back, ${result.user.fullName}!`);
                        const isComponent = window.location.pathname.toLowerCase().includes('components');
                        window.location.href = isComponent ? '../index.html' : 'index.html';
                    } else {
                        alert(result.message);
                    }
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitBtn.getAttribute('data-orig-text') || 'Login';
                    }
                }
            });
        }
    }

    function initRememberedAccount(): void {
        const promptContainer = document.getElementById('rememberedAccountPrompt');
        const userIdGroup = document.getElementById('userIdGroup');
        const userIdInput = document.getElementById('user-id') as HTMLInputElement | null;
        const passwordInput = document.getElementById('signin-password') as HTMLInputElement | null;
        const signinForm = document.getElementById('signinForm');
        const signinLabel = document.getElementById('signinLabel');
        const submitBtn = document.getElementById('signin-submit-btn');

        if (!promptContainer || !userIdInput || !signinForm) return;

        const currentUser = AuthService.getCurrentUser();
        if (currentUser) {
            promptContainer.style.display = 'none';
            if (userIdGroup) userIdGroup.style.display = '';
            return;
        }

        const lastAccount = Storage.get<{ id: string; email: string; fullName: string }>(STORAGE_KEYS.LAST_ACCOUNT);
        if (!lastAccount || !lastAccount.email) {
            promptContainer.style.display = 'none';
            if (userIdGroup) userIdGroup.style.display = '';
            return;
        }

        const activeAccount = {
            id: lastAccount.id,
            email: lastAccount.email,
            fullName: lastAccount.fullName || 'User'
        };
        const firstName = activeAccount.fullName.split(' ')[0] || 'User';

        function renderRememberedMode(): void {
            if (!promptContainer) return;
            promptContainer.style.display = 'block';
            promptContainer.innerHTML = `
                <div class="remembered-account-card" id="rememberedAccountCard">
                    <div class="remembered-avatar">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="remembered-details">
                        <span class="remembered-name">${activeAccount.fullName}</span>
                        <span class="remembered-email">${activeAccount.email}</span>
                    </div>
                    <button type="button" class="btn-switch-account-link" id="switchRememberedBtn" title="Switch account">
                        Switch
                    </button>
                </div>
            `;

            // Auto-populate hidden ID field
            if (userIdInput) {
                userIdInput.value = activeAccount.email;
                if ((window as any).AuthValidation?.clearError) {
                    (window as any).AuthValidation.clearError(userIdInput);
                }
            }
            if (userIdGroup) {
                userIdGroup.style.display = 'none';
            }
            if (signinLabel) {
                signinLabel.textContent = `Welcome Back`;
            }
            if (passwordInput) {
                passwordInput.placeholder = `Password for ${firstName}`;
                passwordInput.focus();
            }
            if (submitBtn) {
                submitBtn.textContent = `Log In as ${firstName}`;
            }

            // Listener for switching
            const switchBtn = document.getElementById('switchRememberedBtn');
            switchBtn?.addEventListener('click', (e: Event) => {
                e.preventDefault();
                renderManualMode();
            });
        }

        function renderManualMode(): void {
            if (!promptContainer) return;
            promptContainer.style.display = 'block';
            promptContainer.innerHTML = `
                <div class="remembered-switch-banner">
                    <span>Not <strong>${firstName}</strong>?</span>
                    <button type="button" class="btn-restore-account" id="restoreAccountBtn">
                        Sign in as ${firstName}
                    </button>
                </div>
            `;

            if (userIdGroup) {
                userIdGroup.style.display = 'flex';
            }
            if (userIdInput) {
                userIdInput.value = '';
                userIdInput.focus();
            }
            if (signinLabel) {
                signinLabel.textContent = 'Login';
            }
            if (passwordInput) {
                passwordInput.placeholder = 'Password';
            }
            if (submitBtn) {
                submitBtn.textContent = 'Login';
            }

            const restoreBtn = document.getElementById('restoreAccountBtn');
            restoreBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                renderRememberedMode();
            });
        }

        renderRememberedMode();
    }

    function initNewsletter(): void {
        const form = document.getElementById('subscribeForm') as HTMLFormElement | null;
        const emailInput = document.getElementById('subscribeEmail') as HTMLInputElement | null;
        if (!form || !emailInput) return;

        form.addEventListener('submit', (e: Event) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) return;

            const subscribers = Storage.get<string[]>('jadoo_newsletter_subscribers', []) ?? [];
            if (!subscribers.includes(email)) {
                subscribers.push(email);
                Storage.set('jadoo_newsletter_subscribers', subscribers);
            }

            // Sync to PostgreSQL backend
            try {
                fetch(`${API_BASE}/api/newsletter`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                }).catch(() => {});
            } catch (_) {}

            emailInput.value = '';
            alert(`Thank you for subscribing to Jadoo updates! (${email})`);
        });
    }

    function initDemoPlayer(): void {
        const demoBtn = document.getElementById('playDemoBtn');
        if (!demoBtn) return;

        demoBtn.addEventListener('click', () => {
            alert('Jadoo Experience Demo: Explore top destinations, book curated flights & hotels, and manage your travel itineraries in one click!');
        });
    }

    // Scroll Reveal Observer Engine
    function initScrollReveal(): void {
        const revealElements = document.querySelectorAll<HTMLElement>('[data-reveal]');
        if (!revealElements.length) return;

        if (!('IntersectionObserver' in window)) {
            revealElements.forEach(el => el.classList.add('is-revealed'));
            return;
        }

        const observerOptions: IntersectionObserverInit = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    (entry.target as HTMLElement).classList.add('is-revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        revealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
                el.classList.add('is-revealed');
            } else {
                revealObserver.observe(el);
            }
        });

        // Failsafe: reveal any remaining hidden elements automatically
        setTimeout(() => {
            document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-revealed)').forEach(el => {
                el.classList.add('is-revealed');
            });
        }, 1200);
    }

    // Helper to execute when DOM is ready safely
    function onReady(callback: () => void): void {
        if (document.readyState !== 'loading') {
            callback();
        } else {
            document.addEventListener('DOMContentLoaded', callback);
        }
    }

    (function initDarkTheme(): void {
        const html = document.documentElement;
        const DARK_KEY = 'jadoo_dark_theme';

        interface ThemeElements {
            floatingBtn: HTMLElement | null;
            floatingIcon: HTMLElement | null;
            navBtn: HTMLElement | null;
        }

        function getElements(): ThemeElements {
            return {
                floatingBtn: document.getElementById('themeToggle'),
                floatingIcon: document.getElementById('themeIcon'),
                navBtn: document.getElementById('navThemeToggle')
            };
        }

        function applyTheme(isDark: boolean): void {
            if (isDark) {
                html.setAttribute('data-theme', 'dark');
            } else {
                html.removeAttribute('data-theme');
            }

            const els = getElements();

            // 1. Floating Theme Button: update icon & title
            if (els.floatingIcon) {
                els.floatingIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
            }
            if (els.floatingBtn) {
                els.floatingBtn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
                els.floatingBtn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            }

            // 2. Navbar Theme Toggle: update accessibility attributes
            if (els.navBtn) {
                els.navBtn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
                els.navBtn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
                els.navBtn.setAttribute('aria-checked', isDark ? 'true' : 'false');
            }
        }

        // Multi-Layer Theme Resolution (LocalStorage -> Cookie -> OS Preference)
        function resolveInitialTheme(): boolean {
            const saved = Storage.get<boolean | string>(STORAGE_KEYS.THEME, null);
            if (saved !== null) {
                return saved === true || saved === 'true';
            }
            const rawLocal = localStorage.getItem(DARK_KEY);
            if (rawLocal !== null) {
                return rawLocal === 'true';
            }
            const cookieVal = CookieStorage.get<boolean | string>(DARK_KEY);
            if (cookieVal !== null) {
                return cookieVal === true || cookieVal === 'true';
            }
            return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }

        let isDark = resolveInitialTheme();

        // Apply immediately to avoid flash
        applyTheme(isDark);

        onReady(() => {
            applyTheme(isDark);

            function toggleTheme(e?: Event): void {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                if (typeof window !== 'undefined' && (window as any).JadooTheme) {
                    (window as any).JadooTheme.toggle();
                    isDark = (window as any).JadooTheme.isDark();
                    return;
                }

                isDark = !isDark;
                Storage.set(STORAGE_KEYS.THEME, isDark);
                localStorage.setItem(DARK_KEY, isDark.toString());
                CookieStorage.set(DARK_KEY, isDark);
                applyTheme(isDark);

                const els = getElements();
                [els.floatingBtn, els.navBtn].forEach(btn => {
                    if (btn) {
                        btn.style.transform = 'scale(1.15) rotate(25deg)';
                        setTimeout(() => { btn.style.transform = ''; }, 300);
                    }
                });
            }

            const els = getElements();
            if (els.floatingBtn) {
                els.floatingBtn.style.pointerEvents = 'auto';
                els.floatingBtn.onclick = (e) => toggleTheme(e);
            }
            if (els.navBtn) {
                els.navBtn.style.pointerEvents = 'auto';
                els.navBtn.onclick = (e) => toggleTheme(e);
            }

            // Sync with JadooTheme custom event
            window.addEventListener('jadoo:theme_change', (e: any) => {
                if (e.detail && typeof e.detail.isDark === 'boolean') {
                    isDark = e.detail.isDark;
                    applyTheme(isDark);
                }
            });

            // Instant Multi-Tab / Multi-Window Synchronization
            window.addEventListener('storage', (e: StorageEvent) => {
                if (e.key === DARK_KEY || e.key === STORAGE_KEYS.THEME) {
                    let val: unknown = e.newValue;
                    try { val = JSON.parse(e.newValue || ''); } catch (_) { }
                    const newIsDark = val === true || val === 'true';
                    if (newIsDark !== isDark) {
                        isDark = newIsDark;
                        applyTheme(isDark);
                    }
                }
                if (e.key === STORAGE_KEYS.CURRENT_USER) {
                    updateNavbarAuthState();
                    initAuthForms();
                }
                if (e.key === STORAGE_KEYS.LANGUAGE) {
                    const langSelect = document.getElementById('lang') as HTMLSelectElement | null;
                    if (langSelect && e.newValue) {
                        try { langSelect.value = JSON.parse(e.newValue); } catch (err) { langSelect.value = e.newValue; }
                    }
                }
            });

            // Listen for OS system theme changes
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e: MediaQueryListEvent) => {
                    if (localStorage.getItem(DARK_KEY) === null && CookieStorage.get(DARK_KEY) === null) {
                        isDark = e.matches;
                        applyTheme(isDark);
                    }
                });
            }
        });
    })();

    (function initCarousel(): void {
        onReady(() => {
            const track = document.getElementById('carouselTrack') as HTMLElement | null;
            const carousel = document.getElementById('destCarousel') as HTMLElement | null;
            const prevBtn = document.getElementById('carouselPrev') as HTMLButtonElement | null;
            const nextBtn = document.getElementById('carouselNext') as HTMLButtonElement | null;
            const dotsContainer = document.getElementById('carouselDots') as HTMLElement | null;
            const progressBar = document.getElementById('carouselProgressBar') as HTMLElement | null;

            if (!track || !carousel) return;

            const cards = Array.from(track.querySelectorAll<HTMLElement>('.tcard'));
            const TOTAL = cards.length;
            if (TOTAL === 0) return;

            let currentIndex = 0;
            let autoPlayTimer: ReturnType<typeof setInterval> | null = null;
            let isDragging = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let initialTranslate = 0;
            let currentTranslate = 0;
            let dragStartTime = 0;
            let hasDragged = false;

            function getCardsVisible(): number {
                if (window.innerWidth <= 768) return 1;
                if (window.innerWidth <= 1024) return 2;
                return 3;
            }

            function maxIndex(): number {
                return Math.max(0, TOTAL - getCardsVisible());
            }

            function getCardWidth(): number {
                if (!cards[0] || !track) return 0;
                const rect = cards[0].getBoundingClientRect();
                const style = window.getComputedStyle(track);
                const gap = parseFloat(style.gap) || 24;
                return rect.width + gap;
            }

            // Build dynamic dots
            function buildDots(): void {
                if (!dotsContainer) return;
                dotsContainer.innerHTML = '';
                const maxIdx = maxIndex();
                for (let i = 0; i <= maxIdx; i++) {
                    const dot = document.createElement('button');
                    dot.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
                    dot.setAttribute('aria-label', `Go to destination slide ${i + 1}`);
                    dot.setAttribute('role', 'tab');
                    dot.setAttribute('aria-selected', (i === currentIndex).toString());
                    dot.addEventListener('click', (e: MouseEvent) => {
                        e.stopPropagation();
                        resetAutoPlay();
                        goTo(i);
                    });
                    dotsContainer.appendChild(dot);
                }
            }

            function updateDots(index: number): void {
                if (!dotsContainer) return;
                const dots = dotsContainer.querySelectorAll<HTMLButtonElement>('.carousel-dot');
                dots.forEach((d, i) => {
                    const isActive = i === index;
                    d.classList.toggle('active', isActive);
                    d.setAttribute('aria-selected', isActive.toString());
                });
            }

            function updateProgressBar(index: number): void {
                if (!progressBar) return;
                const maxIdx = maxIndex();
                const pct = maxIdx === 0 ? 100 : Math.min(100, Math.max(16, ((index + 1) / (maxIdx + 1)) * 100));
                progressBar.style.width = pct + '%';
            }

            function updateActiveCards(index: number): void {
                const visible = getCardsVisible();
                cards.forEach((c, idx) => {
                    // In 3-card view, highlight center visible card; otherwise active card
                    const centerIdx = visible === 3 ? index + 1 : index;
                    c.classList.toggle('is-active', idx === centerIdx);
                });
            }

            function goTo(index: number, smooth = true): void {
                if (!track) return;
                const maxIdx = maxIndex();
                currentIndex = Math.max(0, Math.min(index, maxIdx));

                const cardWidth = getCardWidth();
                const offset = currentIndex * cardWidth;

                track.style.transition = smooth ? 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
                track.style.transform = `translateX(-${offset}px)`;

                updateDots(currentIndex);
                updateProgressBar(currentIndex);
                updateActiveCards(currentIndex);
            }

            function next(): void {
                const maxIdx = maxIndex();
                if (currentIndex >= maxIdx) {
                    goTo(0);
                } else {
                    goTo(currentIndex + 1);
                }
            }

            function prev(): void {
                const maxIdx = maxIndex();
                if (currentIndex <= 0) {
                    goTo(maxIdx);
                } else {
                    goTo(currentIndex - 1);
                }
            }

            if (prevBtn) {
                prevBtn.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();
                    resetAutoPlay();
                    prev();
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();
                    resetAutoPlay();
                    next();
                });
            }

            // Keyboard navigation
            document.addEventListener('keydown', (e: KeyboardEvent) => {
                const activeEl = document.activeElement;
                if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) return;
                if (e.key === 'ArrowLeft') { resetAutoPlay(); prev(); }
                if (e.key === 'ArrowRight') { resetAutoPlay(); next(); }
            });

            // Interactive Pointer / Mouse / Touch Drag
            function startDrag(clientX: number, clientY: number, isTouch: boolean, e: Event): void {
                if (!track || !carousel) return;
                const targetEl = e.target as HTMLElement | null;
                if (targetEl && targetEl.closest('.carousel-btn')) return;

                isDragging = true;
                hasDragged = false;
                dragStartX = clientX;
                dragStartY = clientY;
                dragStartTime = Date.now();

                const cardWidth = getCardWidth();
                initialTranslate = - (currentIndex * cardWidth);
                currentTranslate = initialTranslate;

                track.style.transition = 'none';
                carousel.classList.add('is-dragging');
                stopAutoPlay();
            }

            function moveDrag(clientX: number, clientY: number, isTouch: boolean, e: Event): void {
                if (!isDragging || !track || !carousel) return;
                const diffX = clientX - dragStartX;
                const diffY = clientY - dragStartY;

                // Touch: allow normal vertical page scroll if user scrolls vertically
                if (isTouch) {
                    if (Math.abs(diffY) > Math.abs(diffX) && !hasDragged) {
                        isDragging = false;
                        carousel.classList.remove('is-dragging');
                        track.style.transition = 'transform 0.4s ease';
                        track.style.transform = `translateX(${initialTranslate}px)`;
                        startAutoPlay();
                        return;
                    }
                }

                if (Math.abs(diffX) > 6) {
                    hasDragged = true;
                    if (e.cancelable) e.preventDefault();
                }

                const maxIdx = maxIndex();
                const cardWidth = getCardWidth();
                const minTranslate = - (maxIdx * cardWidth);
                const maxTranslate = 0;

                let newTranslate = initialTranslate + diffX;
                // Elastic rubber-banding past boundaries
                if (newTranslate > maxTranslate) {
                    newTranslate = maxTranslate + (newTranslate - maxTranslate) * 0.25;
                } else if (newTranslate < minTranslate) {
                    newTranslate = minTranslate + (newTranslate - minTranslate) * 0.25;
                }

                currentTranslate = newTranslate;
                track.style.transform = `translateX(${currentTranslate}px)`;
            }

            function endDrag(clientX: number): void {
                if (!isDragging || !carousel) return;
                isDragging = false;
                carousel.classList.remove('is-dragging');

                const diffX = clientX - dragStartX;
                const elapsedTime = Date.now() - dragStartTime;
                const cardWidth = getCardWidth();
                const maxIdx = maxIndex();

                const threshold = Math.min(cardWidth * 0.2, 70);
                const isFlick = elapsedTime < 280 && Math.abs(diffX) > 25;

                if (diffX < -threshold || (isFlick && diffX < -20)) {
                    if (currentIndex < maxIdx) {
                        goTo(currentIndex + 1);
                    } else {
                        goTo(0);
                    }
                } else if (diffX > threshold || (isFlick && diffX > 20)) {
                    if (currentIndex > 0) {
                        goTo(currentIndex - 1);
                    } else {
                        goTo(maxIdx);
                    }
                } else {
                    goTo(currentIndex);
                }

                startAutoPlay();
                setTimeout(() => { hasDragged = false; }, 80);
            }

            // Mouse Events
            carousel.addEventListener('mousedown', (e: MouseEvent) => {
                if (e.button !== 0) return; // Only left-click
                startDrag(e.clientX, e.clientY, false, e);
            });

            window.addEventListener('mousemove', (e: MouseEvent) => {
                if (!isDragging) return;
                moveDrag(e.clientX, e.clientY, false, e);
            });

            window.addEventListener('mouseup', (e: MouseEvent) => {
                if (!isDragging) return;
                endDrag(e.clientX);
            });

            // Touch Events
            track.addEventListener('touchstart', (e: TouchEvent) => {
                if (e.touches.length !== 1) return;
                startDrag(e.touches[0].clientX, e.touches[0].clientY, true, e);
            }, { passive: true });

            track.addEventListener('touchmove', (e: TouchEvent) => {
                if (!isDragging || e.touches.length !== 1) return;
                moveDrag(e.touches[0].clientX, e.touches[0].clientY, true, e);
            }, { passive: false });

            track.addEventListener('touchend', (e: TouchEvent) => {
                if (!isDragging) return;
                endDrag(e.changedTouches[0].clientX);
            }, { passive: true });

            // Suppress card click if dragged
            cards.forEach((card, idx) => {
                card.addEventListener('click', (e: MouseEvent) => {
                    if (hasDragged) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    const maxIdx = maxIndex();
                    const targetIdx = Math.min(idx, maxIdx);
                    if (targetIdx !== currentIndex) {
                        goTo(targetIdx);
                        resetAutoPlay();
                    }
                });
            });

            // Auto-play management
            function startAutoPlay(): void {
                stopAutoPlay();
                autoPlayTimer = setInterval(next, 4500);
            }

            function stopAutoPlay(): void {
                if (autoPlayTimer) clearInterval(autoPlayTimer);
            }

            function resetAutoPlay(): void {
                stopAutoPlay();
                startAutoPlay();
            }

            const carouselWrapper = (document.querySelector('.carousel-wrapper') || carousel) as HTMLElement;
            carouselWrapper.addEventListener('mouseenter', stopAutoPlay);
            carouselWrapper.addEventListener('mouseleave', startAutoPlay);

            // Pause autoplay when browser tab is inactive
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    stopAutoPlay();
                } else {
                    startAutoPlay();
                }
            });

            // Window resize with debounce
            let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
            window.addEventListener('resize', () => {
                if (resizeTimeout) clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    buildDots();
                    goTo(Math.min(currentIndex, maxIndex()), false);
                }, 150);
            });

            // Re-align once all image dimensions are fully loaded
            window.addEventListener('load', () => {
                buildDots();
                goTo(currentIndex, false);
            });

            // Initial setup
            buildDots();
            goTo(0, false);
            startAutoPlay();
        });
    })();

    // ==========================================
    // 7. TESTIMONIALS SLIDER INTERACTION (3-Card Stack & Pagination)
    // ==========================================
    (function initTestimonials(): void {
        onReady(() => {
            const dotsSvg = document.querySelector<SVGSVGElement>('.testimonial-dots-svg');
            const cardsContainer = document.querySelector<HTMLElement>('.coms');
            let cards = Array.from(document.querySelectorAll<HTMLElement>('.coms .com'));
            const arrowUp = document.getElementById('tArrowUp') as HTMLElement | null;
            const arrowDown = document.getElementById('tArrowDown') as HTMLElement | null;

            if (!cards.length) return;

            let circles = dotsSvg ? Array.from(dotsSvg.querySelectorAll<SVGCircleElement>('circle')) : [];
            let currentIndex = 0;
            let autoPlayTimer: ReturnType<typeof setInterval> | null = null;

            function getOffsets(): { stepX: number; stepY: number } {
                const isMobile = window.innerWidth <= 650;
                const isTablet = window.innerWidth <= 768;
                return {
                    stepX: isMobile ? 12 : isTablet ? 18 : 26,
                    stepY: isMobile ? 18 : isTablet ? 30 : 45
                };
            }

            function setTestimonial(idx: number, animate = true): void {
                const total = cards.length;
                currentIndex = ((idx % total) + total) % total;

                // 1. Update SVG Pagination Dots
                circles.forEach((circle, i) => {
                    if (i === currentIndex) {
                        circle.setAttribute('class', 'dot-active');
                    } else {
                        circle.setAttribute('class', 'dot-inactive');
                    }
                });

                // 2. Update Card 3D Stack Hierarchy
                const { stepX, stepY } = getOffsets();

                cards.forEach((card, i) => {
                    const rel = ((i - currentIndex) % total + total) % total;
                    card.classList.remove('is-front', 'is-middle', 'is-back');

                    if (animate) {
                        card.style.transition = 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s ease';
                    } else {
                        card.style.transition = 'none';
                    }

                    if (rel === 0) {
                        card.classList.add('is-front');
                        card.style.zIndex = '5';
                        card.style.opacity = '1';
                        card.style.transform = 'translate(0px, 0px) scale(1)';
                        card.setAttribute('aria-hidden', 'false');
                    } else if (rel === 1) {
                        card.classList.add('is-middle');
                        card.style.zIndex = '3';
                        card.style.opacity = window.innerWidth <= 650 ? '0.5' : '0.6';
                        card.style.transform = `translate(${stepX}px, ${stepY}px) scale(0.96)`;
                        card.setAttribute('aria-hidden', 'true');
                    } else {
                        card.classList.add('is-back');
                        card.style.zIndex = '1';
                        card.style.opacity = window.innerWidth <= 650 ? '0.2' : '0.28';
                        card.style.transform = `translate(${stepX * 2}px, ${stepY * 2}px) scale(0.92)`;
                        card.setAttribute('aria-hidden', 'true');
                    }
                });
            }

            function nextTestimonial(): void {
                setTestimonial(currentIndex + 1);
            }

            function prevTestimonial(): void {
                setTestimonial(currentIndex - 1);
            }

            function startAuto(): void {
                stopAuto();
                autoPlayTimer = setInterval(nextTestimonial, 6500);
            }

            function stopAuto(): void {
                if (autoPlayTimer) clearInterval(autoPlayTimer);
            }

            function resetAuto(): void {
                stopAuto();
                startAuto();
            }

            // SVG Dot clicks
            circles.forEach((circle, idx) => {
                circle.style.cursor = 'pointer';
                circle.addEventListener('click', () => {
                    setTestimonial(idx);
                    resetAuto();
                });
            });

            // Card clicks: clicking any background card promotes it to the front
            cards.forEach((card, idx) => {
                card.addEventListener('click', () => {
                    if (idx !== currentIndex) {
                        setTestimonial(idx);
                        resetAuto();
                    }
                });
            });

            // Arrow button clicks
            if (arrowUp) {
                arrowUp.addEventListener('click', (e: MouseEvent) => {
                    e.preventDefault();
                    prevTestimonial();
                    resetAuto();
                });
            }

            if (arrowDown) {
                arrowDown.addEventListener('click', (e: MouseEvent) => {
                    e.preventDefault();
                    nextTestimonial();
                    resetAuto();
                });
            }

            // Touch swipe gestures on cards container
            if (cardsContainer) {
                let touchStartX = 0;
                let touchStartY = 0;

                cardsContainer.addEventListener('touchstart', (e: TouchEvent) => {
                    if (e.touches.length === 1) {
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        stopAuto();
                    }
                }, { passive: true });

                cardsContainer.addEventListener('touchend', (e: TouchEvent) => {
                    if (e.changedTouches.length === 1) {
                        const diffX = e.changedTouches[0].clientX - touchStartX;
                        const diffY = e.changedTouches[0].clientY - touchStartY;
                        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                            if (diffX < 0) nextTestimonial();
                            else prevTestimonial();
                        } else if (Math.abs(diffY) > 35 && Math.abs(diffY) > Math.abs(diffX)) {
                            if (diffY < 0) nextTestimonial();
                            else prevTestimonial();
                        }
                        startAuto();
                    }
                }, { passive: true });

                // Hover pause for desktop
                cardsContainer.addEventListener('mouseenter', stopAuto);
                cardsContainer.addEventListener('mouseleave', startAuto);
            }

            // Pause on tab visibility change
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) stopAuto();
                else startAuto();
            });

            function refreshStack(): void {
                cards = Array.from(document.querySelectorAll<HTMLElement>('.coms .com'));
                // Re-bind card click events
                cards.forEach((card, idx) => {
                    card.onclick = () => {
                        if (idx !== currentIndex) {
                            setTestimonial(idx);
                            resetAuto();
                        }
                    };
                });
                if (dotsSvg) {
                    dotsSvg.innerHTML = '';
                    const total = cards.length;
                    const spacing = total > 1 ? Math.min(36, Math.floor(96 / (total - 1))) : 36;
                    const startX = Math.max(14, Math.floor((108 - (total - 1) * spacing) / 2));
                    for (let i = 0; i < total; i++) {
                        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        circle.setAttribute('cx', String(startX + i * spacing));
                        circle.setAttribute('cy', '14');
                        circle.setAttribute('r', '6');
                        circle.setAttribute('class', i === 0 ? 'dot-active' : 'dot-inactive');
                        circle.style.cursor = 'pointer';
                        const targetIdx = i;
                        circle.addEventListener('click', () => {
                            setTestimonial(targetIdx);
                            resetAuto();
                        });
                        dotsSvg.appendChild(circle);
                    }
                    circles = Array.from(dotsSvg.querySelectorAll<SVGCircleElement>('circle'));
                }
                setTestimonial(0, true);
            }

            // Real-time update when user shares journey/trip review
            window.addEventListener('jadoo:new_testimonial', () => {
                refreshStack();
                resetAuto();
            });

            // Window resize
            window.addEventListener('resize', () => {
                setTestimonial(currentIndex, false);
            });

            // Initial setup
            setTestimonial(0, false);
            startAuto();
        });
    })();
})();
