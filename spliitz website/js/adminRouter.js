import { app } from './state.js';
import { db } from './supabaseClient.js';
import { getUserInfo } from './users.js';

export async function handleAdminRoute(path, currentUser) {
    // 1. Security Check
    if (!currentUser) {
        window.location.hash = '/signin';
        return;
    }

    // Double check tier from DB to be safe (or rely on cached currentUser if reliable)
    // We already fetch tier in main.js, so currentUser should have it.
    // However, getUserInfo does the detailed fetch.
    const info = await getUserInfo(currentUser.id);
    if (!info || info.tier !== 4) {
        alert('ACCESS DENIED: Admin privileges required.');
        window.location.hash = '/'; // Go home
        return;
    }

    // 2. Load Styles
    if (!document.getElementById('admin-css')) {
        const link = document.createElement('link');
        link.id = 'admin-css';
        link.rel = 'stylesheet';
        link.href = 'admin.css';
        document.head.appendChild(link);
        document.body.classList.add('admin-body');
    }

    // 3. Routing
    // path e.g. "/admin/users", "/admin/logs"
    const subpath = path.replace(/^\/admin\/?/, '') || 'users';

    renderAdminShell(subpath);

    if (subpath === 'users') renderUsers();
    else if (subpath === 'groups') renderGroups();
    else if (subpath === 'logs') renderLogs();
    else renderUsers(); // default
}

function renderAdminShell(activeTab) {
    app.innerHTML = `
    <div class="admin-container">
        <aside class="admin-sidebar">
            <div class="admin-header">
                <div class="admin-title">OVERRIDE</div>
                <div style="font-size:0.8rem; color:#666; margin-top:5px;">System Administrator</div>
            </div>
            <nav>
                <a href="#/admin/users" class="admin-nav-item ${activeTab === 'users' ? 'active' : ''}">USERS</a>
                <a href="#/admin/groups" class="admin-nav-item ${activeTab === 'groups' ? 'active' : ''}">GROUPS</a>
                <a href="#/admin/logs" class="admin-nav-item ${activeTab === 'logs' ? 'active' : ''}">DEBUG LOGS</a>
                <div style="margin-top: 2rem; border-top: 1px solid #333; padding-top: 1rem;">
                     <a href="#/" class="admin-nav-item" onclick="document.body.classList.remove('admin-body')">EXIT (USER MODE)</a>
                </div>
            </nav>
        </aside>
        <main class="admin-content" id="admin-view-port">
            <div style="color:#666;">Loading data...</div>
        </main>
    </div>
    `;
}

async function renderUsers() {
    const viewPort = document.getElementById('admin-view-port');
    viewPort.innerHTML = '<div class="admin-title">USER ROSTER</div><div style="margin-top:10px;">Fetching global user list...</div>';

    // RLS Policy "Admins can update all user_info" implies we can also SELECT all?
    // We might need a SELECT policy for admins on user_info if not present.
    // Usually user_info is public read? Or "Users can read their own"? 
    // If it's "Users can read their own", Admin SELECT might fail without a policy.
    // Assuming for now user_info is public readable OR we added a policy.

    const { data: users, error } = await db
        .from('user_info')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50); // Cap for performance for now

    if (error) {
        viewPort.innerHTML += `<div style="color:red; margin-top:10px;">Error: ${error.message}</div>`;
        return;
    }

    let html = `
    <table class="admin-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Tier</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
    `;

    users.forEach(u => {
        html += `
        <tr>
            <td style="font-size:0.7em; font-family:monospace;">${u.user_id}</td>
            <td>${u.first_name || ''} ${u.last_name || ''} <span style="color:#666">(@${u.username})</span></td>
            <td>${u.email}</td>
            <td>
                <span id="tier-display-${u.user_id}">${u.tier}</span>
            </td>
            <td>
                <button class="admin-btn" onclick="window.adminSetTier('${u.user_id}', 1)">FREE</button>
                <button class="admin-btn" onclick="window.adminSetTier('${u.user_id}', 2)">PAID</button>
                <button class="admin-btn" onclick="window.adminSetTier('${u.user_id}', 3)">TEST</button>
                <button class="admin-btn danger" onclick="window.adminSetTier('${u.user_id}', 4)">ADMIN</button>
            </td>
        </tr>
        `;
    });

    html += '</tbody></table>';
    viewPort.innerHTML = '<div class="admin-title">USER ROSTER</div>' + html;
}

async function renderGroups() {
    const viewPort = document.getElementById('admin-view-port');
    viewPort.innerHTML = '<div class="admin-title">GROUP INSPECTOR</div><div>Fetching recent groups...</div>';

    const { data: groups, error } = await db
        .from('group_info')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        viewPort.innerHTML = `<div style="color:red;">Error: ${error.message}</div>`;
        return;
    }

    let html = `
    <table class="admin-table">
        <thead>
            <tr>
                <th>Group ID</th>
                <th>Title</th>
                <th>Owner ID</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
    `;

    groups.forEach(g => {
        html += `
        <tr>
            <td style="font-size:0.7em; font-family:monospace;">${g.group_id}</td>
            <td>${g.group_title}</td>
            <td style="font-size:0.7em;">${g.owner_id}</td>
            <td>
                <button class="admin-btn danger" onclick="if(confirm('Delete group ${g.group_title}?')) window.adminDeleteGroup('${g.group_id}')">DELETE</button>
            </td>
        </tr>
        `;
    });
    html += '</tbody></table>';
    viewPort.innerHTML = '<div class="admin-title">GROUP INSPECTOR</div>' + html;
}

async function renderLogs() {
    const viewPort = document.getElementById('admin-view-port');
    viewPort.innerHTML = '<div class="admin-title">SYSTEM LOGS</div><div>Fetching debug logs...</div>';

    const { data: logs, error } = await db
        .from('debugging')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        viewPort.innerHTML = `<div style="color:red;">Error: ${error.message}</div>`;
        return;
    }

    let html = `<div style="max-height:80vh; overflow-y:auto; font-size:0.8rem; background:#111; padding:10px; border:1px solid #333;">`;
    logs.forEach(l => {
        html += `
        <div class="admin-log-entry">
            <span style="color:#888;">[${new Date(l.created_at).toLocaleString()}]</span>
            <span style="color:#0f0;">${l.level || 'INFO'}</span>
            <span style="color:#fff;">${l.message}</span>
            <div style="color:#666; margin-left:20px;">User: ${l.id} | ${l.comments || ''}</div>
        </div>
        `;
    });
    html += '</div>';
    viewPort.innerHTML = '<div class="admin-title">SYSTEM LOGS</div>' + html;
}

// --- GLOBAL ADMIN ACTIONS (Exposed to window for inline onclicks) ---

window.adminSetTier = async (userId, newTier) => {
    if (!confirm(`Set user tier to ${newTier}?`)) return;
    try {
        const { error } = await db.from('user_info').update({ tier: newTier }).eq('user_id', userId);
        if (error) throw error;
        alert('Tier updated.');
        // Update UI locally
        const badge = document.getElementById(`tier-display-${userId}`);
        if (badge) badge.textContent = newTier;
    } catch (err) {
        alert('Failed: ' + err.message);
    }
};

window.adminDeleteGroup = async (groupId) => {
    try {
        // Cascading delete might be handled by DB foreign keys, 
        // but let's try to delete the group_info and see if it cascades or RLS allows.
        const { error } = await db.from('group_info').delete().eq('group_id', groupId);
        if (error) throw error;
        alert('Group deleted.');
        renderGroups(); // Refresh
    } catch (err) {
        alert('Failed: ' + err.message);
    }
};
