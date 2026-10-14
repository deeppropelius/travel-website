
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
    signUp(fullName: string, email: string, password: string): AuthResponse;
    signIn(identifier: string, password: string): AuthResponse;
    createSession(user: User): User;
    logout(): void;
}

interface Window {
    JadooStorage?: IJadooStorage;
    JadooAuth?: IJadooAuth;
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

    // Storage Keys Constants
    const STORAGE_KEYS = {
        USERS: 'jadoo_users',
        CURRENT_USER: 'jadoo_current_user',
        LANGUAGE: 'jadoo_selected_language',
        DRAFTS: 'jadoo_form_drafts',
        THEME: 'jadoo_dark_theme'
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
            return Storage.get<User>(STORAGE_KEYS.CURRENT_USER, null);
        },

        isAuthenticated(): boolean {
            return this.getCurrentUser() !== null;
        },

        signUp(fullName: string, email: string, password: string): AuthResponse {
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

            const newUser: User = {
                id: 'user_' + Date.now(),
                fullName: cleanName,
                email: cleanEmail,
                password: password,
                createdAt: new Date().toISOString()
            };

            users.push(newUser);
            Storage.set(STORAGE_KEYS.USERS, users);

            // Keep session active
            this.createSession(newUser);

            return { success: true, message: 'Account created successfully!', user: newUser };
        },

        signIn(identifier: string, password: string): AuthResponse {
            const cleanId = (identifier || '').trim().toLowerCase();
            const users = this.getUsers();

            if (!cleanId || !password) {
                return { success: false, message: 'Please enter your email and password.' };
            }

            const user = users.find(
                u => (u.email === cleanId || u.id === cleanId || u.fullName.toLowerCase() === cleanId) && u.password === password
            );

            if (!user) {
                return { success: false, message: 'Invalid credentials. Please verify your email/ID and password.' };
            }

            this.createSession(user);
            return { success: true, message: 'Logged in successfully!', user };
        },

        createSession(user: User): User {
            const sessionUser: User = {
                id: user.id,
                fullName: user.fullName,
                email: user.email,
                loggedInAt: new Date().toISOString()
            };
            Storage.set(STORAGE_KEYS.CURRENT_USER, sessionUser);
            return sessionUser;
        },

