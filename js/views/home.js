import { appState, app } from '../state.js';
import { getUserInfo } from '../users.js';
import { renderTopNav, escapeHtml } from './components.js';
import { render } from './index.js';
import { db } from '../supabaseClient.js';
import { formatCurrency } from '../format.js';

// Icons
const Icons = {
  Search: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  Users: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  Wallet: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`,
  TrendingUp: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`
};

export async function renderHome() {
  const user = appState.currentUser;
  if (!user) {
    appState.currentView = 'auth';
    render();
    return;
  }
  const info = await getUserInfo(user.id);

  app.innerHTML = `
    <div class="home-shell">
      ${renderTopNav('home', info)}
      <main class="home-main space-y-6">
        
        <!-- Search Section -->
        <div class="card backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
          <div class="card-content pt-6 pb-6 px-6">
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">${Icons.Search}</span>
              <input type="text" id="group-search-input" placeholder="Search groups..." class="w-full pl-10 bg-input-background/50 backdrop-blur-sm border-border/50 h-12 text-base rounded-xl border px-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
        </div>

        <!-- Groups Section -->
        <div>
          <h2 class="text-xl mb-4 font-medium text-foreground/90">Your Groups</h2>
          <div id="home-groups-list" class="space-y-3">
             <div class="text-center py-8 text-muted-foreground">Loading groups...</div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div id="home-quick-stats" class="grid grid-cols-1 md:grid-cols-3 gap-4 pb-8">
             <!-- Stats loaded by JS -->
        </div>

      </main>
    </div>`;

  fetchHomeData();

  // Attach search listener
  const searchInput = document.getElementById('group-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterGroups(e.target.value));
  }
}

let cachedGroups = [];

async function fetchHomeData() {
  const user = appState.currentUser;
  if (!user) return;

  // 1. Fetch User Groups
  const { data: userGroups, error } = await db
    .from('split_groups')
    .select('group_id, invite, group_info(group_title, description, owner_id)')
    .eq('user_id', user.id);

  if (error || !userGroups) {
    console.error('Error fetching groups', error);
    renderGroupsList([], []);
    return;
  }

  const confirmedGroups = userGroups.filter(g => !g.invite && g.group_info);
  const groupIds = confirmedGroups.map(g => g.group_id);

  if (groupIds.length === 0) {
    renderGroupsList([], []);
    renderStats(0, 0, 0);
    return;
  }

  // 2. Fetch Stats (Parallel)
  // Total Expenses per Group
  // Member Counts per Group

  // Note: For large datasets, this should be an RPC or view. 
  // For now, client-side aggregation for fetching total amounts is okay for small scale.

  const [expensesRes, membersRes] = await Promise.all([
    db.from('expense_info').select('group_id, total_amount').in('group_id', groupIds),
    db.from('split_groups').select('group_id').in('group_id', groupIds)
  ]);

  const expenseMap = {}; // group_id -> total (cents)
  (expensesRes.data || []).forEach(row => {
    expenseMap[row.group_id] = (expenseMap[row.group_id] || 0) + (row.total_amount || 0);
  });

  const memberMap = {}; // group_id -> count
  (membersRes.data || []).forEach(row => {
    memberMap[row.group_id] = (memberMap[row.group_id] || 0) + 1;
  });

  // Enrich Data
  cachedGroups = confirmedGroups.map(g => ({
    id: g.group_id,
    name: g.group_info.group_title,
    description: g.group_info.description,
    members: memberMap[g.group_id] || 1,
    totalExpenses: (expenseMap[g.group_id] || 0) / 100
  }));

  renderGroupsList(cachedGroups);

  // Calculate Totals for Stats
  const activeGroups = cachedGroups.length;
  const totalTracked = cachedGroups.reduce((sum, g) => sum + g.totalExpenses, 0);
  const totalMembers = cachedGroups.reduce((sum, g) => sum + g.members, 0);

  renderStats(activeGroups, totalTracked, totalMembers);
}

