/**
 * Jadoo - Authentication Form Validation
 * Provides real-time and submission validation for Sign In and Sign Up forms.
 */

// Types and Interfaces
interface ValidatorFn {
    (value: string): string;
}

interface AuthValidationAPI {
    validateField: (inputEl: HTMLInputElement | null) => boolean;
    validateForm: (formEl: HTMLFormElement | null) => boolean;
    showError: (inputEl: HTMLInputElement | null, message: string) => void;
    clearError: (inputEl: HTMLInputElement | null) => void;
}

interface Window {
    AuthValidation?: AuthValidationAPI;
}

(function (): void {
    'use strict';

    // Regular Expressions
    const PATTERNS: Record<string, RegExp> = {
        name: /^[a-zA-Z\s'-]{2,50}$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
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
            if (value.length < 6) return 'Password must be at least 6 characters.';
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
            inputEl.insertAdjacentElement('afterend', errorEl);
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
        const inputs = formEl.querySelectorAll<HTMLInputElement>('input');
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
        clearError
    };
})();
