/* ==========================================================================
   Trust Bank - Smart Password Generator Engine (password.js)
   ========================================================================== */

const CHAR_SETS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

let currentGeneratedPassword = '';

document.addEventListener('DOMContentLoaded', () => {
    initPasswordGenerator();
});

/**
 * Initialize Password Generator Page
 */
function initPasswordGenerator() {
    // Check if user is logged in to render navbar greeting
    const userJson = localStorage.getItem('apex_user') || sessionStorage.getItem('apex_user');
    if (userJson) {
        try {
            const user = JSON.parse(userJson);
            const navGreeting = document.getElementById('nav-user-greeting');
            if (navGreeting) navGreeting.textContent = `Welcome, ${user.fullName}`;
        } catch (e) {}
    }

    generatePassword();
}

/**
 * Generate Cryptographically Secure Password using Web Crypto API
 */
function generatePassword() {
    const slider = document.getElementById('pass-length-slider');
    const length = slider ? parseInt(slider.value, 10) : 16;

    const useUpper = document.getElementById('chk-uppercase').checked;
    const useLower = document.getElementById('chk-lowercase').checked;
    const useNumbers = document.getElementById('chk-numbers').checked;
    const useSpecial = document.getElementById('chk-special').checked;

    if (!useUpper && !useLower && !useNumbers && !useSpecial) {
        showToast('Please select at least one character category.', 'warning');
        clearGeneratedPassword();
        return;
    }

    let validCharPool = '';
    const guaranteedChars = [];

    if (useUpper) {
        validCharPool += CHAR_SETS.uppercase;
        guaranteedChars.push(getRandomChar(CHAR_SETS.uppercase));
    }
    if (useLower) {
        validCharPool += CHAR_SETS.lowercase;
        guaranteedChars.push(getRandomChar(CHAR_SETS.lowercase));
    }
    if (useNumbers) {
        validCharPool += CHAR_SETS.numbers;
        guaranteedChars.push(getRandomChar(CHAR_SETS.numbers));
    }
    if (useSpecial) {
        validCharPool += CHAR_SETS.special;
        guaranteedChars.push(getRandomChar(CHAR_SETS.special));
    }

    const remainingLength = length - guaranteedChars.length;
    const randomChars = [];

    for (let i = 0; i < remainingLength; i++) {
        randomChars.push(getRandomChar(validCharPool));
    }

    // Combine & Shuffle using Web Crypto Fisher-Yates
    const combined = [...guaranteedChars, ...randomChars];
    secureShuffleArray(combined);

    currentGeneratedPassword = combined.join('');

    // Display Password
    const displayBox = document.getElementById('password-display');
    if (displayBox) {
        displayBox.textContent = currentGeneratedPassword;
    }

    // Evaluate Strength
    evaluatePasswordStrength(currentGeneratedPassword, useUpper, useLower, useNumbers, useSpecial);
}

/**
 * Get random character from string pool using crypto.getRandomValues
 */
function getRandomChar(charSet) {
    return charSet.charAt(getSecureRandomIndex(charSet.length));
}

/**
 * Cryptographically Secure Fisher-Yates Array Shuffle
 */
function secureShuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = getSecureRandomIndex(i + 1);
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function getSecureRandomIndex(maxExclusive) {
    const range = 0x100000000;
    const limit = Math.floor(range / maxExclusive) * maxExclusive;
    const randomBuffer = new Uint32Array(1);
    do {
        window.crypto.getRandomValues(randomBuffer);
    } while (randomBuffer[0] >= limit);
    return randomBuffer[0] % maxExclusive;
}

/**
 * Slider input event handler
 */
function onLengthChange(val) {
    const valSpan = document.getElementById('pass-length-val');
    if (valSpan) valSpan.textContent = `Length: ${val}`;
    generatePassword();
}

/**
 * Checkbox change handler
 */
function updateGeneratorOptions() {
    generatePassword();
}

/**
 * Clear Generated Password Display
 */