        logout(): void {
            Storage.remove(STORAGE_KEYS.CURRENT_USER);
        }
    };

    window.JadooStorage = Storage;
    window.JadooAuth = AuthService;

    document.addEventListener('DOMContentLoaded', () => {

        // --- A. Mobile Drawer Navigation ---
        const hamburger = document.getElementById('hamburger-btn');
        const navMenu = document.getElementById('navitems');
        const navLinks = document.querySelectorAll<HTMLElement>('.navlink, .navitems .signup');

        if (hamburger && navMenu) {
            hamburger.addEventListener('click', (e: MouseEvent) => {
                e.stopPropagation();
                const isOpen = hamburger.classList.toggle('active');
                navMenu.classList.toggle('active');
                hamburger.setAttribute('aria-expanded', isOpen.toString());
            });

            navLinks.forEach((link: HTMLElement) => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                });
            });

            document.addEventListener('click', (e: MouseEvent) => {
                const target = e.target as Node | null;
                if (target && !navMenu.contains(target) && !hamburger.contains(target) && navMenu.classList.contains('active')) {
                    hamburger.classList.remove('active');
                    navMenu.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            });
        }

        // --- B. Language Preference Persistence ---
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
    });

    // Update navbar with user greeting & logout
    function updateNavbarAuthState(): void {
        const navList = document.querySelector<HTMLUListElement>('.navitems ul');
        if (!navList) return;

        const currentUser = AuthService.getCurrentUser();
        if (!currentUser) return;

        const firstName = currentUser.fullName ? currentUser.fullName.split(' ')[0] : 'User';

        const loginLinkLi = Array.from(navList.children).find(li => {
            const a = li.querySelector('a');
            if (!a) return false;
            const text = (a.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            return text === 'login' || a.href.includes('signin') || a.href.includes('auth.html');
        }) as HTMLElement | undefined;

        const signupLi = Array.from(navList.children).find(li => {
            const btn = li.querySelector('.signup, button');
            if (!btn) return false;
            const text = (btn.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const onclickAttr = btn.getAttribute('onclick') || '';
            return btn.classList.contains('signup') || text.includes('sign up') || text.includes('signup') || onclickAttr.includes('signup');
        }) as HTMLElement | undefined;

        if (loginLinkLi) {
            loginLinkLi.innerHTML = `<span class="nav-user-greeting" style="font-weight: 600; color: #df6951; cursor: default;">Hi, ${firstName}</span>`;
        }

        if (signupLi) {
            signupLi.innerHTML = `<button class="signup logout-btn" id="logout-btn" style="cursor: pointer; background-color: #df6951; color: #fff; border: none; padding: 8px 18px; border-radius: 6px;">Logout</button>`;
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e: MouseEvent) => {
                    e.preventDefault();
                    AuthService.logout();
                    alert('You have logged out successfully.');
                    window.location.reload();
                });
            }
        }
    }

    // Persist & Restore Input Form Values across Restarts
    function restoreFormDrafts(): void {
        const drafts = Storage.get<Record<string, string>>(STORAGE_KEYS.DRAFTS, {}) ?? {};
        const inputsToTrack = [
            'signup-fullname',
            'signup-email',
            'signup-password',
            'user-id',
            'signin-password'
        ];

        inputsToTrack.forEach(id => {
            const inputEl = document.getElementById(id) as HTMLInputElement | null;
            if (inputEl) {
                // Restore saved value if available
                if (drafts[id] !== undefined && drafts[id] !== '') {
                    inputEl.value = drafts[id];
                }

                // Auto-save on every keystroke
                inputEl.addEventListener('input', () => {
                    const currentDrafts = Storage.get<Record<string, string>>(STORAGE_KEYS.DRAFTS, {}) ?? {};
                    currentDrafts[id] = inputEl.value;
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

        // 1. Sign Up
        const signupForm = (document.getElementById('signupForm') || document.querySelector('.signup-form form')) as HTMLFormElement | null;
        if (signupForm) {
            signupForm.addEventListener('submit', (e: Event) => {
                e.preventDefault();
                const nameInput = (document.getElementById('signup-fullname') || signupForm.querySelector('input[type="text"]')) as HTMLInputElement | null;
                const emailInput = (document.getElementById('signup-email') || signupForm.querySelector('input[type="email"]')) as HTMLInputElement | null;
                const passwordInput = (document.getElementById('signup-password') || signupForm.querySelector('input[type="password"]')) as HTMLInputElement | null;

                const name = nameInput ? nameInput.value : '';
                const email = emailInput ? emailInput.value : '';
                const password = passwordInput ? passwordInput.value : '';

                const result = AuthService.signUp(name, email, password);
                if (result.success) {
                    // Auto-fill signin input with email
                    const drafts = Storage.get<Record<string, string>>(STORAGE_KEYS.DRAFTS, {}) ?? {};
                    drafts['user-id'] = email;
                    Storage.set(STORAGE_KEYS.DRAFTS, drafts);

                    alert(`Welcome, ${name}! Your account has been saved.`);
                    const isComponent = window.location.pathname.toLowerCase().includes('components');
                    window.location.href = isComponent ? '../index.html' : 'index.html';
                } else {
                    alert(result.message);
                }
            });
        }

        // 2. Sign In
        const signinForm = (document.getElementById('signinForm') || document.querySelector('.signin-form form')) as HTMLFormElement | null;
        if (signinForm) {
            signinForm.addEventListener('submit', (e: Event) => {
                e.preventDefault();
                const idInput = (document.getElementById('user-id') || signinForm.querySelector('input[type="text"], input[type="email"]')) as HTMLInputElement | null;
                const passwordInput = (document.getElementById('signin-password') || signinForm.querySelector('input[type="password"]')) as HTMLInputElement | null;

                const identifier = idInput ? idInput.value : '';
                const password = passwordInput ? passwordInput.value : '';

                const result = AuthService.signIn(identifier, password);
                if (result.success && result.user) {
                    alert(`Welcome back, ${result.user.fullName}!`);
                    const isComponent = window.location.pathname.toLowerCase().includes('components');
                    window.location.href = isComponent ? '../index.html' : 'index.html';
                } else {
                    alert(result.message);
                }
            });
        }
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

            emailInput.value = '';
            alert(`Thank you for subscribing to Jadoo updates! (${email})`);
        });
    }

    function initDemoPlayer(): void {
        const demoBtn = document.getElementById('playDemoBtn');
        if (!demoBtn) return;

        demoBtn.addEventListener('click', () => {
            alert('✨ Jadoo Experience Demo: Explore top destinations, book curated flights & hotels, and manage your travel itineraries in one click!');
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
            if (els.floatingBtn) els.floatingBtn.addEventListener('click', toggleTheme);
            if (els.navBtn) els.navBtn.addEventListener('click', toggleTheme);

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
                return window.innerWidth <= 650 ? 1 : window.innerWidth <= 768 ? 2 : 3;
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
            const cards = Array.from(document.querySelectorAll<HTMLElement>('.coms .com'));
            const arrowUp = document.getElementById('tArrowUp') as HTMLElement | null;
            const arrowDown = document.getElementById('tArrowDown') as HTMLElement | null;

            if (!cards.length) return;

            const circles = dotsSvg ? Array.from(dotsSvg.querySelectorAll<SVGCircleElement>('circle')) : [];
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
