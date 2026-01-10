import { appState, app } from '../state.js';
import { getUserInfo } from '../users.js';
import { fetchMonthlyTotal, fetchPendingProposals } from '../fetchers.js';
import { renderTopNav } from './components.js';
import { render } from './index.js';

export async function renderHome() {
    const user = appState.currentUser;
    if (!user) {
        appState.currentView = 'auth';
        render();
        return;
    }
    const info = await getUserInfo(user.id);
    const monthName = new Date().toLocaleString('default', { month: 'long' });
    app.innerHTML = `
<div class="home-shell">
  ${renderTopNav('home', info)}
  <main class="home-main">
    <section class="summary-section">
      <div class="summary-card">
        <p class="summary-title">Total spent in ${monthName}</p>
        <h2 id="monthly-total" class="summary-amount">$0.00</h2>
        <p class="summary-sub">Across all your groups</p>
      </div>
    </section>
    <section class="content-section">
      <div class="card pending-card full-span">
        <div class="card-header">
          <h3 class="card-title">Pending Proposals</h3>
        </div>
        <div id="proposals-list" class="card-body">Loading...</div>
      </div>
    </section>
  </main>
</div>`;
    fetchMonthlyTotal();
    fetchPendingProposals();
}