function clearGeneratedPassword() {
    currentGeneratedPassword = '';
    const displayBox = document.getElementById('password-display');
    if (displayBox) {
        displayBox.textContent = 'Click "Generate Password" Below';
    }
    evaluatePasswordStrength('', false, false, false, false);
}

/**
 * Copy Password to Clipboard using navigator.clipboard
 */
async function copyPasswordToClipboard() {
    if (!currentGeneratedPassword) {
        showToast('No password generated yet!', 'warning');
        return;
    }

    try {
        await navigator.clipboard.writeText(currentGeneratedPassword);
        showToast('Password copied successfully!', 'success');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = currentGeneratedPassword;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Password copied successfully!', 'success');
    }
}

/**
 * Transfer Generated Password to Signup Form
 */
function usePasswordForRegistration() {
    if (!currentGeneratedPassword) {
        generatePassword();
    }

    // Keep the one-time handoff in this browser tab, then clear it on the signup page.
    sessionStorage.setItem('prefilled_password', currentGeneratedPassword);
    showToast('Password saved! Redirecting to Signup form...', 'success');

    setTimeout(() => {
        window.location.href = 'customer-auth.html?action=signup';
    }, 500);
}

/**
 * Password Strength Meter Logic
 */
function evaluatePasswordStrength(password, hasUpper, hasLower, hasNumbers, hasSpecial) {
    const fillBar = document.getElementById('strength-meter-fill');
    const badge = document.getElementById('strength-badge');
    const hint = document.getElementById('strength-hint');

    if (!password || password.length === 0) {
        if (fillBar) fillBar.style.width = '0%';
        if (badge) {
            badge.textContent = 'None';
            badge.className = 'strength-status-badge';
        }
        if (hint) hint.textContent = 'Select options and click Generate Password.';
        return;
    }

    let score = 0;
    const len = password.length;

    // Length score
    if (len >= 8) score += 20;
    if (len >= 12) score += 20;
    if (len >= 16) score += 15;
    if (len >= 24) score += 10;

    // Category diversity score
    let categoriesCount = 0;
    if (/[A-Z]/.test(password)) categoriesCount++;
    if (/[a-z]/.test(password)) categoriesCount++;
    if (/[0-9]/.test(password)) categoriesCount++;
    if (/[^A-Za-z0-9]/.test(password)) categoriesCount++;

    score += categoriesCount * 9;

    let levelName = 'Very Weak';
    let badgeClass = 'badge-very-weak';
    let barColor = '#ef4444';
    let fillPercent = 20;
    let hintText = 'Very weak password. Vulnerable to brute-force attacks.';

    if (score >= 85) {
        levelName = 'Very Strong';
        badgeClass = 'badge-very-strong';
        barColor = '#10b981';
        fillPercent = 100;
        hintText = 'Optimal bank-grade password strength! Resists cryptographic cracking.';
    } else if (score >= 68) {
        levelName = 'Strong';
        badgeClass = 'badge-strong';
        barColor = '#2563eb';
        fillPercent = 80;
        hintText = 'Strong password. Meets standard online banking security requirements.';
    } else if (score >= 50) {
        levelName = 'Medium';
        badgeClass = 'badge-medium';
        barColor = '#f59e0b';
        fillPercent = 60;
        hintText = 'Moderate strength. Add special characters or increase length.';
    } else if (score >= 30) {
        levelName = 'Weak';
        badgeClass = 'badge-weak';
        barColor = '#ea580c';
        fillPercent = 40;
        hintText = 'Weak password. Consider enabling uppercase, numbers, and symbols.';
    }

    if (fillBar) {
        fillBar.style.width = `${fillPercent}%`;
        fillBar.style.backgroundColor = barColor;
    }

    if (badge) {
        badge.textContent = levelName;
        badge.className = `strength-status-badge ${badgeClass}`;
    }

    if (hint) {
        hint.textContent = hintText;
    }
}