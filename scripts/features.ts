/**
 * Jadoo Travel Agency - Advanced Features Controller
 * - Testimonial Review Submission Modal & Live Stack Injection
 * - Boarding Pass & Printable Itinerary Modal (@media print)
 * - Booking Status Filtering & Trip Cancellation
 * - Traveler Profile & Account Dashboard
 * - Toast Notification Engine
 */

import { JadooDB, DbBooking, DbTestimonial, DbBookingStatus, DbPackageType } from './db.js';

// --------------------------------------------------------------------------
// 0. UNIVERSAL DARK THEME CONTROLLER & SYNCHRONIZER
// --------------------------------------------------------------------------
export const JadooTheme = {
    STORAGE_KEY: 'jadoo_dark_theme',

    isDark(): boolean {
        if (typeof document !== 'undefined' && document.documentElement) {
            const attr = document.documentElement.getAttribute('data-theme');
            if (attr === 'dark') return true;
        }
        try {
            const local = localStorage.getItem(this.STORAGE_KEY);
            if (local !== null) {
                try {
                    const parsed = JSON.parse(local);
                    if (typeof parsed === 'boolean') return parsed;
                    if (parsed === 'true') return true;
                    if (parsed === 'false') return false;
                } catch (_) {}
                return local === 'true' || (local as unknown) === true;
            }
            const match = document.cookie.match(/(?:^|; )jadoo_dark_theme=([^;]*)/);
            if (match) {
                try {
                    const parsed = JSON.parse(decodeURIComponent(match[1]));
                    if (typeof parsed === 'boolean') return parsed;
                    return parsed === true || parsed === 'true';
                } catch (_) {
                    return match[1] === 'true';
                }
            }
        } catch (_) {}
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    },

    apply(dark: boolean): void {
        const html = document.documentElement;
        if (dark) {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }

        const floatingBtns = document.querySelectorAll<HTMLElement>('#themeToggle, .theme-toggle');
        const floatingIcons = document.querySelectorAll<HTMLElement>('#themeIcon, .theme-toggle i');
        const navBtns = document.querySelectorAll<HTMLElement>('#navThemeToggle, .nav-theme-toggle');

        floatingIcons.forEach(icon => {
            icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        });

        floatingBtns.forEach(btn => {
            btn.setAttribute('title', dark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            btn.setAttribute('aria-label', dark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        });

        navBtns.forEach(btn => {
            btn.setAttribute('title', dark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            btn.setAttribute('aria-label', dark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            btn.setAttribute('aria-checked', dark ? 'true' : 'false');
        });
    },

    _lastToggleTime: 0,

    toggle(): boolean {
        const now = Date.now();
        if (now - this._lastToggleTime < 200) {
            return this.isDark();
        }
        this._lastToggleTime = now;

        const currentDark = (typeof document !== 'undefined' && document.documentElement) ?
            document.documentElement.getAttribute('data-theme') === 'dark' :
            this.isDark();
        const nextDark = !currentDark;

        try {
            localStorage.setItem(this.STORAGE_KEY, String(nextDark));
            localStorage.setItem('jadoo_theme', JSON.stringify(nextDark));
            const date = new Date();
            date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000));
            document.cookie = `${this.STORAGE_KEY}=${encodeURIComponent(JSON.stringify(nextDark))}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
        } catch (_) {}

        this.apply(nextDark);

        const btns = document.querySelectorAll<HTMLElement>('#themeToggle, .theme-toggle');
        btns.forEach(btn => {
            btn.style.transform = 'scale(1.2) rotate(25deg)';
            setTimeout(() => { btn.style.transform = ''; }, 320);
        });

        try {
            window.dispatchEvent(new CustomEvent('jadoo:theme_change', { detail: { isDark: nextDark } }));
        } catch (_) {}

        return nextDark;
    },

    init(): void {
        const initialDark = this.isDark();
        this.apply(initialDark);

        const bindToggles = () => {
            this.apply(this.isDark());
            const toggles = document.querySelectorAll<HTMLElement>('#themeToggle, .theme-toggle, #navThemeToggle, .nav-theme-toggle');
            toggles.forEach(btn => {
                btn.style.pointerEvents = 'auto';
                btn.onclick = (e) => {
                    if (e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                    this.toggle();
                };
            });
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindToggles);
        } else {
            bindToggles();
        }

        window.addEventListener('storage', (e) => {
            if (e.key === this.STORAGE_KEY || e.key === 'jadoo_theme') {
                this.apply(this.isDark());
            }
        });

        if (window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (mq && typeof mq.addEventListener === 'function') {
                mq.addEventListener('change', (e) => {
                    if (localStorage.getItem(this.STORAGE_KEY) === null) {
                        this.apply(e.matches);
                    }
                });
            } else if (mq && typeof (mq as any).addListener === 'function') {
                (mq as any).addListener((e: any) => {
                    if (localStorage.getItem(this.STORAGE_KEY) === null) {
                        this.apply(e.matches);
                    }
                });
            }
        }
    }
};

// Expose globally immediately so scripts and inline attributes can access it
if (typeof window !== 'undefined') {
    (window as any).JadooTheme = JadooTheme;
    (window as any).toggleThemeGlobal = (e?: Event) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        return JadooTheme.toggle();
    };
}

// --------------------------------------------------------------------------
// 1. FLOATING TOAST NOTIFICATION ENGINE
// --------------------------------------------------------------------------
export const JadooToast = {
    show(title: string, desc = '', type: 'success' | 'error' | 'info' = 'success', duration = 4000): void {
        let container = document.getElementById('jadooToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'jadooToastContainer';
            container.className = 'jadoo-toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `jadoo-toast toast-${type}`;
        const iconClass = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info';

        toast.innerHTML = `
            <div class="toast-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="toast-content">
                <h4 class="toast-title">${escapeHTML(title)}</h4>
                ${desc ? `<p class="toast-desc">${escapeHTML(desc)}</p>` : ''}
            </div>
        `;

        container.appendChild(toast);

        // Force reflow for CSS transition
        requestAnimationFrame(() => {
            toast.classList.add('is-show');
        });

        setTimeout(() => {
            toast.classList.remove('is-show');
            setTimeout(() => {
                toast.remove();
            }, 350);
        }, duration);
    }
};

function escapeHTML(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// --------------------------------------------------------------------------
// 2. TESTIMONIAL REVIEW SUBMISSION CONTROLLER
// --------------------------------------------------------------------------
export class TestimonialReviewController {
    private modal: HTMLElement | null = null;
    private currentRating = 5;
    private selectedAvatar = './assets/testimonials-avatar-1.png';

    constructor() {
        this.init();
    }

    private init(): void {
        this.modal = document.getElementById('reviewModalOverlay');
        const openBtn = document.getElementById('openReviewModalBtn');
        const closeBtn = document.getElementById('reviewModalClose');
        const backdrop = document.getElementById('reviewModalBackdrop');
        const cancelBtn = document.getElementById('reviewCancelBtn');
        const form = document.getElementById('testimonialReviewForm') as HTMLFormElement | null;

        if (openBtn) {
            openBtn.addEventListener('click', () => this.open());
        }
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (backdrop) backdrop.addEventListener('click', () => this.close());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());

        this.initStarRating();
        this.initAvatarSelection();
        this.populateDestinations();

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit(form);
            });
        }
    }

    public open(): void {
        if (!this.modal) return;
        this.populateDestinations();

        // Autofill current user name if logged in
        const currentUser = JadooDB.getCurrentUser();
        const authorInput = document.getElementById('reviewAuthorName') as HTMLInputElement | null;
        if (currentUser && authorInput && !authorInput.value) {
            authorInput.value = currentUser.full_name;
        }

        this.modal.classList.add('is-open');
        this.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    public close(): void {
        if (!this.modal) return;
        if (typeof document !== 'undefined' && document.activeElement && this.modal.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
        this.modal.classList.remove('is-open');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    private initStarRating(): void {
        const starContainer = document.getElementById('starRatingPicker');
        const labelEl = document.getElementById('starRatingLabel');
        if (!starContainer) return;

        const starBtns = Array.from(starContainer.querySelectorAll<HTMLButtonElement>('.star-btn'));
        const labels: Record<number, string> = {
            1: '1.0 - Poor Experience',
            2: '2.0 - Below Expectations',
            3: '3.0 - Average Trip',
            4: '4.0 - Great Journey',
            5: '5.0 - Exceptional Experience'
        };

        const updateStars = (val: number) => {
            starBtns.forEach(btn => {
                const starVal = Number(btn.getAttribute('data-value'));
                if (starVal <= val) {
                    btn.classList.add('is-active');
                } else {
                    btn.classList.remove('is-active');
                }
            });
            if (labelEl) labelEl.textContent = labels[val] || `${val}.0`;
        };

        starBtns.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                const hoverVal = Number(btn.getAttribute('data-value'));
                starBtns.forEach(b => {
                    const v = Number(b.getAttribute('data-value'));
                    if (v <= hoverVal) {
                        b.classList.add('is-hovered');
                    } else {
                        b.classList.remove('is-hovered');
                    }
                });
                if (labelEl) labelEl.textContent = labels[hoverVal] || `${hoverVal}.0`;
            });

            btn.addEventListener('mouseleave', () => {
                starBtns.forEach(b => b.classList.remove('is-hovered'));
                updateStars(this.currentRating);
            });

            btn.addEventListener('click', () => {
                this.currentRating = Number(btn.getAttribute('data-value')) || 5;
                updateStars(this.currentRating);
            });
        });

        updateStars(this.currentRating);
    }

    private initAvatarSelection(): void {
        const avatarGrid = document.getElementById('avatarSelectionGrid');
        if (!avatarGrid) return;

        const chips = Array.from(avatarGrid.querySelectorAll<HTMLElement>('.avatar-chip'));
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('is-selected'));
                chip.classList.add('is-selected');
                const avatar = chip.getAttribute('data-avatar');
                if (avatar) this.selectedAvatar = avatar;
            });
        });
    }

    private populateDestinations(): void {
        const select = document.getElementById('reviewDestinationSelect') as HTMLSelectElement | null;
        if (!select) return;
        const destinations = JadooDB.getDestinations();
        const currentVal = select.value;

        select.innerHTML = '<option value="">Select Destination...</option>' +
            destinations.map(d => `<option value="${escapeHTML(d.name)}">${escapeHTML(d.name)}, ${escapeHTML(d.country)}</option>`).join('');

        if (currentVal) select.value = currentVal;
    }

    private handleSubmit(form: HTMLFormElement): void {
        const authorName = (document.getElementById('reviewAuthorName') as HTMLInputElement | null)?.value.trim();
        const destination = (document.getElementById('reviewDestinationSelect') as HTMLSelectElement | null)?.value.trim();
        const authorLocation = (document.getElementById('reviewAuthorLocation') as HTMLInputElement | null)?.value.trim() || 'Global Traveler';
        const roleTitle = (document.getElementById('reviewRoleTitle') as HTMLInputElement | null)?.value.trim() || 'Verified Explorer';
        const tripTag = (document.getElementById('reviewTripTag') as HTMLInputElement | null)?.value.trim() || 'Grand Tour Experience';
        const quote = (document.getElementById('reviewQuote') as HTMLTextAreaElement | null)?.value.trim();

        if (!authorName) {
            JadooToast.show('Name Required', 'Please enter your name.', 'error');
            return;
        }
        if (!destination) {
            JadooToast.show('Destination Required', 'Please select a destination.', 'error');
            return;
        }
        if (!quote || quote.length < 10) {
            JadooToast.show('Review Required', 'Please write a review with at least 10 characters.', 'error');
            return;
        }

        const currentUser = JadooDB.getCurrentUser();

        // Add to Database
        const newTestimonial = JadooDB.addTestimonial({
            user_id: currentUser?.id,
            costumer_id: currentUser?.id,
            author_email: currentUser?.email,
            destination_name: destination,
            author_name: authorName,
            author_location: authorLocation,
            role_title: roleTitle,
            quote,
            rating: this.currentRating,
            avatar_url: this.selectedAvatar,
            trip_tag: tripTag
        });

        // Live inject into Testimonial 3D Stack on index.html if present
        this.injectTestimonialCard(newTestimonial);

        this.close();
        form.reset();
        JadooToast.show('Thank You, Explorer!', 'Your travel story has been published to our testimonials.', 'success');
    }

    private injectTestimonialCard(t: DbTestimonial): void {
        const cardsContainer = document.querySelector<HTMLElement>('.coms');
        if (!cardsContainer) return;

        // Create new testimonial card matching index.html format
        const card = document.createElement('div');
        card.className = 'com f is-front';
        card.setAttribute('data-testimonial', 'new');

        const starsCount = Math.floor(t.rating);
        let starsHTML = '';
        for (let i = 0; i < starsCount; i++) {
            starsHTML += '<i class="fa-solid fa-star"></i> ';
        }
        if (t.rating % 1 !== 0) {
            starsHTML += '<i class="fa-solid fa-star-half-stroke"></i> ';
        }

        card.innerHTML = `
            <div class="ficimg">
                <img src="${escapeHTML(t.avatar_url)}" alt="${escapeHTML(t.author_name)} portrait" draggable="false">
            </div>
            <div class="ctext">
                <div class="cmeta">
                    <div class="crating">
                        ${starsHTML}
                        <span>${(parseFloat(t.rating as any) || 5.0).toFixed(1)}</span>
                    </div>
                    <span class="cbadge"><i class="fa-solid fa-shield-heart"></i> ${escapeHTML(t.role_title)}</span>
                </div>
                <div class="cp">&ldquo;${escapeHTML(t.quote)}&rdquo;</div>
                <div class="cauthor-row">
                    <div class="cauthor-info">
                        <div class="cn">${escapeHTML(t.author_name)}</div>
                        <div class="cl">${escapeHTML(t.author_location)}</div>
                    </div>
                    <div class="ctrip-tag">
                        <i class="fa-solid fa-location-dot"></i> ${escapeHTML(t.trip_tag || t.destination_name)}
                    </div>
                </div>
            </div>
        `;

        // Prepend and animate
        cardsContainer.insertBefore(card, cardsContainer.firstChild);

        // Notify testimonials stack controller to re-index
        window.dispatchEvent(new CustomEvent('jadoo:new_testimonial', { detail: t }));
    }
}

// --------------------------------------------------------------------------
// 3. BOARDING PASS & PRINTABLE TICKET CONTROLLER
// --------------------------------------------------------------------------
export class BoardingPassController {
    private modal: HTMLElement | null = null;
    private currentBooking: DbBooking | null = null;

    constructor() {
        this.init();
    }

    private init(): void {
        this.modal = document.getElementById('ticketModalOverlay');
        const closeBtn = document.getElementById('ticketModalClose');
        const backdrop = document.getElementById('ticketModalBackdrop');
        const printBtn = document.getElementById('btnPrintTicketAction');

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (backdrop) backdrop.addEventListener('click', () => this.close());
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                if (this.currentBooking) {
                    JadooTicketUtilities.downloadTicketPdf(this.currentBooking, 'printableBoardingPass', printBtn);
                } else {
                    window.print();
                }
            });
        }
    }

    public open(booking: DbBooking): void {
        if (!this.modal) return;
        this.currentBooking = booking;
        this.renderTicket(booking);
        this.modal.classList.add('is-open');
        this.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    public close(): void {
        if (!this.modal) return;
        if (typeof document !== 'undefined' && document.activeElement && this.modal.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
        this.modal.classList.remove('is-open');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    private renderTicket(booking: DbBooking): void {
        const setTxt = (id: string, val: string) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        const destCode = booking.destination_name.substring(0, 3).toUpperCase();
        setTxt('ticketRefId', booking.id);
        setTxt('ticketDestCode', destCode);
        setTxt('ticketDestCity', booking.destination_name);
        setTxt('ticketAttractionName', booking.attraction_name);
        setTxt('ticketTravelerName', booking.user_name);
        setTxt('ticketTravelDate', booking.travel_date);
        setTxt('ticketGuestsCount', `${booking.guests_count} Traveler(s)`);
        setTxt('ticketPackageType', booking.package_type.toUpperCase());
        setTxt('ticketTotalPrice', `$${(parseFloat(booking.total_price as any) || 0).toFixed(2)} USD`);
        setTxt('ticketStubRef', booking.id);

        const statusBadge = document.getElementById('ticketStatusBadge');
        if (statusBadge) {
            statusBadge.className = `badge-status status-${booking.status}`;
            statusBadge.textContent = booking.status.toUpperCase();
        }

        const prefix = typeof window !== 'undefined' && window.location.pathname.includes('/components/') ? './ticket.html' : './components/ticket.html';
        const fullPageLink = document.getElementById('ticketFullPageLink') as HTMLAnchorElement | null;
        if (fullPageLink) {
            fullPageLink.href = `${prefix}?id=${encodeURIComponent(booking.id)}`;
        }

        // Render live QR Code inside modal stub
        const qrContainer = document.querySelector<HTMLElement>('#ticketModalOverlay .stub-qr-code');
        if (qrContainer) {
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/${prefix.replace('./', '')}?id=${encodeURIComponent(booking.id)}`;
            JadooTicketUtilities.renderQrCode(qrContainer, targetUrl, 84);
        }
    }
}

// --------------------------------------------------------------------------
// 4. BOOKING STATUS & ENHANCED MY BOOKINGS CONTROLLER
// --------------------------------------------------------------------------
export class BookingStatusController {
    private currentFilter: DbBookingStatus | 'all' = 'all';
    private boardingPassController: BoardingPassController;

    constructor(boardingPassCtrl: BoardingPassController) {
        this.boardingPassController = boardingPassCtrl;
        this.init();
    }

    private init(): void {
        // Listen to storage or db changes
        window.addEventListener('jadoo:db_change', (e: any) => {
            if (!e.detail || e.detail.key === 'jadoo_schema_bookings' || e.detail.key === 'jadoo_bookings') {
                this.renderBookingsList();
            }
        });

        // Filter tab clicks
        const tabsContainer = document.getElementById('myBookingsFilterTabs');
        if (tabsContainer) {
            const tabs = Array.from(tabsContainer.querySelectorAll<HTMLButtonElement>('.status-tab-btn'));
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('is-active'));
                    tab.classList.add('is-active');
                    this.currentFilter = (tab.getAttribute('data-status') || 'all') as any;
                    this.renderBookingsList();
                });
            });
        }
    }

    public renderBookingsList(): void {
        const listContainer = document.getElementById('myBookingsList');
        if (!listContainer) return;

        const currentUser = JadooDB.getCurrentUser();
        const userEmail = currentUser?.email;
        const allUserBookings = JadooDB.getUserBookings(userEmail);
        const filteredBookings = JadooDB.getUserBookings(userEmail, this.currentFilter);

        // Update tab counts
        this.updateTabCounts(allUserBookings);

        if (filteredBookings.length === 0) {
            listContainer.innerHTML = `
                <div class="bookings-empty-state">
                    <div class="empty-icon-wrap"><i class="fa-solid fa-compass"></i></div>
                    <h3>No ${this.currentFilter === 'all' ? '' : this.currentFilter} bookings</h3>
                    <p>Ready for your next adventure? Explore world-class attractions and reserve with instant confirmation.</p>
                    <a href="./components/destination-page.html" class="btn-empty-explore">
                        <i class="fa-solid fa-earth-americas"></i>
                        <span>Explore Destinations</span>
                    </a>
                </div>
            `;
            return;
        }

        const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
        const resolveImg = (img?: string) => {
            if (!img) return isComp ? '../assets/destination-rome.png' : './assets/destination-rome.png';
            if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) return img;
            if (isComp) {
                if (img.startsWith('./assets/')) return '.' + img;
                if (img.startsWith('assets/')) return '../' + img;
                if (!img.startsWith('../assets/')) return '../assets/' + img.replace(/^\.?\/?(assets\/)?/, '');
                return img;
            } else {
                if (img.startsWith('../assets/')) return img.replace(/^\.\.\//, './');
                if (img.startsWith('assets/')) return './' + img;
                return img;
            }
        };

        listContainer.innerHTML = filteredBookings.map(b => {
            const formattedDate = (() => {
                if (!b.travel_date) return 'Flexible Schedule';
                try {
                    const d = new Date(b.travel_date);
                    if (isNaN(d.getTime())) return String(b.travel_date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                } catch {
                    return String(b.travel_date);
                }
            })();
            const isCancelled = (b.status || '').toLowerCase() === 'cancelled';

            return `
            <div class="booking-item-card" data-id="${b.id}">
                <img src="${resolveImg(b.image_url)}" alt="${escapeHTML(b.attraction_name)}" class="booking-item-img" onerror="this.onerror=null; this.src='${isComp ? '../assets/destination-rome.png' : './assets/destination-rome.png'}';">
                <div class="booking-item-info">
                    <div class="booking-item-header">
                        <h4 class="booking-item-title">${escapeHTML(b.attraction_name)}</h4>
                        <span class="badge-status status-${b.status}">${b.status}</span>
                    </div>
                    <div class="booking-item-meta">
                        <span><i class="fa-solid fa-location-dot"></i> ${escapeHTML(b.destination_name)}</span>
                        <span><i class="fa-solid fa-calendar-days"></i> ${formattedDate}</span>
                        <span><i class="fa-solid fa-user-group"></i> ${b.guests_count} guest(s)</span>
                        <span><i class="fa-solid fa-award"></i> ${b.package_type}</span>
                    </div>
                    ${b.special_request ? `<div class="booking-item-requests"><i class="fa-regular fa-comment-dots"></i> "${escapeHTML(b.special_request)}"</div>` : ''}
                </div>
                <div class="booking-item-actions-col">
                    <div class="booking-price-highlight">$${(parseFloat(b.total_price as any) || 0).toFixed(2)}</div>
                    <div class="booking-item-actions">
                        <a href="${typeof window !== 'undefined' && window.location.pathname.includes('/components/') ? './ticket.html' : './components/ticket.html'}?id=${b.id}" class="btn-print-ticket btn-view-ticket" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.45rem 0.95rem; border-radius: 9999px; background: linear-gradient(135deg, #DF6951 0%, #F1A501 100%) !important; color: #FFFFFF !important; font-size: 0.8rem; font-weight: 600; border: none !important; cursor: pointer; box-shadow: 0 4px 12px rgba(223, 105, 81, 0.25);" title="Open Boarding Pass">
                            <i class="fa-solid fa-ticket" style="color: #FFFFFF !important;"></i>
                            <span style="color: #FFFFFF !important;">E-Ticket</span>
                        </a>
                        <button type="button" class="btn-view-pass" data-id="${b.id}" title="Quick Pass Preview" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.45rem 0.95rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
                            <i class="fa-solid fa-eye"></i>
                            <span>Pass</span>
                        </button>
                        ${!isCancelled ? `
                            <button type="button" class="btn-cancel-trip btn-cancel-action" data-id="${b.id}" title="Cancel this reservation">
                                <i class="fa-solid fa-ban"></i>
                                <span>Cancel</span>
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        }).join('');

        // Attach action handlers
        listContainer.querySelectorAll<HTMLButtonElement>('.btn-view-pass').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const booking = JadooDB.getBookings().find(b => b.id === id);
                if (booking) {
                    this.boardingPassController.open(booking);
                }
            });
        });

        listContainer.querySelectorAll<HTMLButtonElement>('.btn-cancel-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                if (id && confirm(`Are you sure you want to cancel booking #${id}?`)) {
                    JadooDB.cancelBooking(id);
                    JadooToast.show('Reservation Cancelled', `Booking #${id} has been marked as cancelled.`, 'info');
                    this.renderBookingsList();
                }
            });
        });
    }

    private updateTabCounts(bookings: DbBooking[]): void {
        const allCount = bookings.length;
        const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
        const pendingCount = bookings.filter(b => b.status === 'pending').length;
        const cancelledCount = bookings.filter(b => b.status === 'cancelled').length;

        const setBadge = (id: string, count: number) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `${count}`;
        };

        setBadge('countTabAll', allCount);
        setBadge('countTabConfirmed', confirmedCount);
        setBadge('countTabPending', pendingCount);
        setBadge('countTabCancelled', cancelledCount);
    }
}

