/**
 * Jadoo - Authentication Form Validation
 * Provides real-time and submission validation for Sign In and Sign Up forms.
 */

// Types and Interfaces
interface ValidatorFn {
    (value: string): string;
}

interface PasswordStrength {
    score: number;
    label: 'Weak' | 'Fair' | 'Good' | 'Strong';
    color: string;
    checks: {
        length: boolean;
        uppercase: boolean;
        lowercase: boolean;
        number: boolean;
        special: boolean;
    };
}

interface AuthValidationAPI {
    validateField: (inputEl: HTMLInputElement | null) => boolean;
    validateForm: (formEl: HTMLFormElement | null) => boolean;
    showError: (inputEl: HTMLInputElement | null, message: string) => void;
    clearError: (inputEl: HTMLInputElement | null) => void;
    evaluatePasswordStrength: (password: string) => PasswordStrength;
    initPasswordToggles: () => void;
}

interface Window {
    AuthValidation?: AuthValidationAPI;
}

(function (): void {
    'use strict';

    // Regular Expressions
    const PATTERNS: Record<string, RegExp> = {
        name: /^[a-zA-Z\s'-]{2,50}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
        hasUppercase: /[A-Z]/,
        hasLowercase: /[a-z]/,
        hasNumber: /[0-9]/,
        hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/
    };

    // Validation Rules
    const validators: Record<string, ValidatorFn> = {
        'signup-fullname': (value: string): string => {
            const trimmed = value.trim();
            if (!trimmed) return 'Full Name is required.';
            if (trimmed.length < 2) return 'Name must be at least 2 characters.';
            if (!PATTERNS.name.test(trimmed)) return 'Name can only contain letters, spaces, hyphens, and apostrophes.';
            return '';
        },
        'signup-email': (value: string): string => {
            const trimmed = value.trim();
            if (!trimmed) return 'Email address is required.';
            if (!PATTERNS.email.test(trimmed)) return 'Please enter a valid email address (e.g. name@domain.com).';
            return '';
        },
        'signup-password': (value: string): string => {
            if (!value) return 'Password is required.';
            if (value.length < 8) return 'Password must be at least 8 characters long.';
            if (!PATTERNS.hasUppercase.test(value)) return 'Password must include at least one uppercase letter (A-Z).';
            if (!PATTERNS.hasLowercase.test(value)) return 'Password must include at least one lowercase letter (a-z).';
            if (!PATTERNS.hasNumber.test(value)) return 'Password must include at least one number (0-9).';
            if (!PATTERNS.hasSpecial.test(value)) return 'Password must include at least one special character (e.g. !@#$%&*).';
            return '';
        },
        'user-id': (value: string): string => {
            const trimmed = value.trim();
            if (!trimmed) return 'Email or ID is required.';
            if (trimmed.includes('@') && !PATTERNS.email.test(trimmed)) {
                return 'Please enter a valid email address.';
            }
            return '';
        },
        'signin-password': (value: string): string => {
            if (!value) return 'Password is required.';
            return '';
        }
    };

    /**
     * Show validation error for an input element
     */
    function showError(inputEl: HTMLInputElement | null, message: string): void {
        if (!inputEl) return;
        inputEl.classList.add('input-error');
        inputEl.classList.remove('input-success');
        inputEl.setAttribute('aria-invalid', 'true');

        let errorEl = document.getElementById(inputEl.id + '-error');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.id = inputEl.id + '-error';
            errorEl.className = 'field-error-msg';
            errorEl.setAttribute('role', 'alert');
            const targetContainer = inputEl.closest('.input-group') || inputEl.closest('.password-input-wrapper') || inputEl;
            targetContainer.insertAdjacentElement('beforeend', errorEl);
        }
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }

    /**
     * Clear validation error for an input element
     */
    function clearError(inputEl: HTMLInputElement | null): void {
        if (!inputEl) return;
        inputEl.classList.remove('input-error');
        inputEl.removeAttribute('aria-invalid');

        const errorEl = document.getElementById(inputEl.id + '-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
        }

        // Add subtle success indicator if input has value
        if (inputEl.value.trim().length > 0) {
            inputEl.classList.add('input-success');
        } else {
            inputEl.classList.remove('input-success');
        }
    }

    /**
     * Evaluate password strength scoring (0 to 4)
     */
    function evaluatePasswordStrength(password: string): PasswordStrength {
        const checks = {
            length: password.length >= 8,
            uppercase: PATTERNS.hasUppercase.test(password),
            lowercase: PATTERNS.hasLowercase.test(password),
            number: PATTERNS.hasNumber.test(password),
            special: PATTERNS.hasSpecial.test(password)
        };

        const passedCount = Object.values(checks).filter(Boolean).length;
        let score = 0;
        let label: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
        let color = '#EF4444';

        if (passedCount <= 2) {
            score = 1;
            label = 'Weak';
            color = '#EF4444';
        } else if (passedCount === 3) {
            score = 2;
            label = 'Fair';
            color = '#F59E0B';
        } else if (passedCount === 4) {
            score = 3;
            label = 'Good';
            color = '#3B82F6';
        } else if (passedCount === 5) {
            score = 4;
            label = 'Strong';
            color = '#10B981';
        }

        return { score, label, color, checks };
    }

    /**
     * Update visual strength meter for password
     */
    function updatePasswordStrengthMeter(value: string): void {
        const meter = document.getElementById('signup-password-strength');
        const labelEl = document.getElementById('signup-password-strength-label');
        if (!meter) return;

        if (!value) {
            meter.style.display = 'none';
            return;
        }

        meter.style.display = 'flex';
        const strength = evaluatePasswordStrength(value);
        const segments = meter.querySelectorAll<HTMLElement>('.strength-segment');

        segments.forEach((seg, index) => {
            if (index < strength.score) {
                seg.style.backgroundColor = strength.color;
            } else {
                seg.style.backgroundColor = '';
            }
        });

        if (labelEl) {
            labelEl.textContent = `Password strength: ${strength.label}`;
            labelEl.style.color = strength.color;
        }
    }

    /**
     * Ensure password strength meter DOM element exists
     */
    function ensurePasswordStrengthMeter(inputEl: HTMLInputElement): void {
        if (document.getElementById('signup-password-strength')) return;

        const meter = document.createElement('div');
        meter.className = 'password-strength-meter';
        meter.id = 'signup-password-strength';
        meter.style.display = 'none';
        meter.innerHTML = `
            <div class="strength-bars">
                <div class="strength-segment"></div>
                <div class="strength-segment"></div>
                <div class="strength-segment"></div>
                <div class="strength-segment"></div>
            </div>
            <span class="strength-label" id="signup-password-strength-label">Password strength: Weak</span>
        `;

        const targetContainer = inputEl.closest('.input-group') || inputEl;
        const errorEl = document.getElementById(inputEl.id + '-error');
        if (errorEl && errorEl.parentElement === targetContainer) {
            targetContainer.insertBefore(meter, errorEl);
        } else {
            targetContainer.appendChild(meter);
        }
    }

    /**
     * Initialize show/hide password buttons
     */
    function initPasswordToggles(): void {
        const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"], input[data-password-toggle="true"]');

        passwordInputs.forEach((input: HTMLInputElement) => {
            input.setAttribute('data-password-toggle', 'true');
            let wrapper = input.closest('.password-input-wrapper') as HTMLElement | null;
            let btn = wrapper ? wrapper.querySelector<HTMLButtonElement>('.toggle-password-btn') : null;

            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'password-input-wrapper';
                input.parentNode?.insertBefore(wrapper, input);
                wrapper.appendChild(input);
            }

            if (!btn) {
                btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'toggle-password-btn';
                btn.id = `toggle-${input.id}`;
                btn.dataset.target = input.id;
                btn.setAttribute('aria-label', 'Show password');
                btn.title = 'Show password';
                btn.innerHTML = '<i class="fa-regular fa-eye"></i>';
                wrapper.appendChild(btn);
            }

            if (!btn.dataset.bound) {
                btn.dataset.bound = 'true';
                btn.addEventListener('click', (e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const isPassword = input.type === 'password';
                    input.type = isPassword ? 'text' : 'password';

                    const newTitle = isPassword ? 'Hide password' : 'Show password';
                    btn.setAttribute('aria-label', newTitle);
                    btn.title = newTitle;

                    const icon = btn.querySelector('i');
                    if (icon) {
                        if (isPassword) {
                            icon.classList.remove('fa-eye');
                            icon.classList.add('fa-eye-slash');
                        } else {
                            icon.classList.remove('fa-eye-slash');
                            icon.classList.add('fa-eye');
                        }
                    }
                    input.focus();
                });
            }
        });
    }

    /**
     * Validate an individual input element
     * @returns {boolean} true if valid, false if invalid
     */
    function validateField(inputEl: HTMLInputElement | null): boolean {
        if (!inputEl) return true;
        const validator = validators[inputEl.id];
        if (!validator) return true;

        const errorMessage = validator(inputEl.value);
        if (errorMessage) {
            showError(inputEl, errorMessage);
            return false;
        } else {
            clearError(inputEl);
            return true;
        }
    }

    /**
     * Validate all inputs inside a form
     * @returns {boolean} true if form is valid, false otherwise
     */
    function validateForm(formEl: HTMLFormElement | null): boolean {
        if (!formEl) return true;
        const inputs = Array.from(formEl.querySelectorAll<HTMLInputElement>('input'));
        let isValid = true;
        let firstInvalidInput: HTMLInputElement | null = null;

        for (const input of inputs) {
            if (validators[input.id]) {
                const fieldValid = validateField(input);
                if (!fieldValid && !firstInvalidInput) {
                    firstInvalidInput = input;
                    isValid = false;
                } else if (!fieldValid) {
                    isValid = false;
                }
            }
        }

        if (firstInvalidInput) {
            firstInvalidInput.focus();
        }

        return isValid;
    }

    /**
     * Initialize validation listeners
     */
    function initValidation(): void {
        initPasswordToggles();

        const signupPassword = document.getElementById('signup-password') as HTMLInputElement | null;
        if (signupPassword) {
            ensurePasswordStrengthMeter(signupPassword);
            if (signupPassword.value) {
                updatePasswordStrengthMeter(signupPassword.value);
            }
        }

        const signupForm = document.getElementById('signupForm') as HTMLFormElement | null;
        const signinForm = document.getElementById('signinForm') as HTMLFormElement | null;

        const allInputs = document.querySelectorAll<HTMLInputElement>('#signupForm input, #signinForm input');

        allInputs.forEach((input: HTMLInputElement) => {
            if (!validators[input.id]) return;

            // Live validation on blur
            input.addEventListener('blur', () => {
                validateField(input);
            });

            // Re-validate / clear error on input if currently in error state
            input.addEventListener('input', () => {
                if (input.id === 'signup-password') {
                    updatePasswordStrengthMeter(input.value);
                }

                if (input.classList.contains('input-error')) {
                    validateField(input);
                } else if (input.value.trim().length > 0) {
                    clearError(input);
                }
            });
        });

        // Intercept Signup submission
        if (signupForm) {
            signupForm.addEventListener('submit', (e: Event) => {
                const isValid = validateForm(signupForm);
                if (!isValid) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true); // Use capture phase to intercept before other handlers
        }

        // Intercept Signin submission
        if (signinForm) {
            signinForm.addEventListener('submit', (e: Event) => {
                const isValid = validateForm(signinForm);
                if (!isValid) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }
            }, true); // Use capture phase to intercept before other handlers
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initValidation);
    } else {
        initValidation();
    }

    // Expose validation utilities globally for modular testing
    window.AuthValidation = {
        validateField,
        validateForm,
        showError,
        clearError,
        evaluatePasswordStrength,
        initPasswordToggles
    };
})();
