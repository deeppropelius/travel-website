"use strict";
/**
 * Jadoo Travel Agency - Universal Live Form Validation & Bottom-Center Notification Engine
 * - Real-time live validation on every user input across all forms and modals
 * - Inline visual feedback with success/error states and field-level error messages
 * - Prevents default browser alert dialogs and tooltip bubbles (novalidate)
 * - Intercepts native window.alert and window.confirm with sleek bottom-center toast notifications
 * - MutationObserver support for dynamically injected modals and components
 */
(function () {
    'use strict';
    // =========================================================================
    // 1. REGULAR EXPRESSIONS & COMMON PATTERNS
    // =========================================================================
    const PATTERNS = {
        name: /^[a-zA-Z\u00C0-\u024F\s'.-]{2,60}$/,
        email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/,
        phone: /^[\d\s+\-().]{6,25}$/,
        price: /^\$?\s*\d+(\.\d{1,2})?$/,
        hasUppercase: /[A-Z]/,
        hasLowercase: /[a-z]/,
        hasNumber: /[0-9]/,
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/
    };
    // =========================================================================
    // 2. BOTTOM-CENTER NOTIFICATION TOAST ENGINE & ALERT INTERCEPTION
    // =========================================================================
    function getToastContainer() {
        let container = document.getElementById('jadooToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'jadooToastContainer';
            container.className = 'jadoo-toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    function showCustomToast(title, desc = '', type = 'info', duration = 4000) {
        const jToast = window.JadooToast;
        if (jToast && typeof jToast.show === 'function' && jToast !== JadooValidationExport) {
            jToast.show(title, desc, type, duration);
            return;
        }
        const container = getToastContainer();
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
    // Suppress native alert boxes across the entire application and route to bottom-center toast
    if (typeof window !== 'undefined') {
        window.showToastNotification = showCustomToast;
        if (typeof window.JadooToast === 'undefined') {
            window.JadooToast = { show: showCustomToast };
        }
        window.alert = function (message) {
            const text = message === undefined || message === null ? '' : String(message);
            const lower = text.toLowerCase();
            let type = 'info';
            let title = 'Notification';
            if (lower.includes('error') || lower.includes('fail') || lower.includes('invalid') || lower.includes('denied')) {
                type = 'error';
                title = 'Alert';
            }
            else if (lower.includes('warning') || lower.includes('required') || lower.includes('incomplete') || lower.includes('caution')) {
                type = 'warning';
                title = 'Notice';
            }
            else if (lower.includes('success') || lower.includes('confirmed') || lower.includes('saved') || lower.includes('updated')) {
                type = 'success';
                title = 'Success';
            }
            showCustomToast(title, text, type);
        };
        // Ensure window.confirm is replaced so native blocking popup boxes are never displayed
        window.confirm = function (message) {
            if (message) {
                showCustomToast('Notice', String(message), 'info', 3500);
            }
            return true;
        };
    }
    // =========================================================================
    // 3. FIELD-SPECIFIC VALIDATION REGISTRY
    // =========================================================================
    const specificValidators = {
        // --- Full Name Fields ---
        'signup-fullname': validateFullName,
        'bookingFullName': validateFullName,
        'contactFullName': validateFullName,
        'reviewAuthorName': validateFullName,
        'settingsFullName': validateFullName,
        'profileInputName': validateFullName,
        // --- Email Address Fields ---
        'signup-email': validateEmail,
        'bookingEmail': validateEmail,
        'contactEmail': validateEmail,
        'settingsEmail': validateEmail,
        'subscribeEmail': validateEmail,
        // --- Authentication Fields ---
        'user-id': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'Email or User ID is required.';
            if (trimmed.includes('@')) {
                return validateEmail(trimmed);
            }
            if (trimmed.length < 2)
                return 'Identifier must be at least 2 characters.';
            return '';
        },
        'signin-password': (value) => {
            if (!value)
                return 'Password is required.';
            return '';
        },
        'signup-password': (value) => {
            if (!value)
                return 'Password is required.';
            if (value.length < 8)
                return 'Password must be at least 8 characters long.';
            if (!PATTERNS.hasUppercase.test(value))
                return 'Include at least one uppercase letter (A-Z).';
            if (!PATTERNS.hasLowercase.test(value))
                return 'Include at least one lowercase letter (a-z).';
            if (!PATTERNS.hasNumber.test(value))
                return 'Include at least one number (0-9).';
            if (!PATTERNS.hasSpecial.test(value))
                return 'Include at least one special character (!@#$%&*).';
            return '';
        },
        // --- Phone Number Fields ---
        'bookingPhone': validateOptionalPhone,
        'profileInputPhone': validateOptionalPhone,
        'settingsPhone': validateOptionalPhone,
        'contactBookingRef': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return ''; // Optional
            if (/^[\d\s+\-().]+$/.test(trimmed)) {
                return validateOptionalPhone(trimmed);
            }
            return '';
        },
        // --- Profile Page Fields ---
        'settingsNationality': validateNationality,
        'settingsEmergency': validateEmergencyContact,
        'settingsBio': (value) => {
            if (value && value.length > 500)
                return 'Traveler bio cannot exceed 500 characters.';
            return '';
        },
        // --- Travel Booking Modal Fields ---
        'bookingDate': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'Travel date is required.';
            const selectedDate = new Date(trimmed);
            if (isNaN(selectedDate.getTime()))
                return 'Please enter a valid date.';
            const todayStr = new Date().toISOString().split('T')[0];
            if (trimmed < todayStr)
                return 'Travel date cannot be in the past.';
            return '';
        },
        'bookingGuests': (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 15)
                return 'Guests must be between 1 and 15.';
            return '';
        },
        'bookingPackage': (value) => {
            if (!value || value.trim() === '')
                return 'Please select a package tier.';
            return '';
        },
        'bookingRequests': (value) => {
            if (value.length > 500)
                return 'Special requests cannot exceed 500 characters.';
            return '';
        },
        // --- Contact Page Fields ---
        'contactSubject': (value) => {
            if (!value || value.trim() === '')
                return 'Please select an inquiry topic.';
            return '';
        },
        'contactMessage': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'Please detail your travel inquiry.';
            if (trimmed.length < 10)
                return 'Inquiry message must be at least 10 characters.';
            return '';
        },
        // --- Testimonial / Review Modal Fields ---
        'reviewQuote': validateReviewQuote,
        'reviewDestinationSelect': (value) => {
            if (!value || value.trim() === '')
                return 'Please select which destination you visited.';
            return '';
        },
        'reviewAuthorLocation': validateAuthorLocation,
        'reviewRoleTitle': validateRoleTitle,
        'reviewTripTag': validateTripTag,
        // --- Services Creation & Inquiry Fields ---
        'inqTripSelect': (value) => {
            if (!value || value.trim() === '')
                return 'Please select an active trip to attach this service.';
            return '';
        },
        'newServiceTitle': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'Service title is required.';
            if (trimmed.length < 3)
                return 'Title must be at least 3 characters.';
            return '';
        },
        'newServiceCategory': (value) => {
            if (!value || value.trim() === '')
                return 'Please select a service category.';
            return '';
        },
        'newServicePrice': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'Starting price is required.';
            if (!PATTERNS.price.test(trimmed))
                return 'Please enter a valid price (e.g. $150 or 150).';
            return '';
        },
        'newServiceUnit': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'Pricing unit is required (e.g. per charter, per day).';
            if (trimmed.length < 2)
                return 'Pricing unit must be at least 2 characters.';
            return '';
        },
        'newServiceShortDesc': (value) => {
            const trimmed = value.trim();
            if (!trimmed)
                return 'A brief description is required.';
            if (trimmed.length < 10)
                return 'Description must be at least 10 characters.';
            return '';
        }
    };
    function validateFullName(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return 'Full Name is required.';
        if (/\d/.test(trimmed))
            return 'Full Name must contain only letters (no numbers).';
        if (trimmed.length < 2)
            return 'Full Name must be at least 2 characters.';
        if (trimmed.length > 60)
            return 'Full Name cannot exceed 60 characters.';
        if (!/^[a-zA-Z\u00C0-\u024F\s'.-]+$/.test(trimmed)) {
            return 'Full Name can only contain letters, spaces, hyphens, and apostrophes.';
        }
        const letterCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
        if (letterCount < 2) {
            return 'Full Name must contain at least 2 letters.';
        }
        return '';
    }
    function validateEmail(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return 'Email address is required.';
        if (/\s/.test(trimmed))
            return 'Email address cannot contain spaces.';
        if (!trimmed.includes('@'))
            return 'Email address must include an "@" symbol.';
        const parts = trimmed.split('@');
        if (parts.length !== 2 || !parts[0] || !parts[1])
            return 'Please enter a valid email address (e.g. name@domain.com).';
        const [localPart, domainPart] = parts;
        if (localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..')) {
            return 'Invalid email username: cannot start, end, or have consecutive dots.';
        }
        if (!domainPart.includes('.'))
            return 'Email domain must include a top-level domain (e.g. .com).';
        if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.includes('..')) {
            return 'Invalid email domain: cannot start, end, or have consecutive dots.';
        }
        const domainParts = domainPart.split('.');
        const tld = domainParts[domainParts.length - 1];
        if (!tld || tld.length < 2)
            return 'Please enter a valid domain extension (e.g. .com, .org).';
        if (!PATTERNS.email.test(trimmed))
            return 'Please enter a valid email address (e.g. name@domain.com).';
        return '';
    }
    function validateStrictPhone(value, isRequired = false, fieldName = 'Phone number') {
        const trimmed = (value || '').trim();
        if (!trimmed) {
            return isRequired ? `${fieldName} is required.` : '';
        }
        // Check for letters
        if (/[a-zA-Z]/.test(trimmed)) {
            return `${fieldName} cannot contain letters.`;
        }
        // Check '+' placement and count: only permitted once and only as the very first character
        const plusCount = (trimmed.match(/\+/g) || []).length;
        if (plusCount > 1 || (plusCount === 1 && !trimmed.startsWith('+'))) {
            return `'+' is only permitted once at the beginning of the phone number.`;
        }
        // Disallow illegal characters (only digits, leading +, spaces, hyphens, dots, parentheses allowed)
        if (!/^\+?[0-9\s\-().]+$/.test(trimmed)) {
            return `${fieldName} can only contain digits and standard separators (+, -, spaces, parentheses, dots).`;
        }
        // Check balanced parentheses
        const openParen = (trimmed.match(/\(/g) || []).length;
        const closeParen = (trimmed.match(/\)/g) || []).length;
        if (openParen !== closeParen || openParen > 1) {
            return 'Please use balanced parentheses around the area code (e.g. (555) 234-5678).';
        }
        // Check consecutive punctuation
        if (/[-.]{2,}/.test(trimmed) || /\(\)/.test(trimmed)) {
            return 'Invalid phone number format: consecutive punctuation is not permitted.';
        }
        // Extract pure digits
        const digits = trimmed.replace(/\D/g, '');
        // E.164 standard: minimum 7 digits, maximum 15 digits
        if (digits.length < 7) {
            return `${fieldName} is too short (minimum 7 digits required).`;
        }
        if (digits.length > 15) {
            return `${fieldName} cannot exceed 15 digits (ITU-T E.164 international standard).`;
        }
        // International country code cannot start with 0
        if (trimmed.startsWith('+0')) {
            return 'Invalid country code: country codes cannot start with 0.';
        }
        // Disallow all identical digits (e.g., 0000000000, 1111111111, 9999999999)
        if (/^(\d)\1+$/.test(digits)) {
            return 'Please enter a realistic phone number (cannot be repeating identical digits).';
        }
        // Disallow sequential test patterns (e.g., 1234567890, 0123456789, 9876543210)
        const sequentialAscending = '0123456789012345';
        const sequentialDescending = '9876543210987654';
        if (sequentialAscending.includes(digits) || sequentialDescending.includes(digits)) {
            return 'Please enter a realistic phone number (sequential test numbers are not permitted).';
        }
        return '';
    }
    function validateOptionalPhone(value) {
        return validateStrictPhone(value, false, 'Phone number');
    }
    function validateEmergencyContact(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return ''; // Optional unless entered
        // An emergency contact must have a reachable phone number
        const digits = trimmed.replace(/\D/g, '');
        if (digits.length === 0) {
            return 'Emergency contact must include a reachable phone number (minimum 7 digits, e.g. Mom: +1 555-0199 or +1 555-0199).';
        }
        if (digits.length < 7) {
            return 'Emergency contact phone number is too short (minimum 7 digits required).';
        }
        if (digits.length > 15) {
            return 'Emergency contact phone number cannot exceed 15 digits (E.164 standard).';
        }
        // Disallow all identical digits
        if (/^(\d)\1+$/.test(digits)) {
            return 'Emergency contact phone number cannot be repeating identical digits.';
        }
        // Disallow sequential test digits
        const sequentialAscending = '0123456789012345';
        const sequentialDescending = '9876543210987654';
        if (sequentialAscending.includes(digits) || sequentialDescending.includes(digits)) {
            return 'Emergency contact phone number cannot be sequential test digits.';
        }
        return '';
    }
    function validateNationality(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return ''; // Optional
        if (/\d/.test(trimmed))
            return 'Passport nationality must contain only letters (no numbers).';
        if (trimmed.length < 2)
            return 'Nationality must be at least 2 characters.';
        if (trimmed.length > 50)
            return 'Nationality cannot exceed 50 characters.';
        if (!/^[a-zA-Z\u00C0-\u024F\s'.-]+$/.test(trimmed))
            return 'Nationality can only contain letters and spaces.';
        const letterCount = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
        if (letterCount < 2)
            return 'Nationality must contain at least 2 letters.';
        return '';
    }
    function validateAuthorLocation(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return ''; // Optional
        if (/^\d+$/.test(trimmed))
            return 'Location / City cannot be numbers only (e.g. London, UK).';
        if (trimmed.length < 2)
            return 'Location / City must be at least 2 characters.';
        if (trimmed.length > 60)
            return 'Location / City cannot exceed 60 characters.';
        const letters = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
        if (letters < 2)
            return 'Location / City must contain at least 2 letters (e.g. London, UK).';
        if (!/^[a-zA-Z\u00C0-\u024F0-9\s'.,\/-]+$/.test(trimmed))
            return 'Location / City contains invalid special characters.';
        return '';
    }
    function validateRoleTitle(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return ''; // Optional
        if (/^\d+$/.test(trimmed))
            return 'Role or Profession cannot be numbers only (e.g. Travel Photographer).';
        if (trimmed.length < 2)
            return 'Role or Profession must be at least 2 characters.';
        if (trimmed.length > 60)
            return 'Role or Profession cannot exceed 60 characters.';
        const letters = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
        if (letters < 2)
            return 'Role or Profession must contain at least 2 letters.';
        if (!/^[a-zA-Z\u00C0-\u024F0-9\s'.,\/-]+$/.test(trimmed))
            return 'Role or Profession contains invalid special characters.';
        return '';
    }
    function validateTripTag(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return ''; // Optional
        if (/^\d+$/.test(trimmed))
            return 'Trip Tagline cannot be numbers only (e.g. European Grand Tour).';
        if (trimmed.length < 2)
            return 'Trip Tagline must be at least 2 characters.';
        if (trimmed.length > 80)
            return 'Trip Tagline cannot exceed 80 characters.';
        const letters = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
        if (letters < 2)
            return 'Trip Tagline must contain at least 2 letters.';
        return '';
    }
    function validateReviewQuote(value) {
        const trimmed = (value || '').trim();
        if (!trimmed)
            return 'Please share your travel experience.';
        if (trimmed.length < 10)
            return 'Review must be at least 10 characters long.';
        if (trimmed.length > 1000)
            return 'Review cannot exceed 1000 characters.';
        const letters = (trimmed.match(/[a-zA-Z\u00C0-\u024F]/g) || []).length;
        if (letters < 5)
            return 'Review must contain meaningful text describing your trip.';
        return '';
    }
    // =========================================================================
    // 4. GENERIC HEURISTIC VALIDATOR (FALLBACK FOR ANY UNKNOWN FIELD)
    // =========================================================================
    function getGenericErrorMessage(input) {
        const val = input.value;
        const trimmed = val ? val.trim() : '';
        const isRequired = input.hasAttribute('required') || input.required;
        // If field is empty
        if (!trimmed) {
            if (isRequired) {
                const label = findFieldLabel(input);
                if (label)
                    return `${label} is required.`;
                return 'This field is required.';
            }
            return '';
        }
        // Check HTML5 input types
        if (input instanceof HTMLInputElement) {
            const type = (input.type || '').toLowerCase();
            if (type === 'email') {
                return validateEmail(trimmed);
            }
            if (type === 'tel') {
                return validateOptionalPhone(trimmed);
            }
            if (type === 'url') {
                try {
                    new URL(trimmed);
                }
                catch {
                    return 'Please enter a valid web URL.';
                }
            }
            if (type === 'number') {
                const num = parseFloat(trimmed);
                if (isNaN(num))
                    return 'Please enter a valid number.';
                if (input.min && num < parseFloat(input.min))
                    return `Value must be at least ${input.min}.`;
                if (input.max && num > parseFloat(input.max))
                    return `Value cannot exceed ${input.max}.`;
            }
            if (type === 'date') {
                const d = new Date(trimmed);
                if (isNaN(d.getTime()))
                    return 'Please enter a valid date.';
                if (input.min && trimmed < input.min)
                    return `Date cannot be earlier than ${input.min}.`;
                if (input.max && trimmed > input.max)
                    return `Date cannot be later than ${input.max}.`;
            }
            if (input.pattern) {
                try {
                    const regex = new RegExp(`^${input.pattern}$`);
                    if (!regex.test(trimmed)) {
                        return input.title || 'Please match the requested format.';
                    }
                }
                catch (_) { }
            }
        }
        // Check minlength / maxlength
        const minLen = input.getAttribute('minlength');
        if (minLen && trimmed.length < parseInt(minLen, 10)) {
            return `Must be at least ${minLen} characters.`;
        }
        const maxLen = input.getAttribute('maxlength');
        if (maxLen && trimmed.length > parseInt(maxLen, 10)) {
            return `Cannot exceed ${maxLen} characters.`;
        }
        // Required textarea check
        if (input instanceof HTMLTextAreaElement && isRequired && trimmed.length < 5) {
            return 'Please enter at least 5 characters.';
        }
        return '';
    }
    function findFieldLabel(input) {
        const id = input.id;
        if (id) {
            const labelEl = document.querySelector(`label[for="${id}"]`);
            if (labelEl) {
                return labelEl.textContent?.replace(/[*:]/g, '').trim() || '';
            }
        }
        if (input.getAttribute('placeholder')) {
            return input.getAttribute('placeholder')?.replace(/e\.g\.|\.\.\./gi, '').trim() || '';
        }
        if (input.getAttribute('aria-label')) {
            return input.getAttribute('aria-label') || '';
        }
        return '';
    }
    // =========================================================================
    // 5. VISUAL ERROR & SUCCESS STATE MANAGEMENT
    // =========================================================================
    function getOrCreateErrorElement(inputEl) {
        const id = inputEl.id;
        if (id) {
            const existing = document.getElementById(id + '-error') || document.getElementById(id + 'Error');
            if (existing)
                return existing;
        }
        // Check if an error element already exists as sibling
        const siblingError = inputEl.parentElement?.querySelector('.field-error-msg, .booking-field-error');
        if (siblingError)
            return siblingError;
        const errorEl = document.createElement('span');
        if (id)
            errorEl.id = id + '-error';
        errorEl.className = 'field-error-msg';
        errorEl.setAttribute('role', 'alert');
        // Smart layout-aware placement
        const wrapper = inputEl.closest('.booking-input-wrap') ||
            inputEl.closest('.input-with-icon') ||
            inputEl.closest('.password-input-wrapper') ||
            inputEl.closest('.sdinp');
        if (wrapper && wrapper.parentElement) {
            wrapper.insertAdjacentElement('afterend', errorEl);
        }
        else {
            inputEl.insertAdjacentElement('afterend', errorEl);
        }
        return errorEl;
    }
    function showError(inputEl, message) {
        if (!inputEl)
            return;
        inputEl.classList.add('input-error');
        inputEl.classList.remove('input-success');
        inputEl.setAttribute('aria-invalid', 'true');
        const errorEl = getOrCreateErrorElement(inputEl);
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }
    function clearError(inputEl) {
        if (!inputEl)
            return;
        inputEl.classList.remove('input-error');
        inputEl.removeAttribute('aria-invalid');
        const id = inputEl.id;
        let errorEl = null;
        if (id) {
            errorEl = document.getElementById(id + '-error') || document.getElementById(id + 'Error');
        }
        if (!errorEl && inputEl.parentElement) {
            errorEl = inputEl.parentElement.querySelector('.field-error-msg, .booking-field-error');
        }
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
        }
        // Add subtle success indicator if input has value
        const val = inputEl.value;
        if (val && val.trim().length > 0) {
            inputEl.classList.add('input-success');
        }
        else {
            inputEl.classList.remove('input-success');
        }
    }
    // =========================================================================
    // 6. VALIDATION EXECUTION
    // =========================================================================
    function validateField(inputEl) {
        if (!inputEl)
            return true;
        if (!(inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement || inputEl instanceof HTMLSelectElement)) {
            return true;
        }
        // Skip hidden or disabled inputs
        if (inputEl.type === 'hidden' || inputEl.disabled)
            return true;
        const id = inputEl.id;
        let errorMessage = '';
        if (id && specificValidators[id]) {
            errorMessage = specificValidators[id](inputEl.value, inputEl);
        }
        else {
            errorMessage = getGenericErrorMessage(inputEl);
        }
        if (errorMessage) {
            showError(inputEl, errorMessage);
            return false;
        }
        else {
            clearError(inputEl);
            return true;
        }
    }
    function validateForm(formEl) {
        if (!formEl)
            return true;
        const formInputs = Array.from(formEl.querySelectorAll('input, textarea, select'));
        let isValid = true;
        let firstInvalidInput = null;
        for (const input of formInputs) {
            if (input.type === 'hidden' || input.disabled)
                continue;
            const fieldValid = validateField(input);
            if (!fieldValid && !firstInvalidInput) {
                firstInvalidInput = input;
                isValid = false;
            }
            else if (!fieldValid) {
                isValid = false;
            }
        }
        if (firstInvalidInput) {
            firstInvalidInput.focus();
        }
        return isValid;
    }
    // =========================================================================
    // 7. EVENT LISTENER BINDING
    // =========================================================================
    function attachFieldListeners(input) {
        if (input.dataset.validationBound)
            return;
        input.dataset.validationBound = 'true';
        // Live real-time validation on keystroke / input
        input.addEventListener('input', () => {
            validateField(input);
        });
        input.addEventListener('keyup', () => {
            validateField(input);
        });
        // Validation on blur
        input.addEventListener('blur', () => {
            validateField(input);
        });
        // Instant validation on change (selects, dates, radio/checkboxes)
        input.addEventListener('change', () => {
            validateField(input);
        });
    }
    function attachFormListeners(form) {
        // Suppress browser default alert tooltip bubbles
        form.setAttribute('novalidate', 'true');
        if (form.dataset.validationBound)
            return;
        form.dataset.validationBound = 'true';
        // Intercept form submission in capture phase
        form.addEventListener('submit', (e) => {
            const isValid = validateForm(form);
            if (!isValid) {
                e.preventDefault();
                e.stopImmediatePropagation();
                showCustomToast('Form Incomplete', 'Please check the highlighted fields and correct errors.', 'error');
            }
        }, true);
    }
    function initLiveValidation() {
        // Attach to all existing forms
        document.querySelectorAll('form').forEach(form => {
            attachFormListeners(form);
        });
        // Attach to all existing user inputs
        document.querySelectorAll('input, textarea, select').forEach(input => {
            attachFieldListeners(input);
        });
    }
    // =========================================================================
    // 8. DYNAMIC DOM OBSERVATION (MODALS, SLIDERS, AJAX INJECTIONS)
    // =========================================================================
    function setupMutationObserver() {
        if (typeof MutationObserver === 'undefined')
            return;
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node;
                        if (el.tagName === 'FORM') {
                            attachFormListeners(el);
                        }
                        else {
                            el.querySelectorAll?.('form').forEach(attachFormListeners);
                        }
                        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
                            attachFieldListeners(el);
                        }
                        else {
                            el.querySelectorAll?.('input, textarea, select').forEach(attachFieldListeners);
                        }
                    }
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    // Auto-bootstrap when DOM is ready
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                initLiveValidation();
                setupMutationObserver();
            });
        }
        else {
            initLiveValidation();
            setupMutationObserver();
        }
    }
    // Export validation API to window for modular script access
    const JadooValidationExport = {
        validateField,
        validateForm,
        showError,
        clearError,
        showToast: showCustomToast,
        initLiveValidation,
        validateStrictPhone,
        validateFullName,
        validateEmail,
        validateEmergencyContact,
        validateNationality,
        validateAuthorLocation,
        validateRoleTitle,
        validateTripTag,
        validateReviewQuote
    };
    if (typeof window !== 'undefined') {
        window.JadooValidation = JadooValidationExport;
        window.AuthValidation = JadooValidationExport; // Backwards compatibility for existing auth references
    }
})();