function renderGroupsList(groups) {
  const listEl = document.getElementById('home-groups-list');
  if (!listEl) return;

  if (groups.length === 0) {
    listEl.innerHTML = `
        <div class="card backdrop-blur-xl bg-card/80 border-border/50 shadow-lg">
          <div class="card-content py-12 text-center">
            <div class="size-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-inner">
               <span class="text-primary">${Icons.Users}</span>
            </div>
            <p class="text-muted-foreground">No groups found</p>
          </div>
        </div>`;
    return;
  }

  listEl.innerHTML = groups.map(g => `
    <div 
        class="card backdrop-blur-xl bg-card/80 border-border/50 shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
        onclick="window.openGroup('${g.id}')">
        <div class="card-content p-5">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="size-14 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300 border border-primary/20">
                        <span class="text-primary">${Icons.Users}</span>
                    </div>
                    <div>
                        <h3 class="font-medium text-lg leading-tight home-group-title">${escapeHtml(g.name)}</h3>
                        <p class="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                            <span class="size-3.5 inline-block">${Icons.Users}</span>
                            ${g.members} members
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="flex items-center justify-end gap-2 text-primary font-medium">
                        <span class="size-4 inline-block">${Icons.Wallet}</span>
                        <span class="text-xl">${formatCurrency(g.totalExpenses)}</span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-0.5">total expenses</p>
                </div>
            </div>
        </div>
    </div>
  `).join('');

  // Hack to enable onclick navigation
  window.openGroup = (groupId) => {
    appState.currentGroup = { id: groupId }; // Partial hydration, groups view handles rest or re-fetches
    // Better: Navigate to groups view which sets currentGroup
    // Actually, we must set currentGroup then call renderGroupDetail? 
    // Or just set state and switch view.
    // Let's use the data attributes pattern usually seen in this app if possible, 
    // but here we used onclick. Let's fix this in post-render or global handler.
    // Re-implementing correctly:
    // We'll rely on global click delegation in main.js if it exists, or dispatch event.
    // For now, let's just trigger the router manually.
    const event = new CustomEvent('nav-to-group', { detail: { groupId } });
    document.dispatchEvent(event);
  };
}

function filterGroups(query) {
  if (!query) {
    renderGroupsList(cachedGroups);
    return;
  }
  const lower = query.toLowerCase();
  const filtered = cachedGroups.filter(g => g.name.toLowerCase().includes(lower));
  renderGroupsList(filtered);
}

function renderStats(activeGroups, totalTracked, totalMembers) {
  const statsEl = document.getElementById('home-quick-stats');
  if (!statsEl) return;

  statsEl.innerHTML = `
        <div class="card backdrop-blur-xl bg-gradient-to-br from-primary/10 to-card/80 border-border/50 shadow-lg">
          <div class="card-content p-5">
            <div class="flex items-center gap-3">
              <div class="size-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-md text-primary">
                 ${Icons.Users}
              </div>
              <div>
                <p class="text-2xl font-medium">${activeGroups}</p>
                <p class="text-sm text-muted-foreground">Active Groups</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card backdrop-blur-xl bg-gradient-to-br from-secondary/10 to-card/80 border-border/50 shadow-lg">
          <div class="card-content p-5">
            <div class="flex items-center gap-3">
              <div class="size-12 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/10 flex items-center justify-center shadow-md text-secondary">
                 ${Icons.Wallet}
              </div>
              <div>
                <p class="text-2xl font-medium text-secondary">
                  ${formatCurrency(totalTracked)}
                </p>
                <p class="text-sm text-muted-foreground">Total Tracked</p>
              </div>
            </div>
          </div>
        </div>

        <div class="card backdrop-blur-xl bg-gradient-to-br from-accent/30 to-card/80 border-border/50 shadow-lg">
          <div class="card-content p-5">
            <div class="flex items-center gap-3">
              <div class="size-12 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-md text-primary">
                 ${Icons.TrendingUp}
              </div>
              <div>
                <p class="text-2xl font-medium">${totalMembers}</p>
                <p class="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </div>
        </div>
    `;
}
