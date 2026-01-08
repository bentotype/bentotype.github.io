import { app } from './state.js';
import { db } from './supabaseClient.js';
import { getUserInfo } from './users.js';

// --- STATE ---
const adminState = {
    currentTable: null,
    data: [], // Raw data of current table
    filteredData: [], // Data after filters
    primaryKeys: {
        'user_info': 'user_id',
        'group_info': 'group_id',
        'friends': 'id', // composite usually, needs handling
        'expenses': 'expense_id',
        'activities': 'id',
        'user_devices': 'id'
    }
};

export async function handleAdminRoute(path, currentUser) {
    // 1. Security Check
    if (!currentUser) {
        window.location.hash = '/signin';
        return;
    }

    const info = await getUserInfo(currentUser.id);
    if (!info || info.tier !== 4) {
        alert('ACCESS DENIED: Admin privileges required.');
        window.location.hash = '/';
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

    // 3. Render Shell (if not already there)
    // We re-render if we are coming from fresh load
    if (!document.getElementById('admin-console-input')) {
        renderAdminShell();
        setupConsoleListener();
    }

    // 4. Default View
    renderTablesMenu();
}

function renderAdminShell() {
    app.innerHTML = `
    <div class="admin-container">
        <aside class="admin-sidebar">
            <div class="admin-header">
                <div class="admin-title">CONSOLE</div>
                <div style="font-size:0.8rem; color:#666; margin-top:5px;">System Administrator</div>
            </div>
            <nav>
                <a href="javascript:void(0)" onclick="window.adminGoHome()" class="admin-nav-item active">TABLES</a>
                <div style="margin-top: 2rem; border-top: 1px solid #333; padding-top: 1rem;">
                     <a href="javascript:void(0)" class="admin-nav-item" onclick="document.body.classList.remove('admin-body'); import('./supabaseClient.js').then(m=>m.db.auth.signOut());">LOG OUT</a>
                </div>
            </nav>
        </aside>
        <main class="admin-content" id="admin-view-port">
            <div style="color:#666;">Initializing console...</div>
        </main>
        <div class="admin-console-bar">
            <span class="console-prompt">></span>
            <input type="text" id="admin-console-input" placeholder="Enter command (e.g. filter name Ben, change row 0 name Thomas)..." autocomplete="off" spellcheck="false">
        </div>
    </div>
    `;
}

// --- GLOBAL NAVIGATION ---
window.adminGoHome = () => {
    adminState.currentTable = null;
    renderTablesMenu();
};

function renderTablesMenu() {
    const viewPort = document.getElementById('admin-view-port');
    const tables = ['user_info', 'group_info', 'activities', 'expenses', 'friends', 'user_devices'];

    let html = `<div class="admin-title">SELECT TABLE</div><div class="table-selector-grid">`;
    tables.forEach(t => {
        html += `<button class="table-select-btn" onclick="window.adminLoadTable('${t}')">${t}</button>`;
    });
    html += `</div>`;

    viewPort.innerHTML = html;
}

window.adminLoadTable = async (tableName) => {
    adminState.currentTable = tableName;
    const viewPort = document.getElementById('admin-view-port');
    viewPort.innerHTML = `<div class="admin-title">${tableName} (Loading...)</div>`;

    const { data, error } = await db.from(tableName).select('*').limit(100); // hard limit 100 for safety

    if (error) {
        viewPort.innerHTML = `<div style="color:#ef4444">Error: ${error.message}</div>`;
        return;
    }

    adminState.data = data || [];
    adminState.filteredData = [...adminState.data];
    renderDataGrid();
};

function renderDataGrid() {
    const viewPort = document.getElementById('admin-view-port');
    const data = adminState.filteredData;
    const tableName = adminState.currentTable;

    if (!data || data.length === 0) {
        viewPort.innerHTML = `<div class="admin-title">${tableName}</div><div style="color:#666; margin-top:20px;">[No Data]</div>`;
        return;
    }

    const columns = Object.keys(data[0]);

    let html = `
    <div class="admin-title-row">
        <div class="admin-title">${tableName} <span style="font-size:0.8rem; color:#666">(${data.length} rows)</span></div>
    </div>
    <div class="admin-table-wrapper">
        <table class="admin-table debug-table">
            <thead>
                <tr>
                    <th style="width:50px; text-align:center;">#</th>
                    ${columns.map(c => `<th>${c}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((row, index) => {
        html += `<tr>`;
        html += `<td style="text-align:center; color:#6366f1; font-weight:bold;">${index}</td>`; // Row Index

        columns.forEach(col => {
            const val = row[col];
            let displayVal = val;
            if (val === null) displayVal = `<span class="null-val">null</span>`;
            else if (typeof val === 'object') displayVal = JSON.stringify(val).substring(0, 30) + (JSON.stringify(val).length > 30 ? '...' : '');
            else if (typeof val === 'boolean') displayVal = `<span style="color:${val ? '#4ade80' : '#f87171'}">${val}</span>`;

            html += `<td>${displayVal}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    viewPort.innerHTML = html;
}

// --- CONSOLE LOGIC ---

function setupConsoleListener() {
    const input = document.getElementById('admin-console-input');
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value.trim();
            input.value = '';
            if (cmd) await handleCommand(cmd);
        }
    });
}

async function handleCommand(cmdStr) {
    const parts = cmdStr.split(' ');
    const op = parts[0].toLowerCase();

    // 1. FILTER <col> <val...>
    if (op === 'filter') {
        if (!adminState.currentTable) {
            alert('Select a table first.');
            return;
        }
        if (parts.length < 2) {
            // "filter" with no args resets
            adminState.filteredData = [...adminState.data];
            renderDataGrid();
            return;
        }

        const col = parts[1];
        const val = parts.slice(2).join(' ').toLowerCase(); // rest of string

        // Reset filter first? Or additive? User said "filter name Spliitz".
        // Let's filter from RAW data for simplicity (non-additive unless requested)
        adminState.filteredData = adminState.data.filter((row, idx) => {
            const rowVal = String(row[col] ?? '').toLowerCase();
            return rowVal.includes(val);
        });
        renderDataGrid();
        return;
    }

    // 2. CHANGE ROW <index> <col> <val...>
    if (op === 'change') {
        // syntax: change row 1 name Thomas Kim
        // parts: [change, row, 1, name, Thomas, Kim]
        if (!adminState.currentTable) return alert('Select a table first.');
        if (parts[1] !== 'row') return alert('Syntax: change row <index> <col> <value>');

        const rowIndex = parseInt(parts[2]);
        const col = parts[3];
        const val = parts.slice(4).join(' '); // raw string value

        if (isNaN(rowIndex) || !adminState.filteredData[rowIndex]) {
            return alert(`Invalid row index: ${rowIndex}`);
        }

        const row = adminState.filteredData[rowIndex];

        // Determine Primary Key value to update
        const pkCol = adminState.primaryKeys[adminState.currentTable];
        if (!pkCol) return alert(`No primary key config for ${adminState.currentTable}`);

        const pkVal = row[pkCol];

        if (!confirm(`Update ${adminState.currentTable} row #${rowIndex} (${pkCol}=${pkVal}):\nSet ${col} = "${val}"?`)) return;

        const updateObj = {};
        updateObj[col] = val === 'null' ? null : val; // handle null string as null? User didn't specify, but handy.

        const { error } = await db.from(adminState.currentTable).update(updateObj).eq(pkCol, pkVal);

        if (error) {
            alert('Update Failed: ' + error.message);
        } else {
            // Alert Success? Or just refresh?
            // Refresh data from server to be sure
            await window.adminLoadTable(adminState.currentTable);
            // Re-apply filter? 
            // The user's row index might change if data changes order or filter resets.
            // For now, loadTable resets filter.
            alert('Update Successful. Table refreshed.');
        }
        return;
    }

    alert('Unknown command. Try: filter, change');
}