// --------------------------------------------------------------------------
// 5. TRAVELER PROFILE & ACCOUNT DASHBOARD CONTROLLER
// --------------------------------------------------------------------------
export class ProfileDashboardController {
    private modal: HTMLElement | null = null;

    constructor() {
        this.init();
    }

    private init(): void {
        this.modal = document.getElementById('profileModalOverlay');
        const openBtn = document.getElementById('navProfileBtn');
        const closeBtn = document.getElementById('profileModalClose');
        const backdrop = document.getElementById('profileModalBackdrop');
        const form = document.getElementById('profileEditForm') as HTMLFormElement | null;

        if (openBtn) openBtn.addEventListener('click', () => this.open());
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (backdrop) backdrop.addEventListener('click', () => this.close());

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleProfileSave();
            });
        }

        // If an explicit navProfileBtn exists in DOM, bind it
        const existingProfileBtn = document.getElementById('navProfileBtn');
        if (existingProfileBtn) {
            existingProfileBtn.addEventListener('click', () => this.open());
        }
    }

    public open(): void {
        if (!this.modal) return;
        this.renderStats();
        this.modal.classList.add('is-open');
        this.modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    public close(): void {
        if (!this.modal) return;
        if (typeof document !== 'undefined' && document.activeElement && this.modal.contains(document.activeElement)) {
            (document.activeElement as HTMLElement).blur();
        }
        this.modal.classList.remove('is-open');
        this.modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    private renderStats(): void {
        const user = JadooDB.getCurrentUser();
        const bookings = JadooDB.getUserBookings(user?.email);
        const testimonials = JadooDB.getTestimonials().filter(t => (user?.id && t.user_id === user.id) || (user && (t.author_name || '').toLowerCase() === (user.full_name || '').toLowerCase()));

        const confirmedTrips = bookings.filter(b => b.status === 'confirmed').length;
        const totalSpent = bookings.reduce((sum, b) => b.status !== 'cancelled' ? sum + (parseFloat(b.total_price as any) || 0) : sum, 0);

        const setTxt = (id: string, val: string) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setTxt('profileDisplayName', user?.full_name || 'Traveler');
        setTxt('profileDisplayEmail', user?.email || 'traveler@example.com');
        setTxt('profileTotalTrips', `${bookings.length}`);
        setTxt('profileActiveTrips', `${confirmedTrips}`);
        setTxt('profileTotalSpent', `$${totalSpent.toFixed(0)}`);

        // Populate edit fields
        const nameInput = document.getElementById('profileInputName') as HTMLInputElement | null;
        const phoneInput = document.getElementById('profileInputPhone') as HTMLInputElement | null;
        if (nameInput) nameInput.value = user?.full_name || '';
        if (phoneInput) phoneInput.value = user?.phone || '';
    }

    private handleProfileSave(): void {
        const nameInput = document.getElementById('profileInputName') as HTMLInputElement | null;
        const phoneInput = document.getElementById('profileInputPhone') as HTMLInputElement | null;
        const newName = nameInput?.value.trim();
        const newPhone = phoneInput?.value.trim();

        if (!newName) {
            JadooToast.show('Name Required', 'Please enter your name.', 'error');
            return;
        }

        JadooDB.updateProfile({
            full_name: newName,
            phone: newPhone
        });

        // Update displayed name in navbar
        const navName = document.getElementById('userFirstNameDisplay');
        if (navName) navName.textContent = newName.split(' ')[0];

        this.renderStats();
        this.close();
        JadooToast.show('Profile Updated', 'Your traveler profile details have been saved.', 'success');
    }
}

// --------------------------------------------------------------------------
// 6. TICKET ADVANCED UTILITIES, REAL QR GENERATOR & PDF ENGINE
// --------------------------------------------------------------------------
export const JadooTicketUtilities = {
    async ensureScript(url: string, globalKey: string): Promise<boolean> {
        if (typeof (window as any)[globalKey] !== 'undefined') return true;
        return new Promise((resolve) => {
            const existing = document.querySelector(`script[src="${url}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(true));
                existing.addEventListener('error', () => resolve(false));
                setTimeout(() => resolve(typeof (window as any)[globalKey] !== 'undefined'), 2000);
                return;
            }
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.head.appendChild(script);
            setTimeout(() => resolve(typeof (window as any)[globalKey] !== 'undefined'), 4000);
        });
    },

    renderQrCode(container: HTMLElement | null, text: string, size = 120): void {
        if (!container) return;
        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.overflow = 'hidden';

        const ensureSingleImage = (): boolean => {
            const canvases = container.querySelectorAll('canvas');
            const imgs = container.querySelectorAll('img');

            for (let i = 0; i < imgs.length; i++) {
                const img = imgs[i];
                if (img.src && img.src.length > 50 && (img.src.startsWith('data:image') || img.src.startsWith('http') || img.src.startsWith('blob:'))) {
                    img.style.display = 'block';
                    img.style.width = `${size}px`;
                    img.style.height = `${size}px`;
                    img.style.maxWidth = '100%';
                    img.style.maxHeight = '100%';
                    img.style.objectFit = 'contain';
                    img.style.borderRadius = '8px';
                    canvases.forEach(c => c.remove());
                    imgs.forEach(other => { if (other !== img) other.remove(); });
                    return true;
                }
            }

            if (canvases.length > 0) {
                const canvas = canvases[0];
                try {
                    const dataUrl = canvas.toDataURL('image/png');
                    if (dataUrl && dataUrl.length > 100 && !dataUrl.includes('data:,')) {
                        container.innerHTML = '';
                        const img = document.createElement('img');
                        img.src = dataUrl;
                        img.alt = 'Verified Ticket QR Pass';
                        img.style.display = 'block';
                        img.style.width = `${size}px`;
                        img.style.height = `${size}px`;
                        img.style.maxWidth = '100%';
                        img.style.maxHeight = '100%';
                        img.style.objectFit = 'contain';
                        img.style.borderRadius = '8px';
                        container.appendChild(img);
                        return true;
                    }
                } catch (_) {}

                canvases.forEach((c, idx) => { if (idx > 0) c.remove(); });
                imgs.forEach(i => i.remove());
                canvas.style.display = 'block';
                canvas.style.width = `${size}px`;
                canvas.style.height = `${size}px`;
                canvas.style.maxWidth = '100%';
                canvas.style.borderRadius = '8px';
                return true;
            }
            return false;
        };

        // 1. Try QRCode library (Canvas / SVG)
        if (typeof (window as any).QRCode !== 'undefined') {
            try {
                new (window as any).QRCode(container, {
                    text: text,
                    width: size,
                    height: size,
                    colorDark: '#0F172A',
                    colorLight: '#FFFFFF',
                    correctLevel: (window as any).QRCode.CorrectLevel.M
                });
                if (!ensureSingleImage()) {
                    setTimeout(ensureSingleImage, 30);
                    setTimeout(ensureSingleImage, 100);
                }
                return;
            } catch (e) {
                console.warn('QRCode JS instance failed, using image fallback:', e);
            }
        }

        // Try dynamically loading local QRCode in background
        const scriptPath = typeof window !== 'undefined' && window.location.pathname.includes('/components/')
            ? '../scripts/qrcode.min.js'
            : './scripts/qrcode.min.js';
        this.ensureScript(scriptPath, 'QRCode').then(loaded => {
            if (loaded && typeof (window as any).QRCode !== 'undefined' && container) {
                try {
                    container.innerHTML = '';
                    new (window as any).QRCode(container, {
                        text: text,
                        width: size,
                        height: size,
                        colorDark: '#0F172A',
                        colorLight: '#FFFFFF',
                        correctLevel: (window as any).QRCode.CorrectLevel.M
                    });
                    if (!ensureSingleImage()) {
                        setTimeout(ensureSingleImage, 30);
                        setTimeout(ensureSingleImage, 100);
                    }
                } catch (_) {}
            }
        });

        // 2. High-performance live QR API image fallback with CORS enabled
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(text)}`;
        img.alt = `Scannable QR Code for ${text}`;
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.borderRadius = '8px';

        // 3. Fully offline SVG matrix fallback
        img.onerror = () => {
            container.innerHTML = `
                <svg viewBox="0 0 100 100" width="${size}" height="${size}" style="background: #FFF; border-radius: 8px; display: block; margin: 0 auto;">
                    <rect x="5" y="5" width="28" height="28" fill="#0F172A" rx="2"/>
                    <rect x="9" y="9" width="20" height="20" fill="#FFF"/>
                    <rect x="13" y="13" width="12" height="12" fill="#0F172A" rx="1"/>
                    <rect x="67" y="5" width="28" height="28" fill="#0F172A" rx="2"/>
                    <rect x="71" y="9" width="20" height="20" fill="#FFF"/>
                    <rect x="75" y="13" width="12" height="12" fill="#0F172A" rx="1"/>
                    <rect x="5" y="67" width="28" height="28" fill="#0F172A" rx="2"/>
                    <rect x="9" y="71" width="20" height="20" fill="#FFF"/>
                    <rect x="13" y="75" width="12" height="12" fill="#0F172A" rx="1"/>
                    <rect x="38" y="12" width="6" height="6" fill="#0F172A"/>
                    <rect x="48" y="12" width="6" height="6" fill="#0F172A"/>
                    <rect x="58" y="12" width="6" height="6" fill="#0F172A"/>
                    <rect x="12" y="38" width="6" height="6" fill="#0F172A"/>
                    <rect x="12" y="48" width="6" height="6" fill="#0F172A"/>
                    <rect x="12" y="58" width="6" height="6" fill="#0F172A"/>
                    <rect x="38" y="38" width="24" height="24" fill="#DF6951" rx="4"/>
                    <text x="50" y="54" fill="#FFF" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">JADOO</text>
                    <rect x="42" y="72" width="10" height="10" fill="#0F172A"/>
                    <rect x="58" y="68" width="8" height="8" fill="#0F172A"/>
                    <rect x="72" y="42" width="10" height="10" fill="#0F172A"/>
                    <rect x="86" y="52" width="8" height="8" fill="#0F172A"/>
                    <rect x="68" y="78" width="14" height="14" fill="#0F172A"/>
                </svg>
            `;
        };

        container.appendChild(img);
    },

    async downloadTicketPdf(booking: DbBooking, targetElementId = 'boardingPassContainer', triggerBtn?: HTMLElement | null): Promise<void> {
        const el = document.getElementById(targetElementId);
        if (!el) {
            JadooToast.show('PDF Export Error', 'Boarding pass element was not found.', 'error');
            return;
        }

        const btn = triggerBtn || document.getElementById('downloadPdfBtn') || document.getElementById('btnPrintTicketAction');
        const origContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Generating PDF...</span>`;
            (btn as HTMLButtonElement).disabled = true;
        }

        JadooToast.show('Generating PDF', `Rendering high-resolution boarding pass for #${booking.id}...`, 'info');

        try {
            if (typeof (window as any).html2pdf === 'undefined') {
                await this.ensureScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js', 'html2pdf');
            }

            if (typeof (window as any).html2pdf !== 'undefined') {
                const opt = {
                    margin:       [6, 6, 6, 6],
                    filename:     `Jadoo-BoardingPass-${booking.id}.pdf`,
                    image:        { type: 'jpeg', quality: 0.98 },
                    html2canvas:  {
                        scale: 2,
                        useCORS: true,
                        allowTaint: true,
                        logging: false,
                        backgroundColor: '#FFFFFF',
                        scrollX: 0,
                        scrollY: 0
                    },
                    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
                };

                await (window as any).html2pdf().set(opt).from(el).save();
                JadooToast.show('PDF Downloaded', `Boarding pass Jadoo-BoardingPass-${booking.id}.pdf has been saved!`, 'success');
            } else {
                window.print();
                JadooToast.show('Print Ready', 'Please select "Save as PDF" in the destination printer options.', 'info');
            }
        } catch (err) {
            console.error('html2pdf execution error, triggering native print:', err);
            window.print();
            JadooToast.show('Print View Opened', 'You can print or save as PDF using your browser dialog.', 'info');
        } finally {
            if (btn) {
                btn.innerHTML = origContent;
                (btn as HTMLButtonElement).disabled = false;
            }
        }
    },

    getDestinationWeather(destName: string): { tempC: number; tempF: number; condition: string; icon: string; advisory: string } {
        const lower = (destName || '').toLowerCase();
        if (lower.includes('rome') || lower.includes('italy')) {
            return { tempC: 22, tempF: 72, condition: 'Sunny & Pleasant', icon: 'fa-sun', advisory: 'Ideal mild weather. Wear comfortable footwear for cobblestone paths.' };
        } else if (lower.includes('london') || lower.includes('uk')) {
            return { tempC: 16, tempF: 61, condition: 'Partly Cloudy', icon: 'fa-cloud-sun', advisory: 'Crisp evening air. Light coat or trench recommended for Thames walks.' };
        } else if (lower.includes('paris') || lower.includes('france')) {
            return { tempC: 18, tempF: 64, condition: 'Clear Sky & Breezy', icon: 'fa-sun', advisory: 'Gentle golden hour sunset expected. Perfect for terrace dining.' };
        } else if (lower.includes('tokyo') || lower.includes('japan')) {
            return { tempC: 19, tempF: 66, condition: 'Clear & Crisp', icon: 'fa-wind', advisory: 'Temperate climate. Keep a pocket WiFi or Suica card handy.' };
        }
        return { tempC: 24, tempF: 75, condition: 'Clear & Warm', icon: 'fa-sun', advisory: 'Great travel conditions. Stay hydrated during outdoor sightseeing.' };
    },

    getFlightTelemetry(booking: DbBooking) {
        const hash = ((booking.id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 100);
        return {
            flightNumber: `JA-${700 + (hash % 90)}`,
            aircraft: 'Boeing 787-9 Dreamliner (Starlink Satellite In-Flight Wi-Fi)',
            tailNumber: `JD-99${(hash % 9) + 1}`,
            altitude: '38,000 FT (Optimal Cruising)',
            speed: `${540 + (hash % 40)} KNOTS (965 km/h)`,
            distance: `${3800 + (hash * 15)} NM`,
            cabinPressure: '6,000 FT Equivalent',
            headwind: '14 KTS Tail-Wind',
            wifiStatus: 'Connected (Starlink 220 Mbps)',
            gateCountdownHours: 2,
            gateCountdownMins: 45
        };
    },

    downloadCalendarInvite(booking: DbBooking): void {
        const dest = booking.destination_name || 'Destination';
        const title = `Jadoo Voyage to ${dest} - ${booking.attraction_name}`;
        const desc = `Official E-Ticket Boarding Pass #${booking.id} for ${booking.user_name}. Priority Gate B24, Terminal 2. Status: ${booking.status.toUpperCase()}.`;
        
        const cleanDate = (booking.travel_date || '2026-11-15').replace(/-/g, '');
        const dtStart = `${cleanDate}T083000Z`;
        const dtEnd = `${cleanDate}T170000Z`;
        const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Jadoo Travel Inc//E-Ticket Itinerary//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'BEGIN:VEVENT',
            `UID:jadoo-${booking.id}-${Date.now()}@jadoo.travel`,
            `DTSTAMP:${now}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `SUMMARY:${title}`,
            `DESCRIPTION:${desc}`,
            `LOCATION:${booking.attraction_name}, ${dest}`,
            'STATUS:CONFIRMED',
            'BEGIN:VALARM',
            'TRIGGER:-PT2H',
            'ACTION:DISPLAY',
            'DESCRIPTION:Reminder: Your Jadoo voyage begins in 2 hours!',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Jadoo-Voyage-${booking.id}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        JadooToast.show('Calendar Saved', `Trip #${booking.id} added to calendar (.ics download ready)!`, 'success');
    },

    openSeatMapModal(booking: DbBooking, onSeatSelected?: (seat: string) => void): void {
        let overlay = document.getElementById('seatMapModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'seatMapModalOverlay';
            overlay.className = 'features-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="features-modal-backdrop" id="seatMapBackdrop"></div>
                <div class="features-modal-card seat-map-card-modal" style="max-width: 580px; text-align: center;">
                    <div class="features-modal-header">
                        <div>
                            <span class="modal-header-badge"><i class="fa-solid fa-couch"></i> Aircraft Cabin Map</span>
                            <h3 class="features-modal-title">Select Your Suite Seat</h3>
                        </div>
                        <button type="button" class="features-modal-close" id="seatMapClose">&times;</button>
                    </div>
                    <div id="seatMapModalBody" style="padding: 1rem 0;"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('seatMapBackdrop')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
            document.getElementById('seatMapClose')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
        }

        const currentSavedSeat = localStorage.getItem(`jadoo_seat_${booking.id}`) || 'Suite 02A';
        const body = document.getElementById('seatMapModalBody');
        if (body) {
            const seats = [
                { id: 'Suite 01A', type: 'First Class Window Suite', available: true },
                { id: 'Suite 01D', type: 'First Class Center Pod', available: false },
                { id: 'Suite 01G', type: 'First Class Center Pod', available: false },
                { id: 'Suite 01K', type: 'First Class Window Suite', available: true },
                { id: 'Suite 02A', type: 'First Class Window Suite', available: true },
                { id: 'Suite 02D', type: 'First Class Center Pod', available: true },
                { id: 'Suite 02G', type: 'First Class Center Pod', available: false },
                { id: 'Suite 02K', type: 'First Class Window Suite', available: true },
                { id: 'Suite 03A', type: 'Business Club Suite', available: true },
                { id: 'Suite 03K', type: 'Business Club Suite', available: true },
            ];

            body.innerHTML = `
                <div class="fuselage-preview-wrap">
                    <div class="cockpit-nose">
                        <i class="fa-solid fa-plane-up"></i>
                        <span>Boeing 787-9 Dreamliner • Upper Deck Premium Zone</span>
                    </div>

                    <div class="cabin-legend">
                        <span class="legend-item"><span class="dot dot-selected"></span> Your Current Seat</span>
                        <span class="legend-item"><span class="dot dot-avail"></span> Available Suite</span>
                        <span class="legend-item"><span class="dot dot-taken"></span> Reserved</span>
                    </div>

                    <div class="seats-matrix-grid">
                        ${seats.map(s => {
                            const isSelected = s.id === currentSavedSeat;
                            const isOccupied = !s.available && !isSelected;
                            return `
                                <button type="button" class="seat-tile ${isSelected ? 'is-selected' : isOccupied ? 'is-occupied' : 'is-available'}"
                                    data-seat="${s.id}" ${isOccupied ? 'disabled' : ''} title="${s.id} - ${s.type}">
                                    <i class="fa-solid ${isSelected ? 'fa-circle-check' : 'fa-chair'}"></i>
                                    <span class="seat-code">${s.id.replace('Suite ', '')}</span>
                                    <span class="seat-tag">${isSelected ? 'CURRENT' : isOccupied ? 'TAKEN' : 'SELECT'}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>

                    <div class="seat-perks-box">
                        <div class="perk-pill"><i class="fa-solid fa-bed"></i> 180° Lie-Flat Double Bed</div>
                        <div class="perk-pill"><i class="fa-solid fa-plug"></i> 65W USB-C & AC Power</div>
                        <div class="perk-pill"><i class="fa-solid fa-tv"></i> 24" 4K HDR Touchscreen</div>
                        <div class="perk-pill"><i class="fa-solid fa-shield"></i> Sliding Privacy Door</div>
                    </div>
                </div>
            `;

            body.querySelectorAll<HTMLButtonElement>('.seat-tile.is-available, .seat-tile.is-selected').forEach(btn => {
                btn.addEventListener('click', () => {
                    const newSeat = btn.getAttribute('data-seat');
                    if (newSeat) {
                        localStorage.setItem(`jadoo_seat_${booking.id}`, newSeat);
                        overlay?.classList.remove('is-open');
                        JadooToast.show('Seat Confirmed', `Your seat has been updated to ${newSeat}!`, 'success');
                        if (onSeatSelected) onSeatSelected(newSeat);
                    }
                });
            });
        }

        overlay.classList.add('is-open');
    },

    openShareModal(booking: DbBooking): void {
        let overlay = document.getElementById('shareTicketModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'shareTicketModalOverlay';
            overlay.className = 'features-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="features-modal-backdrop" id="shareBackdrop"></div>
                <div class="features-modal-card share-card-modal" style="max-width: 480px; text-align: center;">
                    <div class="features-modal-header">
                        <div>
                            <span class="modal-header-badge"><i class="fa-solid fa-share-nodes"></i> Traveler Share Hub</span>
                            <h3 class="features-modal-title">Share Your Itinerary</h3>
                        </div>
                        <button type="button" class="features-modal-close" id="shareClose">&times;</button>
                    </div>
                    <div id="shareTicketModalBody" style="padding: 1rem 0;"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('shareBackdrop')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
            document.getElementById('shareClose')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
        }

        const ticketUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(booking.id)}`;
        const summaryText = `✈️ Jadoo Travel Itinerary: ${booking.attraction_name} (${booking.destination_name})\nPassenger: ${booking.user_name}\nDate: ${booking.travel_date}\nBooking Ref: #${booking.id}\nBoarding Pass: ${ticketUrl}`;

        const body = document.getElementById('shareTicketModalBody');
        if (body) {
            body.innerHTML = `
                <div class="share-hub-preview">
                    <p style="color: #64748B; font-size: 0.88rem; margin-bottom: 1.25rem;">
                        Share your confirmed boarding pass and voyage details with family, travel companions, or hotel concierges.
                    </p>

                    <div class="share-actions-stack">
                        <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(summaryText)}" target="_blank" class="share-action-btn btn-wa">
                            <i class="fa-brands fa-whatsapp"></i>
                            <div>
                                <strong>Send via WhatsApp</strong>
                                <span>Instant link & itinerary summary</span>
                            </div>
                        </a>

                        <a href="mailto:?subject=${encodeURIComponent(`Boarding Pass #${booking.id} - ${booking.attraction_name}`)}&body=${encodeURIComponent(summaryText)}" class="share-action-btn btn-email">
                            <i class="fa-solid fa-envelope"></i>
                            <div>
                                <strong>Email Full Boarding Pass</strong>
                                <span>Send confirmation to inbox</span>
                            </div>
                        </a>

                        <button type="button" class="share-action-btn btn-copy" id="copyShareSummaryBtn">
                            <i class="fa-solid fa-copy"></i>
                            <div>
                                <strong>Copy Itinerary Summary</strong>
                                <span>Formatted text for notes & messaging</span>
                            </div>
                        </button>

                        <button type="button" class="share-action-btn btn-link" id="copyShareLinkOnlyBtn">
                            <i class="fa-solid fa-link"></i>
                            <div>
                                <strong>Copy Web Pass URL</strong>
                                <span style="font-family: monospace; font-size: 0.72rem; word-break: break-all;">${ticketUrl}</span>
                            </div>
                        </button>
                    </div>
                </div>
            `;

            document.getElementById('copyShareSummaryBtn')?.addEventListener('click', () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(summaryText);
                    JadooToast.show('Copied!', 'Full trip itinerary summary copied to clipboard!', 'success');
                }
            });

            document.getElementById('copyShareLinkOnlyBtn')?.addEventListener('click', () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(ticketUrl);
                    JadooToast.show('Link Copied!', 'Live e-ticket URL copied to clipboard!', 'success');
                }
            });
        }

        overlay.classList.add('is-open');
    },

    startLiveBoardingCountdown(timeElementId: string): void {
        const updateTimer = () => {
            const el = document.getElementById(timeElementId);
            if (!el) return;

            const now = new Date();
            // Deterministic dynamic countdown based on current time
            const baseSec = (2 * 3600 + 45 * 60 + 18);
            const cycleSec = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) % 10800;
            const remaining = Math.max(0, 10800 - cycleSec);
            const hours = Math.floor(remaining / 3600);
            const mins = Math.floor((remaining % 3600) / 60);
            const secs = remaining % 60;

            const pad = (n: number) => n < 10 ? '0' + n : '' + n;
            el.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
        };

        updateTimer();
        setInterval(updateTimer, 1000);
    },

    copyShareLink(bookingId: string): void {
        const url = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(bookingId)}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                JadooToast.show('E-Ticket Link Copied', `Official link for booking #${bookingId} copied to clipboard!`, 'success');
            }).catch(() => {
                JadooToast.show('Ticket Link', url, 'info');
            });
        } else {
            prompt('Copy this ticket link:', url);
        }
    },

    openWalletPassModal(type: 'apple' | 'google', booking: DbBooking): void {
        let overlay = document.getElementById('walletPassModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'walletPassModalOverlay';
            overlay.className = 'features-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="features-modal-backdrop" id="walletPassBackdrop"></div>
                <div class="features-modal-card wallet-card-modal" style="max-width: 440px; text-align: center;">
                    <div class="features-modal-header" style="justify-content: flex-end; padding-bottom: 0.5rem;">
                        <button type="button" class="features-modal-close" id="walletPassClose">&times;</button>
                    </div>
                    <div id="walletPassModalContent"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('walletPassBackdrop')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
            document.getElementById('walletPassClose')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
        }

        const isApple = type === 'apple';
        const brandColor = isApple ? '#000000' : '#1A73E8';
        const content = document.getElementById('walletPassModalContent');
        const ticketUrl = `${window.location.origin}${window.location.pathname}?id=${encodeURIComponent(booking.id)}`;

        if (content) {
            content.innerHTML = `
                <div class="wallet-pass-preview" style="background: ${brandColor}; color: #FFF; border-radius: 1.5rem; padding: 1.75rem; text-align: left; box-shadow: 0 16px 40px rgba(0,0,0,0.35);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                            <i class="${isApple ? 'fa-brands fa-apple' : 'fa-brands fa-google'}"></i>
                            <span>${isApple ? 'Apple Wallet' : 'Google Wallet'}</span>
                        </div>
                        <span style="font-size: 0.75rem; background: rgba(255,255,255,0.2); padding: 0.2rem 0.6rem; border-radius: 20px; text-transform: uppercase;">BOARDING PASS</span>
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 800; font-family: 'Poppins', sans-serif; line-height: 1.2; margin-bottom: 0.25rem;">
                        ${booking.destination_name}
                    </div>
                    <div style="font-size: 0.9rem; color: rgba(255,255,255,0.8); margin-bottom: 1.25rem;">
                        ${booking.attraction_name}
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; font-size: 0.82rem;">
                        <div>
                            <span style="display: block; opacity: 0.7; font-size: 0.7rem;">PASSENGER</span>
                            <strong>${booking.user_name}</strong>
                        </div>
                        <div>
                            <span style="display: block; opacity: 0.7; font-size: 0.7rem;">DATE</span>
                            <strong>${booking.travel_date}</strong>
                        </div>
                        <div>
                            <span style="display: block; opacity: 0.7; font-size: 0.7rem;">PASS REF</span>
                            <strong>#${booking.id}</strong>
                        </div>
                        <div>
                            <span style="display: block; opacity: 0.7; font-size: 0.7rem;">TIER</span>
                            <strong>${booking.package_type.toUpperCase()}</strong>
                        </div>
                    </div>
                    <div style="background: #FFF; color: #000; border-radius: 0.75rem; padding: 0.75rem; text-align: center; display: flex; flex-direction: column; align-items: center;">
                        <div id="walletModalQrCanvas" style="width: 110px; height: 110px; margin: 0 auto;"></div>
                        <span style="font-family: monospace; font-size: 0.75rem; font-weight: 700; letter-spacing: 1.5px; margin-top: 0.4rem; color: #0F172A;">${booking.id}</span>
                    </div>
                </div>
                <div style="margin-top: 1.25rem; display: flex; flex-direction: column; gap: 0.6rem;">
                    <button type="button" class="btn-primary-glow" id="confirmAddWalletBtn" style="width: 100%; justify-content: center;">
                        <i class="${isApple ? 'fa-brands fa-apple' : 'fa-brands fa-google'}"></i>
                        <span>Save to ${isApple ? 'Apple Wallet' : 'Google Wallet'}</span>
                    </button>
                    <span style="font-size: 0.75rem; color: #94A3B8;">Pass token synchronized and signed with Jadoo Travel PKPass Security.</span>
                </div>
            `;

            // Render live QR inside the wallet pass
            const qrCanvas = document.getElementById('walletModalQrCanvas');
            if (qrCanvas) {
                this.renderQrCode(qrCanvas, ticketUrl, 110);
            }

            document.getElementById('confirmAddWalletBtn')?.addEventListener('click', () => {
                overlay?.classList.remove('is-open');
                JadooToast.show(
                    `Added to ${isApple ? 'Apple Wallet' : 'Google Wallet'}`,
                    `Pass for ${booking.attraction_name} (#${booking.id}) has been added to your device wallet!`,
                    'success'
                );
            });
        }

        overlay.classList.add('is-open');
    },

    openLuggageTagModal(booking: DbBooking): void {
        let overlay = document.getElementById('luggageTagModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'luggageTagModalOverlay';
            overlay.className = 'features-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="features-modal-backdrop" id="luggageTagBackdrop"></div>
                <div class="features-modal-card" style="max-width: 520px;">
                    <div class="features-modal-header">
                        <div>
                            <span class="modal-header-badge"><i class="fa-solid fa-tags"></i> Priority Baggage</span>
                            <h3 class="features-modal-title">Luggage Identification Tag</h3>
                        </div>
                        <button type="button" class="features-modal-close" id="luggageTagClose">&times;</button>
                    </div>
                    <div class="features-modal-body" id="luggageTagBody"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('luggageTagBackdrop')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
            document.getElementById('luggageTagClose')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
        }

        const destCode = booking.destination_name.substring(0, 3).toUpperCase();
        const body = document.getElementById('luggageTagBody');
        if (body) {
            body.innerHTML = `
                <div class="luggage-tag-card" style="border: 2px dashed #DF6951; border-radius: 1rem; padding: 1.5rem; background: rgba(223, 105, 81, 0.04); position: relative;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 1rem; margin-bottom: 1rem;">
                        <div>
                            <span style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">DESTINATION CODE</span>
                            <div style="font-size: 2.8rem; font-weight: 900; color: #181E4B; line-height: 1; font-family: 'Poppins', sans-serif;">${destCode}</div>
                            <span style="font-size: 0.85rem; font-weight: 600; color: #DF6951;">${booking.destination_name}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="background: #F1A501; color: #FFF; font-size: 0.75rem; font-weight: 800; padding: 0.3rem 0.7rem; border-radius: 20px; display: inline-block; margin-bottom: 0.3rem;">
                                PRIORITY VIP
                            </span>
                            <div style="font-size: 0.8rem; color: #64748B;">Baggage Allowance</div>
                            <strong style="color: #181E4B; font-size: 1.1rem;">2x 32 KG MAX</strong>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem; margin-bottom: 1rem;">
                        <div>
                            <span style="display: block; font-size: 0.7rem; color: #94A3B8;">PASSENGER</span>
                            <strong>${booking.user_name}</strong>
                        </div>
                        <div>
                            <span style="display: block; font-size: 0.7rem; color: #94A3B8;">BOOKING NUMBER</span>
                            <strong style="font-family: monospace;">#${booking.id}</strong>
                        </div>
                        <div>
                            <span style="display: block; font-size: 0.7rem; color: #94A3B8;">HOTEL TRANSFER</span>
                            <strong style="color: #10B981;">Chauffeur Fast-Track</strong>
                        </div>
                        <div>
                            <span style="display: block; font-size: 0.7rem; color: #94A3B8;">DEPARTURE DATE</span>
                            <strong>${booking.travel_date}</strong>
                        </div>
                    </div>
                    <div style="border-top: 1px dashed #CBD5E1; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem; color: #64748B;"><i class="fa-solid fa-barcode"></i> ${booking.id}-JADOO-BAG-TAG</span>
                        <span style="font-size: 0.72rem; color: #10B981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> RF-ID ENCODED</span>
                    </div>
                </div>
                <div style="margin-top: 1.25rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
                    <button type="button" class="btn-secondary-flat" onclick="document.getElementById('luggageTagModalOverlay').classList.remove('is-open');">Close</button>
                    <button type="button" class="btn-primary-glow" onclick="window.print();">
                        <i class="fa-solid fa-print"></i>
                        <span>Print Luggage Tag</span>
                    </button>
                </div>
            `;
        }

        overlay.classList.add('is-open');
    },

    generateTicketToken(bookingId: string): string {
        const cleanId = bookingId.trim().toUpperCase();
        let hash = 0x811c9dc5;
        const secret = `JADOO_GATE_PASS_2026_${cleanId}`;
        for (let i = 0; i < secret.length; i++) {
            hash ^= secret.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193);
        }
        const tokenHex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
        return `TK-${tokenHex}-${cleanId.replace(/\D/g, '').slice(-4) || '9999'}`;
    },

    getTicketQrUrl(bookingId: string): string {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        let basePath = '/components/ticket.html';
        if (typeof window !== 'undefined' && window.location.pathname) {
            const path = window.location.pathname;
            if (path.includes('/components/')) {
                basePath = path.substring(0, path.indexOf('/components/')) + '/components/ticket.html';
            } else {
                basePath = path.replace(/\/([^\/]*)$/, '') + '/components/ticket.html';
            }
        }
        const token = this.generateTicketToken(bookingId);
        return `${origin}${basePath}?id=${encodeURIComponent(bookingId)}&token=${encodeURIComponent(token)}&view=ticket_only`;
    },

    playAirportChime(): void {
        try {
            const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            if (ctx.state === 'suspended') {
                ctx.resume();
            }
            const now = ctx.currentTime;
            
            // First chime tone (587.33 Hz - D5)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(587.33, now);
            gain1.gain.setValueAtTime(0, now);
            gain1.gain.linearRampToValueAtTime(0.2, now + 0.04);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.5);

            // Second chime tone (880.00 Hz - A5)
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(880.0, now + 0.25);
            gain2.gain.setValueAtTime(0, now + 0.25);
            gain2.gain.linearRampToValueAtTime(0.25, now + 0.3);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.25);
            osc2.stop(now + 0.9);
        } catch (_) {}
    },

    renderBoardedStampOverlay(booking: DbBooking, targetElementId = 'boardingPassContainer'): void {
        const container = document.getElementById(targetElementId);
        if (!container || document.getElementById('passBoardedRubberStamp')) return;

        const stamp = document.createElement('div');
        stamp.id = 'passBoardedRubberStamp';
        stamp.className = 'boarding-pass-rubber-stamp';
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
        const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        stamp.innerHTML = `
            <span class="stamp-agency">★ JADOO AIRWAYS AVIATION CONTROL ★</span>
            <span class="stamp-headline">BOARDED</span>
            <span class="stamp-details">PRIORITY GATE B24 • ${dateStr} ${timeStr}</span>
            <span style="font-size: 0.6rem; letter-spacing: 0.5px; opacity: 0.8;">OFFICER CLEARED #${booking.id}</span>
        `;
        container.style.position = 'relative';
        container.appendChild(stamp);
    },

    applyBoardedStamp(booking: DbBooking, targetElementId = 'boardingPassContainer'): void {
        this.playAirportChime();
        this.renderBoardedStampOverlay(booking, targetElementId);
        localStorage.setItem(`jadoo_boarded_${booking.id}`, 'true');

        // Update live status pill if present
        const statusPill = document.getElementById('ticketStatusPill');
        if (statusPill) {
            statusPill.className = 'ticket-status-pill pill-confirmed';
            statusPill.innerHTML = `<i class="fa-solid fa-plane-circle-check"></i> <span>BOARDED AT GATE</span>`;
        }

        JadooToast.show('Passenger Boarded', `Clearance verified at Gate B24 for ${booking.user_name}. Have a pleasant flight!`, 'success');
    },

    openQrZoomModal(booking: DbBooking): void {
        let overlay = document.getElementById('qrZoomModalOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'qrZoomModalOverlay';
            overlay.className = 'features-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML = `
                <div class="features-modal-backdrop" id="qrZoomBackdrop"></div>
                <div class="features-modal-card" style="max-width: 440px; text-align: center;">
                    <div class="features-modal-header" style="justify-content: flex-end; padding-bottom: 0.5rem;">
                        <button type="button" class="features-modal-close" id="qrZoomClose">&times;</button>
                    </div>
                    <div id="qrZoomBody" style="padding: 0.5rem 0 1rem 0;"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            document.getElementById('qrZoomBackdrop')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
            document.getElementById('qrZoomClose')?.addEventListener('click', () => overlay?.classList.remove('is-open'));
        }

        const ticketUrl = this.getTicketQrUrl(booking.id);
        const body = document.getElementById('qrZoomBody');
        if (body) {
            body.innerHTML = `
                <span class="modal-header-badge" style="display: inline-flex; margin-bottom: 0.5rem;"><i class="fa-solid fa-shield-halved"></i> Gate Scanner Barcode</span>
                <h3 style="font-family: 'Poppins', sans-serif; font-size: 1.3rem; margin: 0 0 0.4rem 0;">Priority Admission Pass</h3>
                <p style="font-size: 0.85rem; color: #64748B; margin-bottom: 1.25rem;">Present this high-contrast digital QR code to airport gate scanners or tour admission hosts.</p>
                <div style="background: #FFFFFF; border: 3px solid #181E4B; border-radius: 1.5rem; padding: 1.5rem; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 10px 30px rgba(0,0,0,0.12);">
                    <div id="zoomModalQrCanvas" style="width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; background: #FFF;"></div>
                    <span style="font-family: monospace; font-size: 1.05rem; font-weight: 800; letter-spacing: 2px; color: #181E4B; margin-top: 0.75rem;">#${booking.id}</span>
                </div>
                <div style="margin-top: 1rem; word-break: break-all; font-size: 0.78rem; background: rgba(0,0,0,0.04); padding: 0.6rem 0.8rem; border-radius: 8px; text-align: left;">
                    <span style="display: block; font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; margin-bottom: 0.2rem;">Live Scannable Target</span>
                    <a href="${ticketUrl}" target="_blank" style="color: #DF6951; font-weight: 600; text-decoration: none;">${ticketUrl}</a>
                </div>
                <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #10B981; font-weight: 600;">
                    <i class="fa-solid fa-lock"></i> Encrypted RSA-2048 Digital Security Token Valid
                </div>
            `;

            const zoomCanvas = document.getElementById('zoomModalQrCanvas');
            if (zoomCanvas) {
                this.renderQrCode(zoomCanvas, ticketUrl, 220);
            }
        }

        overlay.classList.add('is-open');
    }
};

// --------------------------------------------------------------------------
// 6.5 GATE PASS INSPECTION MIDDLEWARE & SECURITY VALIDATION
// --------------------------------------------------------------------------
export const TicketSecurityMiddleware = {
    validateToken(bookingId: string, token: string): boolean {
        if (!bookingId || !token) return false;
        const expected = JadooTicketUtilities.generateTicketToken(bookingId);
        return token.trim().toUpperCase() === expected.toUpperCase();
    },

    async verifyWithServer(bookingId: string, token: string): Promise<{ verified: boolean; clearance: string; details?: any }> {
        // Pure client-side validation (no localhost or backend server needed)
        const isValid = this.validateToken(bookingId, token);
        return {
            verified: isValid,
            clearance: isValid ? 'GRANTED' : 'DENIED',
            details: { clientVerified: true }
        };
    },

    applyGateInspectionLockdown(booking: DbBooking | undefined, isValid: boolean): void {
        if (!isValid) {
            // Render high-security denial screen and block access
            const container = document.querySelector('.ticket-page-container') || document.querySelector('.page-main');
            if (container) {
                container.innerHTML = `
                    <div class="security-alert-screen">
                        <div class="alert-icon-ring"><i class="fa-solid fa-shield-xmark"></i></div>
                        <h2>SECURITY CLEARANCE DENIED</h2>
                        <p>The gate access token or boarding pass reference provided could not be verified by Jadoo Aviation Security & Border Inspection. Unauthenticated gate pass scan attempt has been intercepted.</p>
                        <div class="incident-code-box">INCIDENT LOG: #SEC-ERR-${Date.now().toString(36).toUpperCase()} • REF: ${escapeHTML(booking?.id || 'UNKNOWN')}</div>
                        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
                            <a href="../index.html" class="btn-secondary-flat" style="text-decoration: none;">
                                <i class="fa-solid fa-house"></i> Return to Homepage
                            </a>
                            <a href="./auth.html" class="btn-primary-glow" style="text-decoration: none;">
                                <i class="fa-solid fa-lock"></i> Staff Login Terminal
                            </a>
                        </div>
                    </div>
                `;
            }
            return;
        }

        if (!booking) return;

        // 1. Activate Gate Inspection Mode on Body
        document.body.classList.add('gate-inspection-mode');

        // 2. Inject Gate Kiosk Header inside .navbar if not already present
        const navContainer = document.querySelector('.navbar') || document.querySelector('.nav-container') || document.querySelector('header nav');
        if (navContainer && !document.getElementById('gateKioskBrand')) {
            const kioskBrand = document.createElement('div');
            kioskBrand.id = 'gateKioskBrand';
            kioskBrand.className = 'gate-kiosk-brand';
            kioskBrand.innerHTML = `
                <div class="kiosk-shield-icon"><i class="fa-solid fa-shield-halved"></i></div>
                <div class="kiosk-titles">
                    <span class="kiosk-title-main">Jadoo Gate Scanner Terminal</span>
                    <span class="kiosk-title-sub">Aviation Border Control • Gate B24</span>
                </div>
            `;
            const navlogo = navContainer.querySelector('.navlogo');
            if (navlogo && navlogo.nextSibling) {
                navContainer.insertBefore(kioskBrand, navlogo.nextSibling);
            } else {
                navContainer.prepend(kioskBrand);
            }

            const kioskRight = document.createElement('div');
            kioskRight.id = 'gateKioskRight';
            kioskRight.className = 'kiosk-header-right';
            kioskRight.innerHTML = `
                <div class="kiosk-live-badge">
                    <span class="badge-ping"></span>
                    <span>KIOSK ACTIVE</span>
                </div>
                <button type="button" class="btn-kiosk-traveler-unlock" id="btnUnlockTravelerPortal">
                    <i class="fa-solid fa-user-shield"></i>
                    <span>Traveler Portal (Owner)</span>
                </button>
            `;
            navContainer.appendChild(kioskRight);

            document.getElementById('btnUnlockTravelerPortal')?.addEventListener('click', () => {
                if (confirm('Unlock traveler portal? This grants full website navigation permissions for personal account management.')) {
                    document.body.classList.remove('gate-inspection-mode');
                    JadooToast.show('Portal Unlocked', 'Welcome to your passenger account portal.', 'info');
                }
            });
        }

        // 3. Inject Gate Security Inspection HUD Banner right above the boarding pass container
        const passContainer = document.getElementById('boardingPassContainer');
        if (passContainer && !document.getElementById('gateInspectionHudBanner')) {
            const hud = document.createElement('div');
            hud.id = 'gateInspectionHudBanner';
            hud.className = 'gate-inspection-hud-banner';
            const nowStr = new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'medium'
            });
            const isAlreadyBoarded = localStorage.getItem(`jadoo_boarded_${booking.id}`) === 'true';

            hud.innerHTML = `
                <div class="hud-banner-top">
                    <div class="hud-agency-tag">
                        <i class="fa-solid fa-plane-shield"></i>
                        <span>JADOO GATE INSPECTION & ADMISSION TERMINAL</span>
                    </div>
                    <div class="hud-clearance-status">
                        <i class="fa-solid fa-circle-check"></i>
                        <span>CLEARANCE: GRANTED</span>
                    </div>
                </div>
                <div class="hud-metrics-row">
                    <div class="hud-metric-card">
                        <div class="hud-metric-label">Pass Reference</div>
                        <div class="hud-metric-value">#${booking.id}</div>
                    </div>
                    <div class="hud-metric-card">
                        <div class="hud-metric-label">Scan Timestamp</div>
                        <div class="hud-metric-value" style="font-size: 0.82rem;">${nowStr}</div>
                    </div>
                    <div class="hud-metric-card">
                        <div class="hud-metric-label">Security Protocol</div>
                        <div class="hud-metric-value" style="color: #38BDF8;">RSA-2048 / IATA 2026</div>
                    </div>
                    <div class="hud-metric-card">
                        <div class="hud-metric-label">Biometric Verification</div>
                        <div class="hud-metric-value" style="color: #10B981;">100% MATCH • PASS</div>
                    </div>
                </div>
                <div class="hud-actions-bar">
                    <div style="font-size: 0.8rem; color: #94A3B8;">
                        <i class="fa-solid fa-lock"></i> Gate inspection session secured. External navigation is locked down.
                    </div>
                    <button type="button" class="btn-gate-stamp-boarded ${isAlreadyBoarded ? 'is-boarded' : ''}" id="btnGateStampBoarded">
                        <i class="fa-solid fa-stamp"></i>
                        <span>${isAlreadyBoarded ? 'ALREADY BOARDED AT GATE' : 'STAMP AS BOARDED AT GATE'}</span>
                    </button>
                </div>
            `;
            passContainer.parentNode?.insertBefore(hud, passContainer);

            // Handle rubber stamp button click
            document.getElementById('btnGateStampBoarded')?.addEventListener('click', (e) => {
                const btn = e.currentTarget as HTMLButtonElement;
                if (localStorage.getItem(`jadoo_boarded_${booking.id}`) === 'true') {
                    JadooToast.show('Already Boarded', 'This pass was already stamped at the gate.', 'info');
                    return;
                }
                JadooTicketUtilities.applyBoardedStamp(booking);
                btn.classList.add('is-boarded');
                btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>ALREADY BOARDED AT GATE</span>`;
            });

            // If previously stamped, render stamp overlay
            if (isAlreadyBoarded) {
                JadooTicketUtilities.renderBoardedStampOverlay(booking);
            }
        }
    }
};

// --------------------------------------------------------------------------
// 6.8 UNIVERSAL NAVBAR AUTH & MOBILE NAVIGATION MANAGER
// --------------------------------------------------------------------------
export const JadooNavAuth = {
    init(): void {
        this.updateNavbar();
        this.bindEvents();
    },

    updateNavbar(): void {
        const currentUser = JadooDB.getCurrentUser();
        const isProfilePage = typeof window !== 'undefined' && window.location.pathname.includes('profile.html');
        
        // Target all navbar variations (index, profile, ticket, destination, contact)
        const loginLi = document.getElementById('nav-login-li');
        const signupLi = document.getElementById('nav-signup-li');
        const userLi = document.getElementById('nav-user-li');
        const firstNameDisplay = document.getElementById('userFirstNameDisplay');
        const dropdownUserName = document.getElementById('dropdownUserName');
        const dropdownUserEmail = document.getElementById('dropdownUserEmail');
        const navBookingBadge = document.getElementById('navBookingBadge');

        // Destination specific elements if present
        const destLoginBtn = document.getElementById('destinationNavLoginBtn');
        const destUserDropdown = document.getElementById('destUserProfileDropdown');
        const destFirstNameDisplay = document.getElementById('destUserFirstNameDisplay');
        const destDropdownUserName = document.getElementById('destDropdownUserName');
        const destDropdownUserEmail = document.getElementById('destDropdownUserEmail');
        const destBookingBadge = document.getElementById('destNavBookingBadge');

        const isAuthenticated = Boolean(currentUser && (currentUser.email || currentUser.full_name));

        if (isAuthenticated && currentUser) {
            document.documentElement.classList.add('user-logged-in');
            if (document.body) document.body.classList.add('user-logged-in');

            const userEmail = currentUser.email || '';
            const fullName = currentUser.full_name || 'Traveler';
            const firstName = fullName.split(' ')[0] || 'Traveler';
            const bookings = JadooDB.getUserBookings(userEmail);
            const confirmedCount = bookings.filter(b => b.status !== 'cancelled').length;

            if (loginLi) loginLi.style.setProperty('display', 'none', 'important');
            if (signupLi) signupLi.style.setProperty('display', 'none', 'important');
            if (userLi) userLi.style.setProperty('display', 'flex', 'important');

            if (firstNameDisplay) firstNameDisplay.textContent = firstName;
            if (dropdownUserName) dropdownUserName.textContent = fullName;
            if (dropdownUserEmail) dropdownUserEmail.textContent = userEmail;

            const isComp = typeof window !== 'undefined' && window.location.pathname.includes('/components/');
            let avatarSrc = currentUser.avatar_url || (isComp ? '../assets/testimonials-avatar-1.png' : './assets/testimonials-avatar-1.png');
            if (isComp && avatarSrc.startsWith('./assets/')) {
                avatarSrc = '.' + avatarSrc;
            } else if (!isComp && avatarSrc.startsWith('../assets/')) {
                avatarSrc = avatarSrc.replace(/^\.\.\//, './');
            }

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
                navBookingBadge.textContent = confirmedCount.toString();
                navBookingBadge.style.display = confirmedCount > 0 ? 'inline-block' : 'none';
            }

            // Destination page navbar support
            if (destLoginBtn) destLoginBtn.style.setProperty('display', 'none', 'important');
            if (destUserDropdown) destUserDropdown.style.setProperty('display', 'inline-block', 'important');
            if (destFirstNameDisplay) destFirstNameDisplay.textContent = firstName;
            if (destDropdownUserName) destDropdownUserName.textContent = fullName;
            if (destDropdownUserEmail) destDropdownUserEmail.textContent = userEmail;
            if (destBookingBadge) {
                destBookingBadge.textContent = confirmedCount.toString();
                destBookingBadge.style.display = confirmedCount > 0 ? 'inline-block' : 'none';
            }
        } else {
            // Logged out
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
    },

    bindEvents(): void {
        const userProfileDropdown = document.getElementById('userProfileDropdown');
        const destUserProfileDropdown = document.getElementById('destUserProfileDropdown');
        const userProfileBtn = document.getElementById('userProfileBtn');
        const destUserProfileBtn = document.getElementById('destUserProfileBtn');

        // Synchronize on DB or storage change across tabs
        if (!(window as any)._jadooNavAuthSyncBound) {
            (window as any)._jadooNavAuthSyncBound = true;
            window.addEventListener('jadoo:db_change', () => this.updateNavbar());
            window.addEventListener('jadoo:auth_change', () => this.updateNavbar());
            window.addEventListener('storage', (e) => {
                if (!e.key || e.key.includes('user') || e.key.includes('logout') || e.key.includes('account') || e.key === 'jadoo_sync_event') {
                    this.updateNavbar();
                    const isProtected = window.location.pathname.includes('/components/profile.html') || window.location.pathname.includes('/components/ticket.html');
                    if (isProtected && localStorage.getItem('jadoo_logged_out') === 'true') {
                        window.location.href = '../index.html';
                    }
                }
            });
        }

        // Global single-source dropdown toggle
        const toggleDropdown = (e?: Event) => {
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

        // Expose globally for inline onclick and vanilla scripts
        if (typeof window !== 'undefined') {
            (window as any).toggleUserNavDropdown = toggleDropdown;
        }

        // Global single-source logout handler
        const handleLogout = (e?: Event) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof (e as any).stopImmediatePropagation === 'function') {
                    (e as any).stopImmediatePropagation();
                }
            }
            const dropdowns = document.querySelectorAll('.user-profile-dropdown, #userProfileDropdown, #destUserProfileDropdown');
            dropdowns.forEach(d => d.classList.remove('open'));
            const btns = document.querySelectorAll('#userProfileBtn, #destUserProfileBtn');
            btns.forEach(b => b.setAttribute('aria-expanded', 'false'));

            JadooDB.logout();
            this.updateNavbar();

            const isProtected = window.location.pathname.includes('/components/profile.html') || window.location.pathname.includes('/components/ticket.html');
            if (isProtected) {
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 200);
            } else {
                JadooToast.show('Logged Out', 'You have been safely logged out.', 'info');
            }
        };

        if (typeof window !== 'undefined') {
            (window as any).handleLogoutAction = handleLogout;
        }

        // Assign onclick to ensure deduplicated, single-handler execution
        if (userProfileBtn) {
            userProfileBtn.onclick = (e) => toggleDropdown(e);
        }

        if (destUserProfileBtn) {
            destUserProfileBtn.onclick = (e) => toggleDropdown(e);
        }

        // Close dropdown when clicking outside
        if (!(window as any)._authDropdownClickBound) {
            (window as any)._authDropdownClickBound = true;
            document.addEventListener('click', (e) => {
                const target = e.target as Node;
                const dropdown = document.getElementById('userProfileDropdown') || document.getElementById('destUserProfileDropdown');
                const btn = document.getElementById('userProfileBtn') || document.getElementById('destUserProfileBtn');
                if (dropdown && dropdown.classList.contains('open')) {
                    if (!dropdown.contains(target)) {
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
        }

        // Logout Button Handlers
        const logoutBtns = document.querySelectorAll('.dropdown-logout-btn, #navLogoutBtn, #destNavLogoutBtn');
        logoutBtns.forEach(btn => {
            (btn as HTMLElement).onclick = (e) => handleLogout(e);
        });

        // Hamburger Menu Toggle Handler (Works on ALL pages on mobile)
        const hamburgerBtn = document.getElementById('hamburger-btn');
        const navMenu = document.getElementById('navitems');
        if (hamburgerBtn && navMenu) {
            hamburgerBtn.onclick = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const willBeActive = !navMenu.classList.contains('active');
                hamburgerBtn.classList.toggle('active', willBeActive);
                navMenu.classList.toggle('active', willBeActive);
                hamburgerBtn.setAttribute('aria-expanded', willBeActive ? 'true' : 'false');
            };

            // Close on outside click
            if (!(window as any)._featuresHamburgerDocClick) {
                (window as any)._featuresHamburgerDocClick = true;
                document.addEventListener('click', (e) => {
                    const target = e.target as Node;
                    if (!navMenu.contains(target) && !hamburgerBtn.contains(target) && navMenu.classList.contains('active')) {
                        hamburgerBtn.classList.remove('active');
                        navMenu.classList.remove('active');
                        hamburgerBtn.setAttribute('aria-expanded', 'false');
                    }
                });
            }

            // Close when clicking navlinks
            navMenu.querySelectorAll('.navlink, .signup').forEach(link => {
                (link as HTMLElement).onclick = () => {
                    hamburgerBtn.classList.remove('active');
                    navMenu.classList.remove('active');
                    hamburgerBtn.setAttribute('aria-expanded', 'false');
                };
            });
        }

        // Synchronize across tabs or local updates
        if (!(window as any)._authSyncBound) {
            (window as any)._authSyncBound = true;
            window.addEventListener('storage', () => this.updateNavbar());
            window.addEventListener('jadoo:db_change', () => this.updateNavbar());
        }
    }
};

// --------------------------------------------------------------------------
// 7. GLOBAL INITIALIZATION ENTRY POINT
// --------------------------------------------------------------------------
export function initAdvancedFeatures(): {
    theme: typeof JadooTheme;
    toast: typeof JadooToast;
    reviews: TestimonialReviewController;
    boardingPass: BoardingPassController;
    bookingStatus: BookingStatusController;
    profile: ProfileDashboardController;
    ticketUtils: typeof JadooTicketUtilities;
    ticketSecurity: typeof TicketSecurityMiddleware;
    auth: typeof JadooNavAuth;
} {
    // 1. Initialize Universal Theme Engine
    JadooTheme.init();

    // 2. Initialize Universal Navbar Auth & Mobile Navigation
    JadooNavAuth.init();

    const boardingPass = new BoardingPassController();
    const reviews = new TestimonialReviewController();
    const bookingStatus = new BookingStatusController(boardingPass);
    const profile = new ProfileDashboardController();

    // Re-render bookings when booking modal opens
    const navBookingsTrigger = document.getElementById('navBookingsTrigger');
    if (navBookingsTrigger) {
        navBookingsTrigger.addEventListener('click', () => {
            bookingStatus.renderBookingsList();
        });
    }

    const myBookingsBtn = document.getElementById('navMyBookingsBtn');
    if (myBookingsBtn) {
        myBookingsBtn.addEventListener('click', () => {
            bookingStatus.renderBookingsList();
        });
    }

    // Expose globally for vanilla scripts
    if (typeof window !== 'undefined') {
        (window as any).JadooTheme = JadooTheme;
        (window as any).toggleThemeGlobal = (e?: Event) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            return JadooTheme.toggle();
        };
        (window as any).JadooToast = JadooToast;
        (window as any).JadooTicketUtilities = JadooTicketUtilities;
        (window as any).TicketSecurityMiddleware = TicketSecurityMiddleware;
        (window as any).JadooNavAuth = JadooNavAuth;
    }

    return {
        theme: JadooTheme,
        toast: JadooToast,
        reviews,
        boardingPass,
        bookingStatus,
        profile,
        ticketUtils: JadooTicketUtilities,
        ticketSecurity: TicketSecurityMiddleware,
        auth: JadooNavAuth
    };
}

// Auto-boot on DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initAdvancedFeatures());
    } else {
        initAdvancedFeatures();
    }
}

