/* ==========================================================================
   Trust Bank - Customer Bank Dashboard Controller (bank.js)
   ========================================================================== */

let currentCustomer = null;

document.addEventListener('DOMContentLoaded', () => {
    initBankDashboard();
});

/**
 * Initialize Bank Dashboard Page
 */
async function initBankDashboard() {
    currentCustomer = checkAuthGuard('CUSTOMER');
    if (!currentCustomer) return;

    // Render initial cached info
    renderCustomerInfo(currentCustomer);

    // Fetch fresh profile data from backend API
    await fetchLatestProfile();
    await loadCustomerTransactions();
}

/**
 * Fetch latest profile from the authenticated customer session.
 */
async function fetchLatestProfile() {
    if (!currentCustomer) return;
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/customers/profile`, {
            method: 'GET'
        });

        if (result.success && result.customer) {
            currentCustomer = { ...result.customer, role: 'CUSTOMER' };
            localStorage.setItem('apex_user', JSON.stringify(currentCustomer));
            renderCustomerInfo(currentCustomer);
        } else {
            throw new Error(result.message || 'The backend did not return customer details.');
        }
    } catch (error) {
        console.error('Customer profile refresh failed:', error);
        showToast(`Could not refresh account details: ${error.message}`, 'error');
        if (error.message.includes('HTTP 401')) {
            localStorage.removeItem('apex_user');
            window.location.href = 'customer-auth.html';
        }
    }
}

/**
 * Render Customer Info into DOM elements
 */
function renderCustomerInfo(customer) {
    if (!customer) return;

    const navGreeting = document.getElementById('nav-user-greeting');
    if (navGreeting) navGreeting.textContent = `Welcome, ${customer.fullName}`;

    document.getElementById('dash-welcome').textContent = `Welcome, ${customer.fullName}`;
    document.getElementById('dash-account-type').textContent = customer.accountType || 'Savings';
    const status = (customer.accountStatus || 'PENDING').toUpperCase();
    document.getElementById('dash-status').textContent = status;
    document.getElementById('dash-status-detail').textContent = status;
    document.getElementById('dash-status').className = `account-status-badge status-${status.toLowerCase()}`;
    const statusMessages = {
        PENDING: 'Your account is pending bank officer approval.',
        BLOCKED: 'Your account has been blocked. Please contact the bank.',
        REJECTED: 'Your account registration has been rejected.'
    };
    const statusNotice = document.getElementById('account-status-notice');
    if (statusMessages[status]) {
        statusNotice.textContent = statusMessages[status];
        statusNotice.classList.remove('hidden');
    } else {
        statusNotice.classList.add('hidden');
    }
    document.querySelectorAll('#deposit-form button, #withdraw-form button, #transfer-form button')
        .forEach(button => { button.disabled = status !== 'ACTIVE'; });

    // Format the available balance for the account overview.
    const balanceNum = Number(customer.balance);
    const formattedBalance = Number.isFinite(balanceNum)
        ? `₹${balanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : 'Unavailable';
    document.getElementById('dash-balance').textContent = formattedBalance;

    document.getElementById('dash-account-number').textContent = customer.accountNumber || 'Unavailable';
    document.getElementById('dash-fullname').textContent = customer.fullName;
    document.getElementById('dash-username').textContent = customer.username;
    document.getElementById('dash-email').textContent = customer.email;
    document.getElementById('dash-phone').textContent = customer.phone;
    document.getElementById('dash-dob').textContent = customer.dateOfBirth || '-';
    document.getElementById('dash-address').textContent = customer.address;

    if (customer.createdAt) {
        const dateObj = new Date(customer.createdAt);
        document.getElementById('dash-created-at').textContent = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } else {
        document.getElementById('dash-created-at').textContent = 'Today';
    }
}

/**
 * Show / Hide Update Profile Modal
 */
function showUpdateModal() {
    if (!currentCustomer) return;

    document.getElementById('update-fullname').value = currentCustomer.fullName || '';
    document.getElementById('update-email').value = currentCustomer.email || '';
    document.getElementById('update-phone').value = currentCustomer.phone || '';
    document.getElementById('update-address').value = currentCustomer.address || '';

    const modal = document.getElementById('update-modal');
    if (modal) modal.classList.remove('hidden');
}

function hideUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Submit Profile Update (PUT /api/customers/profile)
 */
async function handleProfileUpdateSubmit(event) {
    event.preventDefault();

    if (!currentCustomer || !currentCustomer.id) return;

    const fullName = document.getElementById('update-fullname').value.trim();
    const email = document.getElementById('update-email').value.trim();
    const phone = document.getElementById('update-phone').value.trim();
    const address = document.getElementById('update-address').value.trim();

    const payload = { fullName, email, phone, address };

    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/customers/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (result.success && result.customer) {
            currentCustomer = { ...result.customer, role: 'CUSTOMER' };
            localStorage.setItem('apex_user', JSON.stringify(currentCustomer));
            renderCustomerInfo(currentCustomer);
            hideUpdateModal();
            showToast('Profile updated successfully!', 'success');
        } else {
            showToast(result.message || 'Failed to update profile.', 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Delete Account Modals & Handling
 */
function showDeleteConfirmationModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('hidden');
}

function hideDeleteConfirmationModal() {
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.add('hidden');
}

async function confirmDeleteAccount() {
    if (!currentCustomer) return;

    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/customers/account`, {
            method: 'DELETE'
        });

        if (result.success) {
            hideDeleteConfirmationModal();
            showToast('Customer account deleted successfully.', 'success');
            
            // Clear session state and redirect to index.html
            localStorage.removeItem('apex_user');
            sessionStorage.removeItem('apex_user');

            setTimeout(() => {
                window.location.href = 'index.html';
            }, 800);
        } else {
            showToast(result.message || 'Failed to delete account.', 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function submitBankTransaction(event, type) {
    event.preventDefault();
    if (!currentCustomer || currentCustomer.accountStatus !== 'ACTIVE') {
        showToast('Banking operations are available only for active accounts.', 'warning');
        return;
    }
    const payload = {
        amount: document.getElementById(`${type}-amount`).value,
        description: document.getElementById(`${type}-description`).value.trim()
    };
    if (type === 'transfer') payload.recipientAccountNumber = document.getElementById('transfer-recipient').value.trim();
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/transactions/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        showToast(result.message || 'Transaction completed.', 'success');
        document.getElementById(`${type}-form`).reset();
        await fetchLatestProfile();
        await loadCustomerTransactions();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadCustomerTransactions() {
    const type = document.getElementById('transaction-filter').value;
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/transactions/customer/history${query}`);
        renderCustomerTransactions(Array.isArray(result) ? result : []);
    } catch (error) {
        document.getElementById('customer-transactions').innerHTML = '<tr><td colspan="10">Unable to load transactions.</td></tr>';
        showToast(error.message, 'error');
    }
}

function renderCustomerTransactions(transactions) {
    const body = document.getElementById('customer-transactions');
    if (!transactions.length) {
        body.innerHTML = '<tr><td colspan="10">No transactions found.</td></tr>';
        return;
    }
    body.innerHTML = transactions.map(transaction => `<tr>
        <td>${escapeTableValue(transaction.id)}</td><td>${escapeTableValue(transaction.transactionType)} · ${escapeTableValue(transaction.direction)}</td>
        <td>${formatMoney(transaction.amount)}</td><td>${formatMoney(transaction.balanceBefore)}</td><td>${formatMoney(transaction.balanceAfter)}</td>
        <td>${escapeTableValue(transaction.senderAccount || '—')}</td><td>${escapeTableValue(transaction.recipientAccount || '—')}</td>
        <td>${escapeTableValue(transaction.description || '—')}</td><td>${escapeTableValue(transaction.date || '')}</td><td>${escapeTableValue(transaction.status)}</td>
    </tr>`).join('');
}

function formatMoney(amount) {
    return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeTableValue(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

function showPasswordModal() {
    document.getElementById('password-modal').classList.remove('hidden');
}

function hidePasswordModal() {
    document.getElementById('password-modal').classList.add('hidden');
    document.getElementById('change-password-form').reset();
}

async function handlePasswordChange(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    if (newPassword !== document.getElementById('confirm-new-password').value) {
        showToast('New passwords do not match.', 'error');
        return;
    }
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/customers/password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        showToast(result.message || 'Password changed.', 'success');
        hidePasswordModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}