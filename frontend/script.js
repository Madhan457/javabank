/* ==========================================================================
   Trust Bank - Authentication & Shared Navigation JavaScript (script.js)
   ========================================================================== */

const API_BASE_URL = "http://localhost:8080";

async function requestApi(url, options = {}) {
    let response;
    try {
        response = await fetch(url, { ...options, credentials: options.credentials || 'include' });
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Network request to ${url} failed (${detail}). Confirm Spring Boot is running on port 8080; if it is, check the browser console for CORS errors.`);
    }

    const responseText = await response.text();
    let result = {};
    if (responseText) {
        try {
            result = JSON.parse(responseText);
        } catch {
            throw new Error(`Invalid JSON from ${url} (HTTP ${response.status}): ${responseText.slice(0, 200)}`);
        }
    }

    if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status} ${response.statusText} from ${url}`);
    }

    return { response, result };
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    initAuthPage();
});

/**
 * Initialize Index / Auth page features
 */
function initAuthPage() {
    // Check if query string requests signup tab or pre-filled password exists
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get('action');

    const prefilledPassword = sessionStorage.getItem('prefilled_password');

    if (actionParam === 'signup' || prefilledPassword) {
        switchAuthTab('signup');
        if (prefilledPassword) {
            const passField = document.getElementById('signup-password');
            const confirmPassField = document.getElementById('signup-confirm-password');
            if (passField && confirmPassField) {
                passField.value = prefilledPassword;
                confirmPassField.value = prefilledPassword;
                showToast('Generated password applied to both password fields.', 'success');
            }
            sessionStorage.removeItem('prefilled_password');
        }
    }
}

/**
 * Switch Auth Tab between Login and Signup
 */
function switchAuthTab(tab) {
    const tabLoginBtn = document.getElementById('tab-login');
    const tabSignupBtn = document.getElementById('tab-signup');
    const formLoginContainer = document.getElementById('form-login-container');
    const formSignupContainer = document.getElementById('form-signup-container');

    if (!tabLoginBtn || !tabSignupBtn) return;

    if (tab === 'signup') {
        tabLoginBtn.classList.remove('active');
        tabSignupBtn.classList.add('active');
        formLoginContainer.classList.add('hidden');
        formSignupContainer.classList.remove('hidden');
    } else {
        tabSignupBtn.classList.remove('active');
        tabLoginBtn.classList.add('active');
        formSignupContainer.classList.add('hidden');
        formLoginContainer.classList.remove('hidden');
    }
}

/**
 * Password Visibility Toggle
 */
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

/**
 * Check Protected Page Auth Guard
 */
function checkAuthGuard(expectedRole = 'CUSTOMER') {
    const userJson = localStorage.getItem('apex_user');
    if (!userJson) {
        showToast('Please log in to access this page.', 'warning');
        setTimeout(() => {
            window.location.href = expectedRole === 'OFFICER' ? 'officer-login.html' : 'customer-auth.html';
        }, 300);
        return null;
    }
    try {
        const user = JSON.parse(userJson);
        if (user.role !== expectedRole) {
            window.location.href = expectedRole === 'OFFICER' ? 'officer-login.html' : 'customer-auth.html';
            return null;
        }
        return user;
    } catch {
        localStorage.removeItem('apex_user');
        window.location.href = expectedRole === 'OFFICER' ? 'officer-login.html' : 'customer-auth.html';
        return null;
    }
}

/**
 * Handle Customer Login (POST /api/auth/customer/login)
 */
async function handleLogin(event) {
    event.preventDefault();

    const usernameOrEmail = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!usernameOrEmail || !password) {
        showToast('Please enter both username/email and password.', 'warning');
        return;
    }

    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';
    }

    try {
        const { response, result } = await requestApi(`${API_BASE_URL}/api/auth/customer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail, password })
        });

        if (response.ok && result.success && result.customer) {
            if (result.customer.accountStatus !== 'ACTIVE') {
                const statusNote = document.getElementById('login-status-note');
                if (statusNote) {
                    statusNote.textContent = result.message || 'This account is not active.';
                    statusNote.classList.remove('hidden');
                }
                showToast(result.message || 'This account is not active.', 'warning');
                return;
            }
            const customer = { ...result.customer, role: 'CUSTOMER' };
            localStorage.setItem('apex_user', JSON.stringify(customer));
            showToast(result.message || 'Login successful.', 'success');
            
            setTimeout(() => {
                window.location.href = 'bank.html';
            }, 600);
        } else {
            showToast(result.message || 'Invalid username or password.', 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }
}

/**
 * Handle Customer Registration (POST /api/customers/register)
 */
async function handleSignup(event) {
    event.preventDefault();

    const fullName = document.getElementById('signup-fullname').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const dateOfBirth = document.getElementById('signup-dob').value;
    const accountType = document.getElementById('signup-account-type').value;
    const address = document.getElementById('signup-address').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'warning');
        return;
    }

    const payload = {
        fullName,
        email,
        phone,
        dateOfBirth,
        accountType,
        address,
        username,
        password
    };

    const submitBtn = document.getElementById('btn-signup-submit');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
    }

    try {
        const { response, result } = await requestApi(`${API_BASE_URL}/api/customers/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok && result.success) {
            showToast(result.message || 'Application submitted. Your account is pending approval.', 'success');
            document.getElementById('signup-form').reset();
            document.getElementById('login-username').value = username;
            const statusNote = document.getElementById('login-status-note');
            if (statusNote) {
                statusNote.textContent = result.message || 'Your account is pending bank officer approval.';
                statusNote.classList.remove('hidden');
            }
            switchAuthTab('login');
        } else {
            showToast(result.message || 'Registration failed.', 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register Account';
        }
    }
}

async function handleOfficerLogin(event) {
    event.preventDefault();
    const username = document.getElementById('officer-username').value.trim();
    const password = document.getElementById('officer-password').value;
    const submitButton = document.getElementById('btn-officer-login');
    submitButton.disabled = true;

    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/auth/officer/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernameOrEmail: username, password })
        });
        if (!result.success || !result.officer) {
            throw new Error(result.message || 'Officer login failed.');
        }
        localStorage.setItem('apex_user', JSON.stringify(result.officer));
        showToast(result.message || 'Officer login successful.', 'success');
        window.location.href = 'officer-dashboard.html';
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

/**
 * Handle Logout (POST /api/auth/logout & clear session)
 */
async function handleLogout() {
    try {
        await requestApi(`${API_BASE_URL}/api/auth/logout`, { method: 'POST' });
    } catch (e) {
        // Ignore network failure on logout
    }

    localStorage.removeItem('apex_user');
    sessionStorage.removeItem('apex_user');
    showToast('Logged out successfully.', 'info');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 400);
}

/**
 * Navigate to Password Generator from Signup Form
 */
function openPasswordGenerator() {
    window.location.href = 'password.html?return=signup';
}

function handleForgotPassword() {
    alert('For security compliance, password reset requires identity verification. Please contact Trust Bank Customer Service or generate a new secure password using our Smart Password Generator.');
}

/**
 * Global Toast System
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    const iconElement = document.createElement('span');
    iconElement.textContent = icon;
    const messageElement = document.createElement('div');
    messageElement.style.flexGrow = '1';
    messageElement.textContent = message;
    toast.append(iconElement, messageElement);

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4200);
}