"use strict";
(function () {
    'use strict';
    // ========================================== 
    // GLOBAL BOTTOM-CENTER TOAST NOTIFICATION HELPER
    // ========================================== 
    function showToastNotification(title, desc = '', type = 'info', duration = 4000) {
        const jToast = window.JadooToast;
        if (jToast && typeof jToast.show === 'function') {
            jToast.show(title, desc, type, duration);
            return;
        }
        let container = document.getElementById('jadooToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'jadooToastContainer';
            container.className = 'jadoo-toast-container';
            document.body.appendChild(container);
        }
        const normType = (type || 'info').toLowerCase();
        const toast = document.createElement('div');
        toast.className = `jadoo-toast toast-${normType}`;
        let iconClass = 'fa-circle-info';
        if (normType === 'success')
            iconClass = 'fa-circle-check';
        else if (normType === 'error')
            iconClass = 'fa-circle-xmark';
        else if (normType === 'warning')
            iconClass = 'fa-triangle-exclamation';
        else if (normType === 'info')
            iconClass = 'fa-circle-info';
        else
            iconClass = 'fa-bell';
        const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="toast-content">
                <h4 class="toast-title">${esc(title)}</h4>
                ${desc ? `<p class="toast-desc">${esc(desc)}</p>` : ''}
            </div>
            <button type="button" class="toast-close" aria-label="Close notification" title="Dismiss">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toast.classList.remove('is-show');
                toast.classList.add('is-hiding');
                setTimeout(() => toast.remove(), 320);
            });
        }
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('is-show'));
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.remove('is-show');
                toast.classList.add('is-hiding');
                setTimeout(() => toast.remove(), 350);
            }
        }, duration);
    }
    window.showToastNotification = showToastNotification;
    if (typeof window.JadooToast === 'undefined') {
        window.JadooToast = { show: showToastNotification };
    }
    // ==========================================
    // 1. COOKIE STORAGE SERVICE
    // ==========================================
    const CookieStorage = {
        set(name, value, days = 365) {
            try {
                const date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                const expires = "; expires=" + date.toUTCString();
                document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(JSON.stringify(value)) + expires + "; path=/; SameSite=Lax";
            }
            catch (e) {
                console.warn('CookieStorage set error:', e);
            }
        },
        get(name) {
            try {
                const nameEQ = encodeURIComponent(name) + "=";
                const ca = document.cookie.split(';');
                for (let i = 0; i < ca.length; i++) {
                    let c = ca[i];
                    while (c.charAt(0) === ' ')
                        c = c.substring(1, c.length);
                    if (c.indexOf(nameEQ) === 0) {
                        const rawVal = decodeURIComponent(c.substring(nameEQ.length, c.length));
                        return JSON.parse(rawVal);
                    }
                }
            }
            catch (e) {
                console.warn('CookieStorage get error:', e);
            }
            return null;
        },
        remove(name) {
            try {
                document.cookie = encodeURIComponent(name) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
            }
            catch (e) {
                console.warn('CookieStorage remove error:', e);
            }
        }
    };
    function getApiBase() {
        if (typeof window !== 'undefined' && window.location) {
            const protocol = window.location.protocol;
            const hostname = window.location.hostname;
            const port = window.location.port;
            // If served as a file:// URL, backend is always on localhost:3000
            if (protocol === 'file:')
                return 'http://localhost:3000';
            // If already on port 3000 (Express serves HTML directly), use same origin
            if (port === '3000')
                return window.location.origin;
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
    function getStoredAuthToken() {
        if (typeof localStorage !== 'undefined') {
            const token = localStorage.getItem('jadoo_auth_token');
            if (token)
                return token;
        }
        if (typeof document !== 'undefined') {
            const match = document.cookie.match(/(?:^|; )jadoo_auth_token=([^;]*)/);
            if (match) {
                try {
                    return decodeURIComponent(match[1]);
                }
                catch (_) {
                    return match[1];
                }
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
    };
    const Storage = {
        get(key, defaultValue = null) {
            try {
                // 1. Read from LocalStorage
                const localItem = localStorage.getItem(key);
                if (localItem !== null) {
                    const parsed = JSON.parse(localItem);
                    CookieStorage.set(key, parsed);
                    return parsed;
                }
                // 2. Fallback to Cookie backup if LocalStorage was empty
                const cookieItem = CookieStorage.get(key);
                if (cookieItem !== null) {
                    localStorage.setItem(key, JSON.stringify(cookieItem));
                    return cookieItem;
                }
                return defaultValue;
            }
            catch (error) {
                console.error(`Storage read error for "${key}":`, error);
                return defaultValue;
            }
        },
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                CookieStorage.set(key, value);
                return true;
            }
            catch (error) {
                console.error(`Storage write error for "${key}":`, error);
                return false;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
                CookieStorage.remove(key);
                return true;
            }
            catch (error) {
                console.error(`Storage remove error for "${key}":`, error);
                return false;
            }
        },
        clear() {
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
            }
            catch (error) {
                console.error('Storage clear error:', error);
                return false;
            }
        }
    };
    const AuthService = {
        getUsers() {
            return Storage.get(STORAGE_KEYS.USERS, []) ?? [];
        },
        getCurrentUser() {
            if (typeof localStorage !== 'undefined' && localStorage.getItem('jadoo_logged_out') === 'true') {
                return null;
            }
            let user = Storage.get(STORAGE_KEYS.CURRENT_USER, null);
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
                    }
                    catch { }
                }
            }
            return user;
        },
        isAuthenticated() {
            return this.getCurrentUser() !== null;
        },
        async signUp(fullName, email, password) {
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
                    const newUser = {
                        id: saved.id, // Real PostgreSQL UUID
                        fullName: saved.full_name || cleanName,
                        email: saved.email || cleanEmail,
                        password: '',
                        createdAt: saved.created_at || new Date().toISOString()
                    };
                    newUser.token = saved.token;
                    const users = this.getUsers().filter(u => u.email !== cleanEmail);
                    users.push(newUser);
                    Storage.set(STORAGE_KEYS.USERS, users);
                    this.createSession(newUser);
                    try {
                        if (typeof window.JadooDB !== 'undefined') {
                            window.JadooDB.setCurrentUser({
                                id: saved.id,
                                full_name: newUser.fullName,
                                email: newUser.email,
                                token: saved.token
                            });
                        }
                    }
                    catch (_) { }
                    return { success: true, message: 'Account created successfully in PostgreSQL!', user: newUser };
                }
                else {
                    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
                    return { success: false, message: err.error || 'Registration failed' };
                }
            }
            catch (networkErr) {
                console.warn('Backend register failed, falling back to offline storage:', networkErr);
                const users = this.getUsers();
                if (users.find(u => u.email === cleanEmail)) {
                    return { success: false, message: 'An account with this email already exists.' };
                }
                const fallbackUser = {
                    id: 'user_' + Date.now(),
                    fullName: cleanName,
                    email: cleanEmail,
                    password: '',
                    createdAt: new Date().toISOString()
                };
                users.push(fallbackUser);
                Storage.set(STORAGE_KEYS.USERS, users);
                this.createSession(fallbackUser);
                return { success: true, message: 'Account created in offline mode.', user: fallbackUser };
            }
        },
        async signIn(identifier, password) {
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
                        const loggedIn = {
                            id: dbUser.id, // Real PostgreSQL UUID
                            fullName: dbUser.full_name || 'Traveler',
                            email: dbUser.email,
                            password: '',
                            createdAt: dbUser.created_at || new Date().toISOString()
                        };
                        loggedIn.token = dbUser.token;
                        // Clean out any stale local dummy users
                        const users = this.getUsers().filter(u => u.email !== loggedIn.email);
                        users.push(loggedIn);
                        Storage.set(STORAGE_KEYS.USERS, users);
                        this.createSession(loggedIn);
                        try {
                            if (typeof window.JadooDB !== 'undefined') {
                                window.JadooDB.setCurrentUser({
                                    id: dbUser.id,
                                    full_name: dbUser.full_name,
                                    email: dbUser.email,
                                    token: dbUser.token
                                });
                            }
                        }
                        catch (_) { }
                        window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: true, user: loggedIn } }));
                        return { success: true, message: 'Logged in successfully via PostgreSQL!', user: loggedIn };
                    }
                }
                else if (res.status === 401) {
                    return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
                }
            }
            catch (networkErr) {
                console.warn('Backend login unreachable, falling back to local session:', networkErr);
            }
            // Local fallback only if backend was unreachable
            const users = this.getUsers();
            const localUser = users.find(u => (u.email === cleanId || u.id === cleanId || ((u.fullName || u.full_name || '').toLowerCase() === cleanId)) && u.password === password);
            if (localUser) {
                this.createSession(localUser);
                return { success: true, message: 'Logged in from local session cache.', user: localUser };
            }
            return { success: false, message: 'Invalid credentials. Please verify your email and password.' };
        },
        createSession(user) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('jadoo_logged_out');
                if (user.token) {
                    localStorage.setItem('jadoo_auth_token', user.token);
                    document.cookie = `jadoo_auth_token=${encodeURIComponent(user.token)}; path=/; max-age=604800; SameSite=Lax`;
                }
            }
            const sessionUser = {
                id: user.id,
                fullName: user.fullName,
                full_name: user.fullName,
                email: user.email,
                avatar_url: user.avatar_url || './assets/testimonials-avatar-1.png',
                token: user.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('jadoo_auth_token') : null),
                loggedInAt: new Date().toISOString()
            };
            Storage.set(STORAGE_KEYS.CURRENT_USER, sessionUser);
            try {
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { type: 'auth', user: sessionUser } }));
                window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: true, user: sessionUser } }));
            }
            catch (_) { }
            return sessionUser;
        },
        logout() {
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
                if (typeof window.JadooDB !== 'undefined') {
                    window.JadooDB.logout();
                }
            }
            catch (_) { }
            try {
                fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => { });
            }
            catch (_) { }
            updateNavbarAuthState();
            try {
                window.dispatchEvent(new CustomEvent('jadoo:auth_change', { detail: { loggedIn: false } }));
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { type: 'logout' } }));
            }
            catch (_) { }
        }
    };
    const BookingService = {
        getAllBookings() {
            try {
                return Storage.get(STORAGE_KEYS.BOOKINGS, []) ?? [];
            }
            catch {
                return [];
            }
        },
        getUserBookings(emailOrId) {
            const all = this.getAllBookings();
            if (!emailOrId) {
                const user = AuthService.getCurrentUser();
                if (user) {
                    const uEmail = (user.email || '').toLowerCase().trim();
                    const uId = String(user.id || '').toLowerCase().trim();
                    return all.filter(b => {
                        const bEmail = (b.userEmail || b.user_email || b.email || '').toLowerCase().trim();
                        const bId = String(b.userId || b.user_id || b.customer_id || b.id || '').toLowerCase().trim();
                        return (uEmail && bEmail === uEmail) || (uId && bId === uId);
                    });
                }
                return all;
            }
            const clean = (emailOrId || '').toLowerCase().trim();
            return all.filter(b => {
                const bEmail = (b.userEmail || b.user_email || b.email || '').toLowerCase().trim();
                const bId = String(b.userId || b.user_id || b.customer_id || b.id || '').toLowerCase().trim();
                return (bEmail && bEmail === clean) || (bId && bId === clean);
            });
        },
        createBooking(data) {
            const bookings = this.getAllBookings();
            const tempId = 'BK-' + Math.floor(100000 + Math.random() * 900000);
            const newBooking = {
                ...data,
                id: tempId,
                status: 'Confirmed',
                createdAt: new Date().toISOString()
            };
            bookings.unshift(newBooking);
            Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
            try {
                updateNavbarAuthState();
            }
            catch (_) { }
            window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_bookings' } }));
            // Save directly into PostgreSQL via Express API
            try {
                const token = getStoredAuthToken();
                const headers = { 'Content-Type': 'application/json' };
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
                }).then(async (r) => {
                    if (r.ok) {
                        const saved = await r.json();
                        console.log('✅ Booking successfully stored in PostgreSQL:', saved);
                    }
                    else {
                        console.error('Failed to store booking in PostgreSQL:', r.statusText);
                    }
                }).catch(err => {
                    console.error('Error saving booking to PostgreSQL:', err);
                });
            }
            catch (e) {
                console.error(e);
            }
            return newBooking;
        },
        cancelBooking(id) {
            const bookings = this.getAllBookings();
            const target = bookings.find(b => b.id === id || b.booking_ref === id || b.bookingRef === id);
            if (target) {
                target.status = 'Cancelled';
                target.status = 'cancelled';
                Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
                try {
                    updateNavbarAuthState();
                }
                catch (_) { }
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_bookings' } }));
                // Sync cancellation to PostgreSQL
                try {
                    const token = getStoredAuthToken();
                    const headers = { 'Content-Type': 'application/json' };
                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    fetch(`${API_BASE}/api/bookings/${encodeURIComponent(id)}/status`, {
                        method: 'PATCH',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify({ status: 'cancelled' })
                    }).catch(console.error);
                }
                catch (_) { }
                return true;
            }
            return false;
        },
        count(emailOrId) {
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
        }
        catch (e) {
            console.error('initScrollReveal error:', e);
        }
        // --- B. Mobile Drawer Navigation ---
        try {
            const hamburger = document.getElementById('hamburger-btn');
            const navMenu = document.getElementById('navitems');
            const navLinks = document.querySelectorAll('.navlink, .navitems .signup');
            if (hamburger && navMenu) {
                hamburger.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const willBeActive = !navMenu.classList.contains('active');
                    hamburger.classList.toggle('active', willBeActive);
                    navMenu.classList.toggle('active', willBeActive);
                    if (typeof document !== 'undefined' && document.body) {
                        document.body.classList.toggle('mobile-nav-open', willBeActive);
                    }
                    hamburger.setAttribute('aria-expanded', willBeActive ? 'true' : 'false');
                };
                navLinks.forEach((link) => {
                    link.addEventListener('click', () => {
                        hamburger.classList.remove('active');
                        navMenu.classList.remove('active');
                        if (typeof document !== 'undefined' && document.body) {
                            document.body.classList.remove('mobile-nav-open');
                        }
                        hamburger.setAttribute('aria-expanded', 'false');
                    });
                });
                if (!window._scriptHamburgerDocClick) {
                    window._scriptHamburgerDocClick = true;
                    document.addEventListener('click', (e) => {
                        const target = e.target;
                        if (target && !navMenu.contains(target) && !hamburger.contains(target) && navMenu.classList.contains('active')) {
                            hamburger.classList.remove('active');
                            navMenu.classList.remove('active');
                            if (typeof document !== 'undefined' && document.body) {
                                document.body.classList.remove('mobile-nav-open');
                            }
                            hamburger.setAttribute('aria-expanded', 'false');
                        }
                    });
                }
            }
            // Direct Sign Up navigation listener
            const navSignupBtns = document.querySelectorAll('#nav-signup-btn, .navitems button.signup, .navitems .signup');
            navSignupBtns.forEach((btn) => {
                if (!btn._scriptNavSignupBound) {
                    btn._scriptNavSignupBound = true;
                    btn.addEventListener('click', (e) => {
                        const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
                        const target = isComp ? './auth.html#signup' : './components/auth.html#signup';
                        if (!window.location.href.includes('auth.html#signup')) {
                            window.location.href = target;
                        }
                    });
                }
            });
        }
        catch (e) {
            console.error('Drawer init error:', e);
        }
        // --- C. Functional Multilingual Translation System ---
        const I18N_DICTIONARY = {
            eng: {
                home: 'Home',
                destinations: 'Destinations',
                services: 'Services',
                bookings: 'Bookings',
                testimonials: 'Testimonials',
                login: 'Login',
                signup: 'Sign Up',
                logout: 'Log Out',
                my_profile: 'My Profile',
                my_tickets: 'My E-Tickets',
                explore_dest: 'Explore Destinations',
                hero_badge: 'Best Destinations around the world',
                hero_title: 'Travel, enjoy and live a new and full life',
                hero_sub: 'Discover handcrafted luxury journeys, verified VIP admission passes, and authentic destination experiences tailored for the modern voyager.',
                find_out_more: 'Find out more',
                play_demo: 'Play Demo',
                cat_sub: 'CATEGORY',
                cat_title: 'We Offer Best Services',
                top_sub: 'Top Selling',
                top_title: 'Top Destinations',
                book_sub: 'Easy and Fast',
                book_title: 'Book Your Next Trip In 3 Easy Steps',
                test_sub: 'Testimonials',
                test_title: 'What People Say About Us',
                subs_title: 'Subscribe to get information, latest news and other interesting offers about Jadoo',
                subs_btn: 'Subscribe',
                back_popular: 'Back to Popular Locations',
                search_placeholder: 'Search city, landmark, or category...',
                filter_all: 'All',
                filter_landmarks: 'Landmarks',
                filter_museums: 'Museums',
                filter_architecture: 'Architecture',
                filter_nature: 'Nature',
                filter_entertainment: 'Entertainment',
                switched_msg: 'Language switched to English'
            },
            Guj: {
                home: 'મુખ્ય પૃષ્ઠ',
                destinations: 'પ્રવાસન સ્થળો',
                services: 'સેવાઓ',
                bookings: 'મારા બુકિંગ',
                testimonials: 'અભિપ્રાયો',
                login: 'પ્રવેશ કરો',
                signup: 'સાઇન અપ',
                logout: 'બહાર નીકળો',
                my_profile: 'મારી પ્રોફાઇલ',
                my_tickets: 'મારી ઈ-ટિકિટ્સ',
                explore_dest: 'નવા સ્થળો શોધો',
                hero_badge: 'સમગ્ર વિશ્વમાં શ્રેષ્ઠ પ્રવાસન સ્થળો',
                hero_title: 'મુસાફરી કરો, આનંદ માણો અને નવું જીવન જીવો',
                hero_sub: 'વિશ્વના સુંદર પ્રવાસ સ્થળો, માન્ય વીઆઇપી પાસ અને અવિસ્મરણીય યાદો સાથે તમારી યાત્રા શરૂ કરો.',
                find_out_more: 'વધુ જાણો',
                play_demo: 'ડેમો જુઓ',
                cat_sub: 'શ્રેણીઓ',
                cat_title: 'અમે શ્રેષ્ઠ સેવાઓ પ્રદાન કરીએ છીએ',
                top_sub: 'લોકપ્રિય સ્થળો',
                top_title: 'શ્રેષ્ઠ પ્રવાસન સ્થળો',
                book_sub: 'સરળ અને ઝડપી',
                book_title: 'માત્ર ૩ સરળ પગલાંમાં તમારી યાત્રા બુક કરો',
                test_sub: 'અભિપ્રાયો',
                test_title: 'મુસાફરો અમારા વિશે શું કહે છે',
                subs_title: 'જાડૂ તરફથી નવીનતમ ઑફરો, પ્રવાસ માહિતી અને સમાચાર મેળવો',
                subs_btn: 'જોડાઓ',
                back_popular: 'લોકપ્રિય સ્થળો પર પાછા જાઓ',
                search_placeholder: 'શહેર, પ્રવાસ સ્થળ અથવા કેટેગરી શોધો...',
                filter_all: 'બધા',
                filter_landmarks: 'ઐતિહાસિક સ્થળો',
                filter_museums: 'સંગ્રહાલયો',
                filter_architecture: 'સ્થાપત્ય',
                filter_nature: 'કુદરતી સૌંદર્ય',
                filter_entertainment: 'મનોરંજન',
                switched_msg: 'ભાષા સફળતાપૂર્વક ગુજરાતીમાં બદલાઈ ગઈ છે'
            },
            Hi: {
                home: 'होम',
                destinations: 'गंतव्य स्थल',
                services: 'सेवाएं',
                bookings: 'मेरी बुकिंग्स',
                testimonials: 'प्रशंसापत्र',
                login: 'लॉग इन',
                signup: 'साइन अप',
                logout: 'लॉग आउट',
                my_profile: 'मेरी प्रोफ़ाइल',
                my_tickets: 'मेरी ई-टिकटें',
                explore_dest: 'गंतव्य स्थल खोजें',
                hero_badge: 'दुनिया भर के सर्वोत्तम गंतव्य स्थल',
                hero_title: 'यात्रा करें, आनंद लें और नया जीवन जिएं',
                hero_sub: 'दुनिया के मनमोहक पर्यटन स्थलों, वीआईपी पासेज और अविस्मरणीय अनुभवों के साथ अपनी यात्रा की योजना बनाएं।',
                find_out_more: 'और जानें',
                play_demo: 'डेमो देखें',
                cat_sub: 'श्रेणियां',
                cat_title: 'हम सर्वोत्तम सेवाएं प्रदान करते हैं',
                top_sub: 'सर्वश्रेष्ठ बिक्री',
                top_title: 'शीर्ष गंतव्य स्थल',
                book_sub: 'आसान और तेज़',
                book_title: 'केवल ३ आसान चरणों में अपनी यात्रा बुक करें',
                test_sub: 'प्रशंसापत्र',
                test_title: 'यात्री हमारे बारे में क्या कहते हैं',
                subs_title: 'जादू से नवीनतम ऑफ़र, यात्रा युक्तियाँ और समाचार प्राप्त करने के लिए सदस्यता लें',
                subs_btn: 'सब्सक्राइब',
                back_popular: 'लोकप्रिय स्थानों पर वापस जाएं',
                search_placeholder: 'शहर, स्मारक या श्रेणी खोजें...',
                filter_all: 'सभी',
                filter_landmarks: 'ऐतिहासिक स्थल',
                filter_museums: 'संग्रहालय',
                filter_architecture: 'स्थापत्य',
                filter_nature: 'प्राकृतिक दृश्य',
                filter_entertainment: 'मनोरंजन',
                switched_msg: 'भाषा सफलतापूर्वक हिंदी में बदल दी गई है'
            }
        };
        function applyLanguage(lang, notify = false) {
            const dict = I18N_DICTIONARY[lang] || I18N_DICTIONARY.eng;
            document.documentElement.lang = lang === 'Guj' ? 'gu' : lang === 'Hi' ? 'hi' : 'en';
            // 1. Update Navigation Items
            document.querySelectorAll('.navlink').forEach(link => {
                const href = (link.getAttribute('href') || '').toLowerCase();
                const id = link.getAttribute('id') || '';
                if (href.includes('index.html') || href === '#home')
                    link.textContent = dict.home;
                else if (href.includes('destination'))
                    link.textContent = dict.destinations;
                else if (href.includes('service'))
                    link.textContent = dict.services;
                else if (href.includes('booking') || id === 'navBookingsTrigger')
                    link.textContent = dict.bookings;
                else if (href.includes('testimonial'))
                    link.textContent = dict.testimonials;
                else if (id === 'nav-login-link')
                    link.textContent = dict.login;
            });
            const signupBtn = document.getElementById('nav-signup-btn');
            if (signupBtn)
                signupBtn.textContent = dict.signup;
            // 2. Dropdown items
            document.querySelectorAll('.dropdown-item').forEach(item => {
                const span = item.querySelector('span');
                if (!span)
                    return;
                const href = (item.getAttribute('href') || '').toLowerCase();
                if (href.includes('profile'))
                    span.textContent = dict.my_profile;
                else if (href.includes('ticket'))
                    span.textContent = dict.my_tickets;
                else if (href.includes('destination'))
                    span.textContent = dict.explore_dest;
                else if (item.id === 'navLogoutBtn')
                    span.textContent = dict.logout;
            });
            // 3. Main Landing Page Headlines & Content
            const heroBadge = document.querySelector('.dtexts h4');
            if (heroBadge)
                heroBadge.textContent = dict.hero_badge;
            const heroTitle = document.querySelector('.dtexts h1');
            if (heroTitle) {
                if (lang === 'Guj') {
                    heroTitle.innerHTML = `મુસાફરી કરો, <span class="highlight-word">આનંદ માણો<img src="./assets/red-stroke.png" alt="Underline highlight" class="red-stroke-img"></span> અને નવું જીવન જીવો`;
                }
                else if (lang === 'Hi') {
                    heroTitle.innerHTML = `यात्रा करें, <span class="highlight-word">आनंद लें<img src="./assets/red-stroke.png" alt="Underline highlight" class="red-stroke-img"></span> और नया जीवन जिएं`;
                }
                else {
                    heroTitle.innerHTML = `Travel, <span class="highlight-word">enjoy<img src="./assets/red-stroke.png" alt="Underline highlight" class="red-stroke-img"></span> and live a new and full life`;
                }
            }
            const heroSub = document.querySelector('.dtexts p');
            if (heroSub && dict.hero_sub)
                heroSub.textContent = dict.hero_sub;
            const dobut = document.querySelector('.dobut');
            if (dobut)
                dobut.textContent = dict.find_out_more;
            const demoText = document.querySelector('.playdemo p');
            if (demoText)
                demoText.textContent = dict.play_demo;
            const catSub = document.querySelector('.firsttext h4');
            if (catSub)
                catSub.textContent = dict.cat_sub;
            const catTitle = document.querySelector('.firsttext h1');
            if (catTitle)
                catTitle.textContent = dict.cat_title;
            const topSub = document.querySelector('.secondtext h4');
            if (topSub)
                topSub.textContent = dict.top_sub;
            const topTitle = document.querySelector('.secondtext h1');
            if (topTitle)
                topTitle.textContent = dict.top_title;
            const bookSub = document.querySelector('.fleft-head h4');
            if (bookSub)
                bookSub.textContent = dict.book_sub;
            const bookTitle = document.querySelector('.fleft-head h1');
            if (bookTitle)
                bookTitle.textContent = dict.book_title;
            const testSub = document.querySelector('.tleft-head h4');
            if (testSub)
                testSub.textContent = dict.test_sub;
            const testTitle = document.querySelector('.tleft-head h1');
            if (testTitle)
                testTitle.textContent = dict.test_title;
            const subsH2 = document.querySelector('.subs-content h2');
            if (subsH2)
                subsH2.textContent = dict.subs_title;
            const subsBtn = document.querySelector('.mailtext button');
            if (subsBtn)
                subsBtn.textContent = dict.subs_btn;
            // 4. Destination Page Elements
            const backPopBtn = document.querySelector('.btn-back-popular span');
            if (backPopBtn)
                backPopBtn.textContent = dict.back_popular;
            const destInput = document.getElementById('dest-input');
            if (destInput)
                destInput.placeholder = dict.search_placeholder;
            const chipAll = document.querySelector('.category-chip[data-category="all"]');
            if (chipAll)
                chipAll.innerHTML = `<i class="fa-solid fa-shapes"></i> ${dict.filter_all}`;
            const chipLandmarks = document.querySelector('.category-chip[data-category="landmarks"]');
            if (chipLandmarks)
                chipLandmarks.innerHTML = `<i class="fa-solid fa-monument"></i> ${dict.filter_landmarks}`;
            const chipMuseums = document.querySelector('.category-chip[data-category="museums"]');
            if (chipMuseums)
                chipMuseums.innerHTML = `<i class="fa-solid fa-palette"></i> ${dict.filter_museums}`;
            const chipArch = document.querySelector('.category-chip[data-category="architecture"]');
            if (chipArch)
                chipArch.innerHTML = `<i class="fa-solid fa-landmark-dome"></i> ${dict.filter_architecture}`;
            const chipNature = document.querySelector('.category-chip[data-category="nature"]');
            if (chipNature)
                chipNature.innerHTML = `<i class="fa-solid fa-mountain-sun"></i> ${dict.filter_nature}`;
            const chipEnt = document.querySelector('.category-chip[data-category="entertainment"]');
            if (chipEnt)
                chipEnt.innerHTML = `<i class="fa-solid fa-film"></i> ${dict.filter_entertainment}`;
            // Synchronize all select#lang on the page
            document.querySelectorAll('select#lang').forEach(sel => {
                sel.value = lang;
            });
            if (notify && typeof window.JadooToast !== 'undefined') {
                window.JadooToast.show('Language Updated', dict.switched_msg, 'info');
            }
        }
        try {
            const savedLang = Storage.get(STORAGE_KEYS.LANGUAGE) || 'eng';
            applyLanguage(savedLang, false);
            const langSelects = document.querySelectorAll('select#lang, select[name="Language"]');
            langSelects.forEach(sel => {
                sel.value = savedLang;
                sel.addEventListener('change', (e) => {
                    const target = e.target;
                    if (target) {
                        Storage.set(STORAGE_KEYS.LANGUAGE, target.value);
                        applyLanguage(target.value, true);
                    }
                });
            });
        }
        catch (e) {
            console.error('Language select init error:', e);
        }
        // --- Prevent Booking from Previous Days (Dynamic Date Picker Min Validator) ---
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            document.querySelectorAll('input[type="date"]').forEach(inp => {
                inp.min = todayStr;
                inp.addEventListener('change', () => {
                    if (inp.value && inp.value < todayStr) {
                        inp.value = todayStr;
                        if (typeof window.JadooToast !== 'undefined') {
                            window.JadooToast.show('Invalid Date', 'Travel date cannot be in the past.', 'warning');
                        }
                    }
                });
            });
        }
        catch (e) {
            console.error('Date input constraint error:', e);
        }
        // --- D. Update Navbar for Logged-In User ---
        try {
            updateNavbarAuthState();
        }
        catch (e) {
            console.error('updateNavbarAuthState error:', e);
        }
        // --- E. Form Handlers & Input Auto-Save/Restore ---
        try {
            initAuthForms();
        }
        catch (e) {
            console.error('initAuthForms error:', e);
        }
        try {
            restoreFormDrafts();
        }
        catch (e) {
            console.error('restoreFormDrafts error:', e);
        }
        // --- F. Newsletter Subscription & Demo Player ---
        try {
            initNewsletter();
        }
        catch (e) {
            console.error('initNewsletter error:', e);
        }
        try {
            initDemoPlayer();
        }
        catch (e) {
            console.error('initDemoPlayer error:', e);
        }
        // --- G. Trip Booking System & Homepage Card Triggers ---
        try {
            initBookingSystem();
        }
        catch (e) {
            console.error('initBookingSystem error:', e);
        }
        try {
            initHomepageBookingTriggers();
        }
        catch (e) {
            console.error('initHomepageBookingTriggers error:', e);
        }
    });
    let activeBookingDetails = {
        placeName: 'Colosseum & Historic Walking Tour',
        destination: 'Rome, Italy',
        pricePerPerson: 55,
        image: './assets/destination-rome.png'
    };
    function parseNumericPrice(val) {
        if (typeof val === 'number')
            return isNaN(val) ? 55 : val;
        if (!val)
            return 55;
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
    function formatDateDisplay(dateStr) {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime()))
                return dateStr;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        catch (_) {
            return dateStr;
        }
    }
    // Update navbar with user greeting, profile icon, and dropdown
    function updateNavbarAuthState() {
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
            if (document.body)
                document.body.classList.add('user-logged-in');
            const fullName = currentUser.fullName || 'Traveler';
            const userEmail = currentUser.email || '';
            const firstName = fullName.split(' ')[0] || 'Traveler';
            // Index Navbar
            if (loginLi)
                loginLi.style.setProperty('display', 'none', 'important');
            if (signupLi)
                signupLi.style.setProperty('display', 'none', 'important');
            if (userLi)
                userLi.style.setProperty('display', 'flex', 'important');
            if (firstNameDisplay)
                firstNameDisplay.textContent = firstName;
            if (dropdownUserName)
                dropdownUserName.textContent = fullName;
            if (dropdownUserEmail)
                dropdownUserEmail.textContent = userEmail;
            const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
            let avatarSrc = currentUser.avatar_url || (isComp ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png');
            if (!avatarSrc.startsWith('data:') && !avatarSrc.startsWith('http://') && !avatarSrc.startsWith('https://')) {
                if (isComp && avatarSrc.startsWith('./assets/')) {
                    avatarSrc = '.' + avatarSrc;
                }
                else if (!isComp && avatarSrc.startsWith('../assets/')) {
                    avatarSrc = avatarSrc.replace(/^\.\.\//, './');
                }
            }
            const navAvatarImg = document.getElementById('navUserAvatarImg');
            if (navAvatarImg) {
                navAvatarImg.src = avatarSrc;
                navAvatarImg.style.display = 'block';
            }
            const dropdownAvatarImgs = document.querySelectorAll('#dropdownUserAvatarImg, #destDropdownUserAvatarImg, .dropdown-avatar-circle img');
            dropdownAvatarImgs.forEach((img) => {
                img.src = avatarSrc;
                img.style.display = 'block';
                if (img.nextElementSibling) {
                    img.nextElementSibling.style.display = 'none';
                }
            });
            if (navBookingBadge) {
                navBookingBadge.textContent = bookingCount.toString();
                navBookingBadge.style.display = bookingCount > 0 ? 'inline-block' : 'none';
            }
            // Destination Navbar
            if (destLoginBtn)
                destLoginBtn.style.setProperty('display', 'none', 'important');
            if (destUserDropdown)
                destUserDropdown.style.setProperty('display', 'inline-block', 'important');
            if (destFirstNameDisplay)
                destFirstNameDisplay.textContent = firstName;
            if (destDropdownUserName)
                destDropdownUserName.textContent = fullName;
            if (destDropdownUserEmail)
                destDropdownUserEmail.textContent = userEmail;
            if (destBookingBadge) {
                destBookingBadge.textContent = bookingCount.toString();
                destBookingBadge.style.display = bookingCount > 0 ? 'inline-block' : 'none';
            }
        }
        else {
            // Logged Out
            document.documentElement.classList.remove('user-logged-in');
            if (document.body)
                document.body.classList.remove('user-logged-in');
            if (loginLi)
                loginLi.style.display = '';
            if (signupLi)
                signupLi.style.display = '';
            if (userLi) {
                userLi.style.setProperty('display', 'none', 'important');
            }
            if (destLoginBtn)
                destLoginBtn.style.display = '';
            if (destUserDropdown) {
                destUserDropdown.style.setProperty('display', 'none', 'important');
            }
            if (firstNameDisplay)
                firstNameDisplay.textContent = '';
            if (dropdownUserName)
                dropdownUserName.textContent = '';
            if (dropdownUserEmail)
                dropdownUserEmail.textContent = '';
        }
        bindNavbarEvents();
    }
    let navbarBound = false;
    function bindNavbarEvents() {
        if (navbarBound)
            return;
        navbarBound = true;
        const userProfileBtn = document.getElementById('userProfileBtn');
        const userProfileDropdown = document.getElementById('userProfileDropdown');
        const destUserProfileBtn = document.getElementById('destUserProfileBtn');
        const destUserProfileDropdown = document.getElementById('destUserProfileDropdown');
        if (typeof window.toggleUserNavDropdown !== 'function') {
            window.toggleUserNavDropdown = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof e.stopImmediatePropagation === 'function') {
                        e.stopImmediatePropagation();
                    }
                }
                const dropdown = document.getElementById('userProfileDropdown') || document.getElementById('destUserProfileDropdown');
                const btn = document.getElementById('userProfileBtn') || document.getElementById('destUserProfileBtn');
                if (!dropdown)
                    return;
                const isOpen = dropdown.classList.toggle('open');
                btn?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            };
        }
        if (userProfileBtn) {
            userProfileBtn.onclick = (e) => window.toggleUserNavDropdown(e);
        }
        if (destUserProfileBtn) {
            destUserProfileBtn.onclick = (e) => window.toggleUserNavDropdown(e);
        }
        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            const target = e.target;
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
        const handleOpenMyBookings = (e) => {
            e.preventDefault();
            userProfileDropdown?.classList.remove('open');
            destUserProfileDropdown?.classList.remove('open');
            openMyBookingsModal();
        };
        myBookingsBtn?.addEventListener('click', handleOpenMyBookings);
        destMyBookingsBtn?.addEventListener('click', handleOpenMyBookings);
        // Logout click with instant sync and redirect if on private page
        const logoutBtns = document.querySelectorAll('.dropdown-logout-btn, #navLogoutBtn, #destNavLogoutBtn');
        const handleLogout = (e) => {
            e.preventDefault();
            if (!confirm('Are you sure you want to log out of your Jadoo account?')) {
                return;
            }
            userProfileDropdown?.classList.remove('open');
            destUserProfileDropdown?.classList.remove('open');
            userProfileBtn?.setAttribute('aria-expanded', 'false');
            destUserProfileBtn?.setAttribute('aria-expanded', 'false');
            AuthService.logout();
            const isProtectedPage = window.location.pathname.includes('profile.html') || window.location.pathname.includes('ticket.html');
            if (isProtectedPage) {
                const homeUrl = window.location.pathname.includes('/components/') ? '../index.html' : './index.html';
                window.location.href = homeUrl;
            }
            else {
                if (typeof window.JadooToast !== 'undefined') {
                    window.JadooToast.show('Logged Out', 'You have been successfully logged out.', 'info');
                }
            }
        };
        if (typeof window.handleLogoutAction !== 'function') {
            window.handleLogoutAction = handleLogout;
        }
        logoutBtns.forEach(btn => {
            btn.onclick = (e) => {
                if (typeof window.handleLogoutAction === 'function') {
                    window.handleLogoutAction(e);
                }
                else {
                    handleLogout(e);
                }
            };
        });
        // Cross-tab and global synchronization
        if (!window._jadooGlobalAuthSyncBound) {
            window._jadooGlobalAuthSyncBound = true;
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
    function openBookingModal(details) {
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
        if (!modal)
            return;
        const isComponent = window.location.pathname.toLowerCase().includes('components');
        const fallbackImg = isComponent ? '../assets/destination-rome.png' : './assets/destination-rome.png';
        activeBookingDetails = {
            placeName: details.placeName || 'Iconic Sightseeing Tour',
            destination: details.destination || 'Top Destination',
            pricePerPerson: parseNumericPrice(details.price),
            image: details.image || fallbackImg
        };
        // Populate Preview
        const previewImg = document.getElementById('bookingPreviewImg');
        const previewDest = document.getElementById('bookingPreviewDestination');
        const previewTitle = document.getElementById('bookingPreviewTitle');
        const previewRate = document.getElementById('bookingPreviewRate');
        if (previewImg)
            previewImg.src = activeBookingDetails.image;
        if (previewDest)
            previewDest.textContent = activeBookingDetails.destination;
        if (previewTitle)
            previewTitle.textContent = activeBookingDetails.placeName;
        if (previewRate)
            previewRate.textContent = `$${activeBookingDetails.pricePerPerson.toFixed(0)}`;
        // Populate Form Fields
        const fullNameInput = document.getElementById('bookingFullName');
        const emailInput = document.getElementById('bookingEmail');
        const dateInput = document.getElementById('bookingDate');
        const guestsInput = document.getElementById('bookingGuests');
        const packageSelect = document.getElementById('bookingPackage');
        const requestsInput = document.getElementById('bookingRequests');
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
        if (guestsInput)
            guestsInput.value = '1';
        if (packageSelect)
            packageSelect.value = 'Standard';
        if (requestsInput)
            requestsInput.value = '';
        // Reset views
        const formContent = document.getElementById('bookingFormContent');
        const successView = document.getElementById('bookingSuccessView');
        if (formContent)
            formContent.style.display = 'block';
        if (successView)
            successView.style.display = 'none';
        // Clear error messages
        document.querySelectorAll('.booking-field-error').forEach(el => el.classList.remove('visible'));
        updateBookingPriceCalculation();
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }
    function closeBookingModal() {
        const modal = document.getElementById('bookingModalOverlay');
        if (!modal)
            return;
        if (typeof document !== 'undefined' && document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    function updateBookingPriceCalculation() {
        const guestsInput = document.getElementById('bookingGuests');
        const packageSelect = document.getElementById('bookingPackage');
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
        if (summaryGuests)
            summaryGuests.textContent = guests.toString();
        if (summaryBasePrice)
            summaryBasePrice.textContent = `$${basePrice.toFixed(0)}`;
        if (summarySubtotal)
            summarySubtotal.textContent = `$${subtotal.toFixed(2)}`;
        if (summaryTierRow) {
            if (multiplier > 1.0) {
                summaryTierRow.style.display = 'flex';
                if (summaryTierLabel)
                    summaryTierLabel.textContent = `${tierLabel} Upgrade:`;
                if (summaryTierAmount)
                    summaryTierAmount.textContent = `+$${tierDifference.toFixed(2)}`;
            }
            else {
                summaryTierRow.style.display = 'none';
            }
        }
        if (totalAmountEl)
            totalAmountEl.textContent = `$${total.toFixed(2)}`;
        return total;
    }
    function openMyBookingsModal() {
        const modal = document.getElementById('myBookingsModalOverlay');
        const list = document.getElementById('myBookingsList');
        if (!modal || !list)
            return;
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
        }
        else {
            list.innerHTML = bookings.map(b => {
                const item = b;
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
            list.querySelectorAll('[data-cancel-id]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const bookingId = btn.getAttribute('data-cancel-id');
                    if (!bookingId)
                        return;
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
    function closeMyBookingsModal() {
        const modal = document.getElementById('myBookingsModalOverlay');
        if (!modal)
            return;
        if (typeof document !== 'undefined' && document.activeElement && modal.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    let bookingSystemInitialized = false;
    function initBookingSystem() {
        if (bookingSystemInitialized)
            return;
        bookingSystemInitialized = true;
        const bookingModal = document.getElementById('bookingModalOverlay');
        const bookingClose = document.getElementById('bookingModalClose');
        const bookingCancel = document.getElementById('bookingCancelBtn');
        const bookingBackdrop = document.getElementById('bookingModalBackdrop');
        const tripBookingForm = document.getElementById('tripBookingForm');
        const todayIso = new Date().toISOString().split('T')[0];
        document.querySelectorAll('input[type="date"]').forEach(dInp => { dInp.min = todayIso; });
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
                if (bookingModal?.classList.contains('active'))
                    closeBookingModal();
                if (myBookingsModal?.classList.contains('active'))
                    closeMyBookingsModal();
            }
        });
        // Stepper buttons for guests
        const guestsInput = document.getElementById('bookingGuests');
        const minusBtn = document.getElementById('stepperMinusBtn');
        const plusBtn = document.getElementById('stepperPlusBtn');
        const packageSelect = document.getElementById('bookingPackage');
        minusBtn?.addEventListener('click', () => {
            if (!guestsInput)
                return;
            const current = parseInt(guestsInput.value || '1', 10);
            if (current > 1) {
                guestsInput.value = (current - 1).toString();
                updateBookingPriceCalculation();
            }
        });
        plusBtn?.addEventListener('click', () => {
            if (!guestsInput)
                return;
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
                showToastNotification('Authentication Required', 'You must be logged in to book a trip.', 'warning');
                const isComponent = window.location.pathname.toLowerCase().includes('components');
                setTimeout(() => {
                    window.location.href = isComponent ? 'auth.html#signin' : 'components/auth.html#signin';
                }, 1000);
                return;
            }
            const fullNameInput = document.getElementById('bookingFullName');
            const emailInput = document.getElementById('bookingEmail');
            const phoneInput = document.getElementById('bookingPhone');
            const dateInput = document.getElementById('bookingDate');
            const requestsInput = document.getElementById('bookingRequests');
            const nameVal = fullNameInput?.value.trim() || '';
            const emailVal = emailInput?.value.trim() || '';
            const dateVal = dateInput?.value || '';
            let isValid = true;
            const nameError = document.getElementById('bookingFullNameError');
            const emailError = document.getElementById('bookingEmailError');
            const dateError = document.getElementById('bookingDateError');
            if (!nameVal) {
                if (nameError)
                    nameError.classList.add('visible');
                isValid = false;
            }
            else {
                if (nameError)
                    nameError.classList.remove('visible');
            }
            if (!emailVal || !emailVal.includes('@')) {
                if (emailError)
                    emailError.classList.add('visible');
                isValid = false;
            }
            else {
                if (emailError)
                    emailError.classList.remove('visible');
            }
            const todayStr = new Date().toISOString().split('T')[0];
            if (!dateVal || dateVal < todayStr) {
                if (dateError) {
                    dateError.textContent = !dateVal ? 'Please choose a travel date.' : 'Travel date cannot be in the past.';
                    dateError.classList.add('visible');
                }
                isValid = false;
            }
            else {
                if (dateError)
                    dateError.classList.remove('visible');
            }
            if (!isValid)
                return;
            const guests = parseInt(guestsInput?.value || '1', 10);
            const packageVal = packageSelect?.value || 'Standard';
            const total = updateBookingPriceCalculation();
            const destName = activeBookingDetails.destination || 'your destination';
            const placeName = activeBookingDetails.placeName || '';
            const targetLabel = placeName ? `${placeName} (${destName})` : destName;
            const dateLabel = formatDateDisplay(dateVal);
            const guestLabel = `${guests} ${guests > 1 ? 'guests' : 'guest'}`;
            if (!confirm(`Are you sure you want to confirm your booking for ${targetLabel} on ${dateLabel} for ${guestLabel}? (Total: ${total.toFixed(2)})`)) {
                return;
            }
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
            if (successBookingId)
                successBookingId.textContent = `#${newBooking.id}`;
            if (successDestination)
                successDestination.textContent = newBooking.destination;
            if (successTripTitle)
                successTripTitle.textContent = newBooking.placeName;
            if (successDate)
                successDate.textContent = formatDateDisplay(newBooking.travelDate);
            if (successGuests)
                successGuests.textContent = `${newBooking.guests} ${newBooking.guests > 1 ? 'Guests' : 'Guest'}`;
            if (successPackage)
                successPackage.textContent = newBooking.packageType;
            if (successTotal)
                successTotal.textContent = `$${newBooking.totalPrice.toFixed(2)}`;
            if (formContent)
                formContent.style.display = 'none';
            if (successView)
                successView.style.display = 'block';
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
    // Default cached destinations saved immediately from the start
    const DEFAULT_CACHED_DESTINATIONS = [
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
    function getOrInitSavedDestinations() {
        let saved = Storage.get(STORAGE_KEYS.DESTINATIONS, null);
        if (!saved || !Array.isArray(saved) || saved.length === 0) {
            saved = DEFAULT_CACHED_DESTINATIONS;
            Storage.set(STORAGE_KEYS.DESTINATIONS, saved);
        }
        return saved;
    }
    let destinationCardsData = getOrInitSavedDestinations();
    let currentActivePlaceModal = null;
    function openPlaceModal(place) {
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
        const modalWikiLink = document.getElementById("modal-wiki-link");
        if (!modalOverlay)
            return;
        currentActivePlaceModal = place;
        if (modalBgCover) {
            modalBgCover.style.backgroundImage = `url("${place.image}")`;
        }
        if (modalBadge)
            modalBadge.textContent = place.badge || "Featured Landmark";
        if (modalRating)
            modalRating.textContent = place.rating.toFixed(1);
        if (modalReviews)
            modalReviews.textContent = `(${place.reviews.toLocaleString()} reviews)`;
        if (modalTitle)
            modalTitle.textContent = place.placeName;
        if (modalDestName)
            modalDestName.textContent = place.destination;
        if (modalDescription)
            modalDescription.textContent = place.description;
        if (modalDuration)
            modalDuration.textContent = place.duration;
        if (modalPrice)
            modalPrice.textContent = place.priceFormatted;
        if (modalWikiLink) {
            if (place.url) {
                modalWikiLink.href = place.url;
                modalWikiLink.style.display = "inline-flex";
            }
            else {
                modalWikiLink.style.display = "none";
            }
        }
        modalOverlay.classList.add("active");
        modalOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }
    function closePlaceModal() {
        const modalOverlay = document.getElementById("place-modal-overlay");
        if (!modalOverlay)
            return;
        if (typeof document !== 'undefined' && document.activeElement && modalOverlay.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        modalOverlay.classList.remove("active");
        modalOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }
    function bindDestinationCardEvents(cards) {
        const carouselCards = document.querySelectorAll('#carouselTrack .tcard');
        carouselCards.forEach((card, idx) => {
            const meta = cards[idx] || destinationCardsData[idx];
            if (!meta)
                return;
            // Details button click -> open Place Details Modal
            const viewBtn = card.querySelector('.place-view-btn');
            if (viewBtn) {
                const newViewBtn = viewBtn.cloneNode(true);
                viewBtn.parentNode?.replaceChild(newViewBtn, viewBtn);
                newViewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openPlaceModal(meta);
                });
            }
            // Book button click -> open Booking Form Modal
            const bookBtn = card.querySelector('.place-book-btn');
            if (bookBtn) {
                const newBookBtn = bookBtn.cloneNode(true);
                bookBtn.parentNode?.replaceChild(newBookBtn, bookBtn);
                newBookBtn.addEventListener('click', (e) => {
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
            card.onclick = (e) => {
                const carousel = document.getElementById('destCarousel');
                if (carousel?.classList.contains('is-dragging'))
                    return;
                if (e.target.closest('.place-book-btn') || e.target.closest('.place-view-btn')) {
                    return;
                }
                openPlaceModal(meta);
            };
        });
    }
    function renderDestinationCardsDOM(cards) {
        const carouselCards = document.querySelectorAll('#carouselTrack .tcard');
        carouselCards.forEach((card, idx) => {
            const meta = cards[idx];
            if (!meta)
                return;
            card.setAttribute('data-destination', meta.destination);
            const img = card.querySelector('.place-img');
            if (img && meta.image) {
                img.src = meta.image;
                img.alt = meta.placeName;
                img.onerror = () => {
                    img.onerror = null;
                    img.src = DEFAULT_CACHED_DESTINATIONS[idx]?.image || './assets/destination-rome.png';
                };
            }
            const badgeEl = card.querySelector('.place-badge');
            if (badgeEl)
                badgeEl.textContent = meta.badge;
            const ratingEl = card.querySelector('.place-rating');
            if (ratingEl)
                ratingEl.innerHTML = `<i class="fa-solid fa-star"></i> ${meta.rating.toFixed(1)}`;
            const reviewsEl = card.querySelector('.place-reviews');
            if (reviewsEl)
                reviewsEl.textContent = `(${meta.reviews.toLocaleString()} reviews)`;
            const durationEl = card.querySelector('.place-duration');
            if (durationEl)
                durationEl.textContent = `• ${meta.duration}`;
            const titleEl = card.querySelector('.place-title');
            if (titleEl)
                titleEl.textContent = meta.destination;
            const descEl = card.querySelector('.place-description');
            if (descEl)
                descEl.textContent = meta.description;
            const priceEl = card.querySelector('.place-price');
            if (priceEl)
                priceEl.textContent = meta.priceFormatted;
            const viewBtn = card.querySelector('.place-view-btn');
            if (viewBtn)
                viewBtn.setAttribute('aria-label', `View details for ${meta.destination}`);
            const bookBtn = card.querySelector('.place-book-btn');
            if (bookBtn)
                bookBtn.setAttribute('aria-label', `Book ${meta.destination}`);
        });
        bindDestinationCardEvents(cards);
    }
    async function fetchAndSyncLiveDestinations() {
        // Pure client-side synchronization via JadooDB (no localhost or backend server needed)
        try {
            if (typeof window !== 'undefined' && window.JadooDB) {
                const jadooDB = window.JadooDB;
                const dbDestinations = jadooDB.getDestinations();
                let hasUpdates = false;
                if (Array.isArray(dbDestinations) && dbDestinations.length > 0) {
                    destinationCardsData.forEach((card) => {
                        const matchedDest = dbDestinations.find((d) => {
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
        }
        catch (_) {
            // Silently maintain existing destination cards
        }
    }
    function initHomepageBookingTriggers() {
        const modalOverlay = document.getElementById("place-modal-overlay");
        const modalCloseBtn = document.getElementById("modal-close-btn");
        const modalBookCta = document.getElementById("modal-book-cta");
        modalCloseBtn?.addEventListener("click", closePlaceModal);
        modalOverlay?.addEventListener("click", (e) => {
            if (e.target === modalOverlay || e.target.classList.contains("place-modal-backdrop")) {
                closePlaceModal();
            }
        });
        window.addEventListener("keydown", (e) => {
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
        const greeceCard = document.querySelector('.fcard');
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
    function restoreFormDrafts() {
        const drafts = Storage.get(STORAGE_KEYS.DRAFTS, {}) ?? {};
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
        const cachedUsers = Storage.get(STORAGE_KEYS.USERS, []);
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
            const inputEl = document.getElementById(id);
            if (inputEl) {
                // Restore saved value if available
                if (drafts[id] !== undefined && drafts[id] !== '') {
                    inputEl.value = drafts[id];
                }
                // Auto-save safe non-sensitive fields
                inputEl.addEventListener('input', () => {
                    const currentDrafts = Storage.get(STORAGE_KEYS.DRAFTS, {}) ?? {};
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
    function initAuthForms() {
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
                        if (!confirm('Are you sure you want to log out of your Jadoo account?')) {
                            return;
                        }
                        AuthService.logout();
                        banner.style.display = 'none';
                        showToastNotification('Logged Out', 'You have logged out successfully.', 'info');
                        setTimeout(() => window.location.reload(), 1000);
                    });
                }
            }
            else {
                banner.style.display = 'none';
            }
        }
        // Initialize Remembered Account on Sign In form
        initRememberedAccount();
        // 1. Sign Up
        const signupForm = (document.getElementById('signupForm') || document.querySelector('.signup-form form'));
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = (document.getElementById('signup-fullname') || signupForm.querySelector('input[type="text"]'));
                const emailInput = (document.getElementById('signup-email') || signupForm.querySelector('input[type="email"]'));
                const passwordInput = (document.getElementById('signup-password') || signupForm.querySelector('input[type="password"]'));
                const submitBtn = signupForm.querySelector('button[type="submit"]');
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
                        const drafts = Storage.get(STORAGE_KEYS.DRAFTS, {}) ?? {};
                        drafts['user-id'] = email;
                        Storage.set(STORAGE_KEYS.DRAFTS, drafts);
                        showToastNotification('Account Created!', `Welcome, ${name}! Your account has been saved.`, 'success');
                        const isComponent = window.location.pathname.toLowerCase().includes('components');
                        setTimeout(() => {
                            window.location.href = isComponent ? '../index.html' : 'index.html';
                        }, 1000);
                    }
                    else {
                        showToastNotification('Registration Incomplete', result.message, 'warning');
                    }
                }
                finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitBtn.getAttribute('data-orig-text') || 'Sign Up';
                    }
                }
            });
        }
        // 2. Sign In
        const signinForm = (document.getElementById('signinForm') || document.querySelector('.signin-form form'));
        if (signinForm) {
            signinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const idInput = (document.getElementById('user-id') || signinForm.querySelector('input[type="text"], input[type="email"]'));
                const passwordInput = (document.getElementById('signin-password') || signinForm.querySelector('input[type="password"]'));
                const submitBtn = signinForm.querySelector('button[type="submit"]');
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
                        showToastNotification('Welcome Back!', `Glad to see you again, ${result.user.fullName}!`, 'success');
                        const isComponent = window.location.pathname.toLowerCase().includes('components');
                        setTimeout(() => {
                            window.location.href = isComponent ? '../index.html' : 'index.html';
                        }, 1000);
                    }
                    else {
                        showToastNotification('Sign In Failed', result.message, 'error');
                    }
                }
                finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitBtn.getAttribute('data-orig-text') || 'Login';
                    }
                }
            });
        }
    }
    function initRememberedAccount() {
        const promptContainer = document.getElementById('rememberedAccountPrompt');
        const userIdGroup = document.getElementById('userIdGroup');
        const userIdInput = document.getElementById('user-id');
        const passwordInput = document.getElementById('signin-password');
        const signinForm = document.getElementById('signinForm');
        const signinLabel = document.getElementById('signinLabel');
        const submitBtn = document.getElementById('signin-submit-btn');
        if (!promptContainer || !userIdInput || !signinForm)
            return;
        const currentUser = AuthService.getCurrentUser();
        if (currentUser) {
            promptContainer.style.display = 'none';
            if (userIdGroup)
                userIdGroup.style.display = '';
            return;
        }
        const lastAccount = Storage.get(STORAGE_KEYS.LAST_ACCOUNT);
        if (!lastAccount || !lastAccount.email) {
            promptContainer.style.display = 'none';
            if (userIdGroup)
                userIdGroup.style.display = '';
            return;
        }
        const activeAccount = {
            id: lastAccount.id,
            email: lastAccount.email,
            fullName: lastAccount.fullName || 'User'
        };
        const firstName = activeAccount.fullName.split(' ')[0] || 'User';
        function renderRememberedMode() {
            if (!promptContainer)
                return;
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
                if (window.AuthValidation?.clearError) {
                    window.AuthValidation.clearError(userIdInput);
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
            switchBtn?.addEventListener('click', (e) => {
                e.preventDefault();
                renderManualMode();
            });
        }
        function renderManualMode() {
            if (!promptContainer)
                return;
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
    function initNewsletter() {
        const form = document.getElementById('subscribeForm');
        const emailInput = document.getElementById('subscribeEmail');
        if (!form || !emailInput)
            return;
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email)
                return;
            const subscribers = Storage.get('jadoo_newsletter_subscribers', []) ?? [];
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
                }).catch(() => { });
            }
            catch (_) { }
            emailInput.value = '';
            showToastNotification('Subscribed!', `Thank you for subscribing to Jadoo updates! (${email})`, 'success');
        });
    }
    function initDemoPlayer() {
        const demoBtn = document.getElementById('playDemoBtn');
        if (!demoBtn)
            return;
        demoBtn.addEventListener('click', () => {
            showToastNotification('Jadoo Experience Demo', 'Explore top destinations, book curated flights & hotels, and manage your travel itineraries in one click!', 'info', 5000);
        });
    }
    // Scroll Reveal Observer Engine
    function initScrollReveal() {
        const revealElements = document.querySelectorAll('[data-reveal]');
        if (!revealElements.length)
            return;
        if (!('IntersectionObserver' in window)) {
            revealElements.forEach(el => el.classList.add('is-revealed'));
            return;
        }
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        revealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
                el.classList.add('is-revealed');
            }
            else {
                revealObserver.observe(el);
            }
        });
        // Failsafe: reveal any remaining hidden elements automatically
        setTimeout(() => {
            document.querySelectorAll('[data-reveal]:not(.is-revealed)').forEach(el => {
                el.classList.add('is-revealed');
            });
        }, 1200);
    }
    // Helper to execute when DOM is ready safely
    function onReady(callback) {
        if (document.readyState !== 'loading') {
            callback();
        }
        else {
            document.addEventListener('DOMContentLoaded', callback);
        }
    }
    (function initDarkTheme() {
        const html = document.documentElement;
        const DARK_KEY = 'jadoo_dark_theme';
        function getElements() {
            return {
                floatingBtn: document.getElementById('themeToggle'),
                floatingIcon: document.getElementById('themeIcon'),
                navBtn: document.getElementById('navThemeToggle')
            };
        }
        function applyTheme(isDark) {
            if (isDark) {
                html.setAttribute('data-theme', 'dark');
            }
            else {
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
        function resolveInitialTheme() {
            const saved = Storage.get(STORAGE_KEYS.THEME, null);
            if (saved !== null) {
                return saved === true || saved === 'true';
            }
            const rawLocal = localStorage.getItem(DARK_KEY);
            if (rawLocal !== null) {
                return rawLocal === 'true';
            }
            const cookieVal = CookieStorage.get(DARK_KEY);
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
            function toggleTheme(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (typeof window !== 'undefined' && window.JadooTheme) {
                    window.JadooTheme.toggle();
                    isDark = window.JadooTheme.isDark();
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
            window.addEventListener('jadoo:theme_change', (e) => {
                if (e.detail && typeof e.detail.isDark === 'boolean') {
                    isDark = e.detail.isDark;
                    applyTheme(isDark);
                }
            });
            // Instant Multi-Tab / Multi-Window Synchronization
            window.addEventListener('storage', (e) => {
                if (e.key === DARK_KEY || e.key === STORAGE_KEYS.THEME) {
                    let val = e.newValue;
                    try {
                        val = JSON.parse(e.newValue || '');
                    }
                    catch (_) { }
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
                    const langSelect = document.getElementById('lang');
                    if (langSelect && e.newValue) {
                        try {
                            langSelect.value = JSON.parse(e.newValue);
                        }
                        catch (err) {
                            langSelect.value = e.newValue;
                        }
                    }
                }
            });
            // Listen for OS system theme changes
            if (window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                    if (localStorage.getItem(DARK_KEY) === null && CookieStorage.get(DARK_KEY) === null) {
                        isDark = e.matches;
                        applyTheme(isDark);
                    }
                });
            }
        });
    })();
    (function initCarousel() {
        onReady(() => {
            const track = document.getElementById('carouselTrack');
            const carousel = document.getElementById('destCarousel');
            const prevBtn = document.getElementById('carouselPrev');
            const nextBtn = document.getElementById('carouselNext');
            const dotsContainer = document.getElementById('carouselDots');
            const progressBar = document.getElementById('carouselProgressBar');
            if (!track || !carousel)
                return;
            const cards = Array.from(track.querySelectorAll('.tcard'));
            const TOTAL = cards.length;
            if (TOTAL === 0)
                return;
            let currentIndex = 0;
            let autoPlayTimer = null;
            let isDragging = false;
            let dragStartX = 0;
            let dragStartY = 0;
            let initialTranslate = 0;
            let currentTranslate = 0;
            let dragStartTime = 0;
            let hasDragged = false;
            function getCardsVisible() {
                if (window.innerWidth <= 768)
                    return 1;
                if (window.innerWidth <= 1024)
                    return 2;
                return 3;
            }
            function maxIndex() {
                return Math.max(0, TOTAL - getCardsVisible());
            }
            function getCardWidth() {
                if (!cards[0] || !track)
                    return 0;
                const rect = cards[0].getBoundingClientRect();
                const style = window.getComputedStyle(track);
                const gap = parseFloat(style.gap) || 24;
                return rect.width + gap;
            }
            // Build dynamic dots
            function buildDots() {
                if (!dotsContainer)
                    return;
                dotsContainer.innerHTML = '';
                const maxIdx = maxIndex();
                for (let i = 0; i <= maxIdx; i++) {
                    const dot = document.createElement('button');
                    dot.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
                    dot.setAttribute('aria-label', `Go to destination slide ${i + 1}`);
                    dot.setAttribute('role', 'tab');
                    dot.setAttribute('aria-selected', (i === currentIndex).toString());
                    dot.addEventListener('click', (e) => {
                        e.stopPropagation();
                        resetAutoPlay();
                        goTo(i);
                    });
                    dotsContainer.appendChild(dot);
                }
            }
            function updateDots(index) {
                if (!dotsContainer)
                    return;
                const dots = dotsContainer.querySelectorAll('.carousel-dot');
                dots.forEach((d, i) => {
                    const isActive = i === index;
                    d.classList.toggle('active', isActive);
                    d.setAttribute('aria-selected', isActive.toString());
                });
            }
            function updateProgressBar(index) {
                if (!progressBar)
                    return;
                const maxIdx = maxIndex();
                const pct = maxIdx === 0 ? 100 : Math.min(100, Math.max(16, ((index + 1) / (maxIdx + 1)) * 100));
                progressBar.style.width = pct + '%';
            }
            function updateActiveCards(index) {
                const visible = getCardsVisible();
                cards.forEach((c, idx) => {
                    // In 3-card view, highlight center visible card; otherwise active card
                    const centerIdx = visible === 3 ? index + 1 : index;
                    c.classList.toggle('is-active', idx === centerIdx);
                });
            }
            function goTo(index, smooth = true) {
                if (!track)
                    return;
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
            function next() {
                const maxIdx = maxIndex();
                if (currentIndex >= maxIdx) {
                    goTo(0);
                }
                else {
                    goTo(currentIndex + 1);
                }
            }
            function prev() {
                const maxIdx = maxIndex();
                if (currentIndex <= 0) {
                    goTo(maxIdx);
                }
                else {
                    goTo(currentIndex - 1);
                }
            }
            if (prevBtn) {
                prevBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    resetAutoPlay();
                    prev();
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    resetAutoPlay();
                    next();
                });
            }
            // Keyboard navigation
            document.addEventListener('keydown', (e) => {
                const activeEl = document.activeElement;
                if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName))
                    return;
                if (e.key === 'ArrowLeft') {
                    resetAutoPlay();
                    prev();
                }
                if (e.key === 'ArrowRight') {
                    resetAutoPlay();
                    next();
                }
            });
            // Interactive Pointer / Mouse / Touch Drag
            function startDrag(clientX, clientY, isTouch, e) {
                if (!track || !carousel)
                    return;
                const targetEl = e.target;
                if (targetEl && targetEl.closest('.carousel-btn'))
                    return;
                isDragging = true;
                hasDragged = false;
                dragStartX = clientX;
                dragStartY = clientY;
                dragStartTime = Date.now();
                const cardWidth = getCardWidth();
                initialTranslate = -(currentIndex * cardWidth);
                currentTranslate = initialTranslate;
                track.style.transition = 'none';
                carousel.classList.add('is-dragging');
                stopAutoPlay();
            }
            function moveDrag(clientX, clientY, isTouch, e) {
                if (!isDragging || !track || !carousel)
                    return;
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
                    if (e.cancelable)
                        e.preventDefault();
                }
                const maxIdx = maxIndex();
                const cardWidth = getCardWidth();
                const minTranslate = -(maxIdx * cardWidth);
                const maxTranslate = 0;
                let newTranslate = initialTranslate + diffX;
                // Elastic rubber-banding past boundaries
                if (newTranslate > maxTranslate) {
                    newTranslate = maxTranslate + (newTranslate - maxTranslate) * 0.25;
                }
                else if (newTranslate < minTranslate) {
                    newTranslate = minTranslate + (newTranslate - minTranslate) * 0.25;
                }
                currentTranslate = newTranslate;
                track.style.transform = `translateX(${currentTranslate}px)`;
            }
            function endDrag(clientX) {
                if (!isDragging || !carousel)
                    return;
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
                    }
                    else {
                        goTo(0);
                    }
                }
                else if (diffX > threshold || (isFlick && diffX > 20)) {
                    if (currentIndex > 0) {
                        goTo(currentIndex - 1);
                    }
                    else {
                        goTo(maxIdx);
                    }
                }
                else {
                    goTo(currentIndex);
                }
                startAutoPlay();
                setTimeout(() => { hasDragged = false; }, 80);
            }
            // Mouse Events
            carousel.addEventListener('mousedown', (e) => {
                if (e.button !== 0)
                    return; // Only left-click
                startDrag(e.clientX, e.clientY, false, e);
            });
            window.addEventListener('mousemove', (e) => {
                if (!isDragging)
                    return;
                moveDrag(e.clientX, e.clientY, false, e);
            });
            window.addEventListener('mouseup', (e) => {
                if (!isDragging)
                    return;
                endDrag(e.clientX);
            });
            // Touch Events
            track.addEventListener('touchstart', (e) => {
                if (e.touches.length !== 1)
                    return;
                startDrag(e.touches[0].clientX, e.touches[0].clientY, true, e);
            }, { passive: true });
            track.addEventListener('touchmove', (e) => {
                if (!isDragging || e.touches.length !== 1)
                    return;
                moveDrag(e.touches[0].clientX, e.touches[0].clientY, true, e);
            }, { passive: false });
            track.addEventListener('touchend', (e) => {
                if (!isDragging)
                    return;
                endDrag(e.changedTouches[0].clientX);
            }, { passive: true });
            // Suppress card click if dragged
            cards.forEach((card, idx) => {
                card.addEventListener('click', (e) => {
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
            function startAutoPlay() {
                stopAutoPlay();
                autoPlayTimer = setInterval(next, 4500);
            }
            function stopAutoPlay() {
                if (autoPlayTimer)
                    clearInterval(autoPlayTimer);
            }
            function resetAutoPlay() {
                stopAutoPlay();
                startAutoPlay();
            }
            const carouselWrapper = (document.querySelector('.carousel-wrapper') || carousel);
            carouselWrapper.addEventListener('mouseenter', stopAutoPlay);
            carouselWrapper.addEventListener('mouseleave', startAutoPlay);
            // Pause autoplay when browser tab is inactive
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    stopAutoPlay();
                }
                else {
                    startAutoPlay();
                }
            });
            // Window resize with debounce
            let resizeTimeout;
            window.addEventListener('resize', () => {
                if (resizeTimeout)
                    clearTimeout(resizeTimeout);
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
    (function initTestimonials() {
        onReady(() => {
            const dotsSvg = document.querySelector('.testimonial-dots-svg');
            const cardsContainer = document.querySelector('.coms');
            let cards = Array.from(document.querySelectorAll('.coms .com'));
            const arrowUp = document.getElementById('tArrowUp');
            const arrowDown = document.getElementById('tArrowDown');
            if (!cards.length)
                return;
            let circles = dotsSvg ? Array.from(dotsSvg.querySelectorAll('circle')) : [];
            let currentIndex = 0;
            let autoPlayTimer = null;
            function getOffsets() {
                const isMobile = window.innerWidth <= 650;
                const isTablet = window.innerWidth <= 768;
                return {
                    stepX: isMobile ? 12 : isTablet ? 18 : 26,
                    stepY: isMobile ? 18 : isTablet ? 30 : 45
                };
            }
            function setTestimonial(idx, animate = true) {
                const total = cards.length;
                currentIndex = ((idx % total) + total) % total;
                // 1. Update SVG Pagination Dots
                circles.forEach((circle, i) => {
                    if (i === currentIndex) {
                        circle.setAttribute('class', 'dot-active');
                    }
                    else {
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
                    }
                    else {
                        card.style.transition = 'none';
                    }
                    if (rel === 0) {
                        card.classList.add('is-front');
                        card.style.zIndex = '5';
                        card.style.opacity = '1';
                        card.style.transform = 'translate(0px, 0px) scale(1)';
                        card.setAttribute('aria-hidden', 'false');
                    }
                    else if (rel === 1) {
                        card.classList.add('is-middle');
                        card.style.zIndex = '3';
                        card.style.opacity = window.innerWidth <= 650 ? '0.5' : '0.6';
                        card.style.transform = `translate(${stepX}px, ${stepY}px) scale(0.96)`;
                        card.setAttribute('aria-hidden', 'true');
                    }
                    else {
                        card.classList.add('is-back');
                        card.style.zIndex = '1';
                        card.style.opacity = window.innerWidth <= 650 ? '0.2' : '0.28';
                        card.style.transform = `translate(${stepX * 2}px, ${stepY * 2}px) scale(0.92)`;
                        card.setAttribute('aria-hidden', 'true');
                    }
                });
            }
            function nextTestimonial() {
                setTestimonial(currentIndex + 1);
            }
            function prevTestimonial() {
                setTestimonial(currentIndex - 1);
            }
            function startAuto() {
                stopAuto();
                autoPlayTimer = setInterval(nextTestimonial, 6500);
            }
            function stopAuto() {
                if (autoPlayTimer)
                    clearInterval(autoPlayTimer);
            }
            function resetAuto() {
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
                arrowUp.addEventListener('click', (e) => {
                    e.preventDefault();
                    prevTestimonial();
                    resetAuto();
                });
            }
            if (arrowDown) {
                arrowDown.addEventListener('click', (e) => {
                    e.preventDefault();
                    nextTestimonial();
                    resetAuto();
                });
            }
            // Touch swipe gestures on cards container
            if (cardsContainer) {
                let touchStartX = 0;
                let touchStartY = 0;
                cardsContainer.addEventListener('touchstart', (e) => {
                    if (e.touches.length === 1) {
                        touchStartX = e.touches[0].clientX;
                        touchStartY = e.touches[0].clientY;
                        stopAuto();
                    }
                }, { passive: true });
                cardsContainer.addEventListener('touchend', (e) => {
                    if (e.changedTouches.length === 1) {
                        const diffX = e.changedTouches[0].clientX - touchStartX;
                        const diffY = e.changedTouches[0].clientY - touchStartY;
                        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                            if (diffX < 0)
                                nextTestimonial();
                            else
                                prevTestimonial();
                        }
                        else if (Math.abs(diffY) > 35 && Math.abs(diffY) > Math.abs(diffX)) {
                            if (diffY < 0)
                                nextTestimonial();
                            else
                                prevTestimonial();
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
                if (document.hidden)
                    stopAuto();
                else
                    startAuto();
            });
            function refreshStack() {
                cards = Array.from(document.querySelectorAll('.coms .com'));
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
                    circles = Array.from(dotsSvg.querySelectorAll('circle'));
                }
                setTestimonial(0, true);
            }
            function syncTestimonialCardsFromDB() {
                if (!cardsContainer || typeof window.JadooDB === 'undefined')
                    return;
                const items = window.JadooDB.getTestimonials();
                if (!Array.isArray(items) || items.length === 0)
                    return;
                cardsContainer.innerHTML = items.map((t, idx) => {
                    const ratingNum = parseFloat(t.rating) || 5.0;
                    const fullStars = Math.floor(ratingNum);
                    const hasHalf = ratingNum % 1 !== 0;
                    let starsHtml = '';
                    for (let s = 0; s < fullStars; s++)
                        starsHtml += '<i class="fa-solid fa-star"></i>';
                    if (hasHalf)
                        starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
                    const avatar = t.avatar_url || './assets/testimonials-avatar-1.png';
                    const role = t.author_role || t.role_title || 'Verified Traveler';
                    const initialClass = idx === 0 ? 'is-front' : idx === 1 ? 'is-middle' : 'is-back';
                    return `
                        <div class="com ${initialClass}" data-testimonial="${idx}">
                          <div class="ficimg">
                            <img src="${avatar}" alt="${t.author_name} portrait" draggable="false" onerror="this.src='./assets/testimonials-avatar-1.png'">
                          </div>
                          <div class="ctext">
                            <div class="cmeta">
                              <div class="crating">
                                ${starsHtml}
                                <span>${ratingNum.toFixed(1)}</span>
                              </div>
                              <span class="cbadge"><i class="fa-solid fa-shield-heart"></i> ${t.role_title || role}</span>
                            </div>
                            <div class="cp">&ldquo;${t.quote}&rdquo;</div>
                            <div class="cauthor-row">
                              <div class="cauthor-info">
                                <div class="cn">${t.author_name}</div>
                                <div class="cl">${t.author_location || ''}</div>
                              </div>
                              <div class="ctrip-tag">
                                <i class="fa-solid fa-location-dot"></i> ${t.trip_tag || t.destination_name || 'World Tour'}
                              </div>
                            </div>
                          </div>
                        </div>
                    `;
                }).join('');
                refreshStack();
            }
            // Sync with DB/localStorage if available
            if (typeof window.JadooDB !== 'undefined') {
                syncTestimonialCardsFromDB();
            }
            // Real-time update when user shares or updates review
            window.addEventListener('jadoo:new_testimonial', () => {
                syncTestimonialCardsFromDB();
                resetAuto();
            });
            window.addEventListener('jadoo:db_change', (e) => {
                if (!e?.detail || e.detail.key === 'testimonials') {
                    syncTestimonialCardsFromDB();
                    resetAuto();
                }
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
