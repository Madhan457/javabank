let customerSearchTimer;

window.addEventListener('DOMContentLoaded', () => {
    const officer = checkAuthGuard('OFFICER');
    if (!officer) return;
    document.getElementById('officer-greeting').textContent = `Officer · ${officer.username}`;
    loadOfficerDashboard();
    loadOfficerCustomers();
    loadPendingCustomers();
    loadOfficerTransactions();
});

function setOfficerView(view) {
    document.querySelectorAll('.officer-view').forEach(section => section.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.querySelectorAll('.officer-nav-link').forEach(button => {
        button.classList.toggle('active', button.dataset.view === view);
    });
}

async function loadOfficerDashboard() {
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/officers/dashboard`);
        renderOfficerStats(result);
        renderOfficerReports(result);
        const { result: pending } = await requestApi(`${API_BASE_URL}/api/officers/customers/pending`);
        renderDashboardPending(pending);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderOfficerStats(stats) {
    const entries = [
        ['Total Customers', stats.totalCustomers],
        ['Pending Accounts', stats.pendingAccounts],
        ['Active Accounts', stats.activeAccounts],
        ['Blocked Accounts', stats.blockedAccounts],
        ['Rejected Accounts', stats.rejectedAccounts],
        ['Total Transactions', stats.totalTransactions],
        ['Total Deposits', formatMoney(stats.totalDeposits)],
        ['Total Withdrawals', formatMoney(stats.totalWithdrawals)]
    ];
    document.getElementById('officer-stats').innerHTML = entries.map(([label, value]) =>
        `<article class="officer-stat"><span>${escapeOfficerValue(label)}</span><strong>${escapeOfficerValue(value ?? 0)}</strong></article>`).join('');
}

function renderOfficerReports(stats) {
    const entries = [
        ['Total customers', stats.totalCustomers], ['Active customers', stats.activeAccounts],
        ['Pending customers', stats.pendingAccounts], ['Blocked customers', stats.blockedAccounts],
        ['Rejected customers', stats.rejectedAccounts], ['Total deposits', formatMoney(stats.totalDeposits)],
        ['Total withdrawals', formatMoney(stats.totalWithdrawals)], ['Total transfers', stats.totalTransfers],
        ['Total transaction count', stats.totalTransactions]
    ];
    document.getElementById('officer-reports').innerHTML = entries.map(([label, value]) =>
        `<div class="report-row"><span>${escapeOfficerValue(label)}</span><strong>${escapeOfficerValue(value ?? 0)}</strong></div>`).join('');
}

async function loadOfficerCustomers() {
    const search = document.getElementById('customer-search').value.trim();
    const status = document.getElementById('customer-status-filter').value;
    clearTimeout(customerSearchTimer);
    customerSearchTimer = setTimeout(async () => {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (status) params.set('status', status);
        try {
            const { result } = await requestApi(`${API_BASE_URL}/api/officers/customers?${params}`);
            renderOfficerCustomers(result);
        } catch (error) {
            showToast(error.message, 'error');
        }
    }, 180);
}

function renderOfficerCustomers(customers) {
    const body = document.getElementById('officer-customers');
    if (!customers.length) {
        body.innerHTML = '<tr><td colspan="10">No customers found.</td></tr>';
        return;
    }
    body.innerHTML = customers.map(customer => `<tr>
        <td>${escapeOfficerValue(customer.id)}</td><td>${escapeOfficerValue(customer.fullName)}</td>
        <td>${escapeOfficerValue(customer.email)}</td><td>${escapeOfficerValue(customer.phone)}</td>
        <td>${escapeOfficerValue(customer.accountNumber)}</td><td>${escapeOfficerValue(customer.accountType)}</td>
        <td><span class="account-status-badge status-${escapeOfficerValue(String(customer.accountStatus).toLowerCase())}">${escapeOfficerValue(customer.accountStatus)}</span></td>
        <td>${formatMoney(customer.balance)}</td><td>${formatOfficerDate(customer.createdAt)}</td>
        <td><div class="table-actions"><button class="btn btn-outline" onclick="viewOfficerCustomer(${Number(customer.id)})">Details</button>${statusActionButtons(customer)}</div></td>
    </tr>`).join('');
}

async function loadPendingCustomers() {
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/officers/customers/pending`);
        renderPendingCustomers(result);
        renderDashboardPending(result);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderPendingCustomers(customers) {
    const body = document.getElementById('pending-customers');
    if (!customers.length) {
        body.innerHTML = '<tr><td colspan="8">No pending applications.</td></tr>';
        return;
    }
    body.innerHTML = customers.map(customer => `<tr>
        <td>${escapeOfficerValue(customer.id)}</td><td>${escapeOfficerValue(customer.fullName)}</td>
        <td>${escapeOfficerValue(customer.email)}</td><td>${escapeOfficerValue(customer.phone)}</td>
        <td>${escapeOfficerValue(customer.accountType)}</td><td>${escapeOfficerValue(customer.accountNumber)}</td>
        <td>${formatOfficerDate(customer.createdAt)}</td><td><div class="table-actions">
        <button class="btn btn-primary" onclick="updateCustomerStatus(${Number(customer.id)}, 'approve')">Approve</button>
        <button class="btn btn-danger" onclick="updateCustomerStatus(${Number(customer.id)}, 'reject')">Reject</button>
        </div></td></tr>`).join('');
}

function renderDashboardPending(customers) {
    const body = document.getElementById('dashboard-pending');
    if (!body) return;
    if (!customers.length) {
        body.innerHTML = '<tr><td colspan="5">No pending applications.</td></tr>';
        return;
    }
    body.innerHTML = customers.slice(0, 6).map(customer => `<tr>
        <td>${escapeOfficerValue(customer.fullName)}</td><td>${escapeOfficerValue(customer.email)}</td>
        <td>${escapeOfficerValue(customer.accountNumber)}</td><td>${formatOfficerDate(customer.createdAt)}</td>
        <td><div class="table-actions"><button class="btn btn-primary" onclick="updateCustomerStatus(${Number(customer.id)}, 'approve')">Approve</button>
        <button class="btn btn-danger" onclick="updateCustomerStatus(${Number(customer.id)}, 'reject')">Reject</button></div></td></tr>`).join('');
}

function statusActionButtons(customer) {
    const id = Number(customer.id);
    if (customer.accountStatus === 'PENDING') return `<button class="btn btn-primary" onclick="updateCustomerStatus(${id}, 'approve')">Approve</button><button class="btn btn-danger" onclick="updateCustomerStatus(${id}, 'reject')">Reject</button>`;
    if (customer.accountStatus === 'ACTIVE') return `<button class="btn btn-danger" onclick="updateCustomerStatus(${id}, 'block')">Block</button>`;
    if (customer.accountStatus === 'BLOCKED') return `<button class="btn btn-primary" onclick="updateCustomerStatus(${id}, 'unblock')">Unblock</button>`;
    return '';
}

async function updateCustomerStatus(id, action) {
    const prompts = {
        approve: 'Approve this application and activate the account?',
        reject: 'Reject this application?',
        block: 'Block this customer account?',
        unblock: 'Unblock this customer account?'
    };
    if (!window.confirm(prompts[action])) return;
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/officers/customers/${id}/${action}`, { method: 'PUT' });
        showToast(`Account status updated to ${result.accountStatus}.`, 'success');
        await Promise.all([loadOfficerDashboard(), loadOfficerCustomers(), loadPendingCustomers()]);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function viewOfficerCustomer(id) {
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/officers/customers/${id}`);
        window.alert([
            `Customer: ${result.fullName}`,
            `Email: ${result.email}`,
            `Phone: ${result.phone}`,
            `Date of birth: ${result.dateOfBirth}`,
            `Address: ${result.address}`,
            `Account: ${result.accountNumber} · ${result.accountType}`,
            `Status: ${result.accountStatus}`,
            `Balance: ${formatMoney(result.balance)}`,
            `Created: ${formatOfficerDate(result.createdAt)}`
        ].join('\n'));
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function loadOfficerTransactions() {
    const params = new URLSearchParams();
    const type = document.getElementById('transaction-type-filter').value;
    const account = document.getElementById('transaction-account-filter').value.trim();
    const date = document.getElementById('transaction-date-filter').value;
    if (type) params.set('type', type);
    if (account) params.set('account', account);
    if (date) params.set('date', date);
    try {
        const { result } = await requestApi(`${API_BASE_URL}/api/officers/transactions?${params}`);
        renderOfficerTransactions(result);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderOfficerTransactions(transactions) {
    const body = document.getElementById('officer-transactions');
    if (!transactions.length) {
        body.innerHTML = '<tr><td colspan="8">No transactions found.</td></tr>';
        return;
    }
    body.innerHTML = transactions.map(transaction => `<tr>
        <td>${escapeOfficerValue(transaction.id)}</td><td>${escapeOfficerValue(transaction.customerName)} · ${escapeOfficerValue(transaction.accountNumber)}</td>
        <td>${escapeOfficerValue(transaction.transactionType)} · ${escapeOfficerValue(transaction.direction)}</td>
        <td>${formatMoney(transaction.amount)}</td><td>${escapeOfficerValue(transaction.senderAccount || '—')}</td>
        <td>${escapeOfficerValue(transaction.recipientAccount || '—')}</td><td>${escapeOfficerValue(transaction.status)}</td>
        <td>${formatOfficerDate(transaction.date)}</td></tr>`).join('');
}

function formatMoney(amount) {
    return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOfficerDate(value) {
    return value ? new Date(value).toLocaleString() : '—';
}

function escapeOfficerValue(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}