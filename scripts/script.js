"use strict";
(function () {
    'use strict';
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
            if (!user && typeof localStorage !== 'undefined') {
                user = Storage.get(STORAGE_KEYS.LAST_ACCOUNT, null);
            }
            if (!user) {
                return {
                    id: 'user_alex_johnson',
                    fullName: 'Alex Johnson',
                    email: 'alex.traveler@example.com',
                    password: '',
                    createdAt: '2026-01-15T08:00:00.000Z'
                };
            }
            return user;
        },
        isAuthenticated() {
            return this.getCurrentUser() !== null;
        },
        signUp(fullName, email, password) {
            const cleanName = (fullName || '').trim();
            const cleanEmail = (email || '').trim().toLowerCase();
            if (!cleanName || !cleanEmail || !password) {
                return { success: false, message: 'Please fill out all fields.' };
            }
            const users = this.getUsers();
            const existing = users.find(u => u.email === cleanEmail);
            if (existing) {
                return { success: false, message: 'An account with this email already exists.' };
            }
            const newUser = {
                id: 'user_' + Date.now(),
                fullName: cleanName,
                email: cleanEmail,
                password: password,
                createdAt: new Date().toISOString()
            };
            users.push(newUser);
            Storage.set(STORAGE_KEYS.USERS, users);
            // Remember account for next login
            Storage.set(STORAGE_KEYS.LAST_ACCOUNT, {
                id: newUser.id,
                email: newUser.email,
                fullName: newUser.fullName
            });
            // Keep session active
            this.createSession(newUser);
            try {
                if (typeof window.JadooDB !== 'undefined') {
                    window.JadooDB.setCurrentUser({
                        id: newUser.id,
                        full_name: newUser.fullName,
                        email: newUser.email
                    });
                }
            }
            catch (_) { }
            return { success: true, message: 'Account created successfully!', user: newUser };
        },
        signIn(identifier, password) {
            const cleanId = (identifier || '').trim().toLowerCase();
            const users = this.getUsers();
            if (!cleanId || !password) {
                return { success: false, message: 'Please enter your email and password.' };
            }
            const user = users.find(u => (u.email === cleanId || u.id === cleanId || u.fullName.toLowerCase() === cleanId) && u.password === password);
            if (!user) {
                return { success: false, message: 'Invalid credentials. Please verify your email/ID and password.' };
            }
            // Remember account for future logins
            Storage.set(STORAGE_KEYS.LAST_ACCOUNT, {
                id: user.id,
                email: user.email,
                fullName: user.fullName
            });
            this.createSession(user);
            try {
                if (typeof window.JadooDB !== 'undefined') {
                    window.JadooDB.setCurrentUser({
                        id: user.id,
                        full_name: user.fullName,
                        email: user.email
                    });
                }
            }
            catch (_) { }
            return { success: true, message: 'Logged in successfully!', user };
        },
        createSession(user) {
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('jadoo_logged_out');
            }
            const sessionUser = {
                id: user.id,
                fullName: user.fullName,
                full_name: user.fullName,
                email: user.email,
                avatar_url: user.avatar_url || './assets/testimonials-avatar-1.png',
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
            return Storage.get(STORAGE_KEYS.BOOKINGS, []) ?? [];
        },
        getUserBookings(emailOrId) {
            const all = this.getAllBookings();
            if (!emailOrId) {
                const user = AuthService.getCurrentUser();
                if (user) {
                    return all.filter(b => b.userEmail.toLowerCase() === user.email.toLowerCase() || b.userId === user.id);
                }
                return all;
            }
            const clean = emailOrId.toLowerCase().trim();
            return all.filter(b => b.userEmail.toLowerCase() === clean || b.userId === clean);
        },
        createBooking(data) {
            const bookings = this.getAllBookings();
            const newBooking = {
                ...data,
                id: 'BK-' + Math.floor(100000 + Math.random() * 900000),
                status: 'Confirmed',
                createdAt: new Date().toISOString()
            };
            bookings.unshift(newBooking);
            Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
            updateNavbarAuthState();
            window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_bookings' } }));
            return newBooking;
        },
        cancelBooking(id) {
            const bookings = this.getAllBookings();
            const target = bookings.find(b => b.id === id);
            if (target) {
                target.status = 'Cancelled';
                Storage.set(STORAGE_KEYS.BOOKINGS, bookings);
                updateNavbarAuthState();
                window.dispatchEvent(new CustomEvent('jadoo:db_change', { detail: { key: 'jadoo_bookings' } }));
                return true;
            }
            return false;
        },
        count(emailOrId) {
            return this.getUserBookings(emailOrId).filter(b => b.status === 'Confirmed').length;
        }
    };
    window.JadooStorage = Storage;
    window.JadooAuth = AuthService;
    window.JadooBooking = BookingService;
    document.addEventListener('DOMContentLoaded', () => {
        // --- A. Mobile Drawer Navigation ---
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
                hamburger.setAttribute('aria-expanded', willBeActive ? 'true' : 'false');
            };
            navLinks.forEach((link) => {
                link.onclick = () => {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                };
            });
            if (!window._scriptHamburgerDocClick) {
                window._scriptHamburgerDocClick = true;
                document.addEventListener('click', (e) => {
                    const target = e.target;
                    if (target && !navMenu.contains(target) && !hamburger.contains(target) && navMenu.classList.contains('active')) {
                        hamburger.classList.remove('active');
                        navMenu.classList.remove('active');
                        hamburger.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        }
        // --- B. Language Preference Persistence ---
        const langSelect = document.getElementById('lang');
        if (langSelect) {
            const savedLang = Storage.get(STORAGE_KEYS.LANGUAGE);
            if (savedLang) {
                langSelect.value = savedLang;
            }
            langSelect.addEventListener('change', (e) => {
                const target = e.target;
                if (target) {
                    Storage.set(STORAGE_KEYS.LANGUAGE, target.value);
                }
            });
        }
        // --- C. Update Navbar for Logged-In User ---
        updateNavbarAuthState();
        // --- D. Form Handlers & Input Auto-Save/Restore ---
        initAuthForms();
        restoreFormDrafts();
        // --- E. Newsletter Subscription & Demo Player ---
        initNewsletter();
        initDemoPlayer();
        // --- F. Scroll Reveal Engine ---
        initScrollReveal();
        // --- G. Trip Booking System & Homepage Card Triggers ---
        initBookingSystem();
        initHomepageBookingTriggers();
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
        if (isAuthenticated) {
            document.documentElement.classList.add('user-logged-in');
            if (document.body)
                document.body.classList.add('user-logged-in');
            const fullName = currentUser ? currentUser.fullName : 'Alex Johnson';
            const userEmail = currentUser ? currentUser.email : 'alex.traveler@example.com';
            const firstName = fullName.split(' ')[0] || 'Alex';
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
            const navAvatarImg = document.getElementById('navUserAvatarImg');
            if (navAvatarImg) {
                const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
                navAvatarImg.src = isComp ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png';
                navAvatarImg.style.display = 'block';
            }
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
        const currentUser = AuthService.getCurrentUser();
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
            list.innerHTML = bookings.map(b => `
                <div class="booking-item-card" data-id="${b.id}">
                    <div class="booking-item-img">
                        <img src="${b.image || fallbackImg}" alt="${b.placeName}" onerror="this.src='${fallbackImg}'">
                        <span class="booking-status-tag"><i class="fa-solid fa-circle-check"></i> ${b.status}</span>
                    </div>
                    <div class="booking-item-info">
                        <div class="booking-ref-row">
                            <span class="booking-ref-badge">${b.id}</span>
                            <span class="booking-package-badge">${b.packageType || 'Standard'}</span>
                        </div>
                        <h3 class="booking-place-title">${b.placeName}</h3>
                        <p class="booking-destination-meta"><i class="fa-solid fa-location-dot"></i> ${b.destination}</p>
                        <div class="booking-meta-row">
                            <span><i class="fa-regular fa-calendar"></i> ${formatDateDisplay(b.travelDate)}</span>
                            <span><i class="fa-solid fa-user-group"></i> ${b.guests} ${b.guests > 1 ? 'Guests' : 'Guest'}</span>
                            <span class="booking-price-highlight">$${b.totalPrice.toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="booking-item-actions">
                        <button type="button" class="btn-cancel-trip" data-cancel-id="${b.id}" title="Cancel this booking">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Cancel</span>
                        </button>
                    </div>
                </div>
            `).join('');
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
            if (!dateVal) {
                if (dateError)
                    dateError.classList.add('visible');
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
            const currentUser = AuthService.getCurrentUser();
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
        const cities = ['Rome', 'London', 'Paris', 'Santorini', 'Venice', 'Tokyo'];
        let hasUpdates = false;
        // Smart port detection: if running on port 3000/3001, use same-origin; otherwise try localhost:3000 then 3001
        const isSameOriginNode = typeof window !== 'undefined' && (window.location.port === '3000' || window.location.port === '3001');
        const candidateBases = isSameOriginNode
            ? ['', 'http://localhost:3000', 'http://localhost:3001']
            : ['http://localhost:3000', 'http://localhost:3001'];
        // Probe for an active API server before firing multiple requests
        let activeBase = null;
        for (const base of candidateBases) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 1200);
                const probeRes = await fetch(`${base}/api/destination?name=Rome`, { signal: controller.signal }).catch(() => null);
                clearTimeout(timeoutId);
                if (probeRes && probeRes.ok) {
                    activeBase = base;
                    break;
                }
            }
            catch {
                // Next port
            }
        }
        if (activeBase === null) {
            // Backend server is not running or unreachable; seamlessly rely on cached & JadooDB destinations without logging 404s
            return;
        }
        for (let i = 0; i < cities.length; i++) {
            const city = cities[i];
            try {
                const response = await fetch(`${activeBase}/api/destination?name=${encodeURIComponent(city)}`);
                if (!response.ok)
                    continue;
                const data = await response.json();
                if (data && Array.isArray(data.places) && data.places.length > 0) {
                    const topPlace = data.places[0];
                    const existing = destinationCardsData[i] || DEFAULT_CACHED_DESTINATIONS[i];
                    const countryDisplay = data.country && data.country !== data.destination
                        ? (data.country === 'IT' ? 'Italy' : data.country === 'GB' ? 'UK' : data.country === 'FR' ? 'France' : data.country === 'JP' ? 'Japan' : data.country)
                        : (existing.destination.split(',')[1]?.trim() || city);
                    const priceNum = typeof topPlace.amount === 'number' && topPlace.amount > 0
                        ? topPlace.amount
                        : existing.price;
                    const priceStr = topPlace.price
                        ? topPlace.price
                        : (topPlace.amount ? `$${topPlace.amount}` : existing.priceFormatted);
                    const cleanDesc = topPlace.description
                        ? (topPlace.description.length > 130 ? topPlace.description.slice(0, 127) + '...' : topPlace.description)
                        : existing.description;
                    destinationCardsData[i] = {
                        cityKey: city,
                        placeName: topPlace.name || existing.placeName,
                        destination: `${city}, ${countryDisplay}`,
                        price: priceNum,
                        priceFormatted: priceStr,
                        image: topPlace.image || existing.image,
                        badge: topPlace.badge || existing.badge,
                        rating: topPlace.rating || existing.rating,
                        reviews: topPlace.reviews || existing.reviews,
                        duration: topPlace.duration || existing.duration,
                        description: cleanDesc,
                        url: topPlace.url || existing.url
                    };
                    hasUpdates = true;
                }
            }
            catch {
                // Silently keep cached data
            }
        }
        if (hasUpdates) {
            Storage.set(STORAGE_KEYS.DESTINATIONS, destinationCardsData);
            renderDestinationCardsDOM(destinationCardsData);
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
    // Persist & Restore Input Form Values across Restarts
    function restoreFormDrafts() {
        const drafts = Storage.get(STORAGE_KEYS.DRAFTS, {}) ?? {};
        const inputsToTrack = [
            'signup-fullname',
            'signup-email',
            'signup-password',
            'user-id',
            'signin-password'
        ];
        inputsToTrack.forEach(id => {
            const inputEl = document.getElementById(id);
            if (inputEl) {
                // Restore saved value if available
                if (drafts[id] !== undefined && drafts[id] !== '') {
                    inputEl.value = drafts[id];
                }
                // Auto-save on every keystroke
                inputEl.addEventListener('input', () => {
                    const currentDrafts = Storage.get(STORAGE_KEYS.DRAFTS, {}) ?? {};
                    currentDrafts[id] = inputEl.value;
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
                        AuthService.logout();
                        banner.style.display = 'none';
                        alert('You have logged out successfully.');
                        window.location.reload();
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
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const nameInput = (document.getElementById('signup-fullname') || signupForm.querySelector('input[type="text"]'));
                const emailInput = (document.getElementById('signup-email') || signupForm.querySelector('input[type="email"]'));
                const passwordInput = (document.getElementById('signup-password') || signupForm.querySelector('input[type="password"]'));
                const name = nameInput ? nameInput.value : '';
                const email = emailInput ? emailInput.value : '';
                const password = passwordInput ? passwordInput.value : '';
                const result = AuthService.signUp(name, email, password);
                if (result.success) {
                    // Auto-fill signin input with email
                    const drafts = Storage.get(STORAGE_KEYS.DRAFTS, {}) ?? {};
                    drafts['user-id'] = email;
                    Storage.set(STORAGE_KEYS.DRAFTS, drafts);
                    alert(`Welcome, ${name}! Your account has been saved.`);
                    const isComponent = window.location.pathname.toLowerCase().includes('components');
                    window.location.href = isComponent ? '../index.html' : 'index.html';
                }
                else {
                    alert(result.message);
                }
            });
        }
        // 2. Sign In
        const signinForm = (document.getElementById('signinForm') || document.querySelector('.signin-form form'));
        if (signinForm) {
            signinForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const idInput = (document.getElementById('user-id') || signinForm.querySelector('input[type="text"], input[type="email"]'));
                const passwordInput = (document.getElementById('signin-password') || signinForm.querySelector('input[type="password"]'));
                const identifier = idInput ? idInput.value : '';
                const password = passwordInput ? passwordInput.value : '';
                const result = AuthService.signIn(identifier, password);
                if (result.success && result.user) {
                    alert(`Welcome back, ${result.user.fullName}!`);
                    const isComponent = window.location.pathname.toLowerCase().includes('components');
                    window.location.href = isComponent ? '../index.html' : 'index.html';
                }
                else {
                    alert(result.message);
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
            emailInput.value = '';
            alert(`Thank you for subscribing to Jadoo updates! (${email})`);
        });
    }
    function initDemoPlayer() {
        const demoBtn = document.getElementById('playDemoBtn');
        if (!demoBtn)
            return;
        demoBtn.addEventListener('click', () => {
            alert('Jadoo Experience Demo: Explore top destinations, book curated flights & hotels, and manage your travel itineraries in one click!');
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
                return window.innerWidth <= 650 ? 1 : window.innerWidth <= 768 ? 2 : 3;
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
            const cards = Array.from(document.querySelectorAll('.coms .com'));
            const arrowUp = document.getElementById('tArrowUp');
            const arrowDown = document.getElementById('tArrowDown');
            if (!cards.length)
                return;
            const circles = dotsSvg ? Array.from(dotsSvg.querySelectorAll('circle')) : [];
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
