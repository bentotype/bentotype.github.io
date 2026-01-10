import { app } from '../state.js';

export function renderAuth() {
  app.innerHTML = `
<div class="home-shell auth-page">
  <header class="app-header auth-header">
    <div class="app-header__left">
      <div class="app-logo">Spliitz</div>
    </div>
  </header>
  <main class="home-main">
    <section class="auth-layout">
      <div class="auth-intro">
        <div class="summary-card auth-summary">
          <p class="summary-title">Welcome back</p>
          <h2 class="summary-amount">Keep every bill in sync.</h2>
          <p class="summary-desc">Track shared expenses, approve splits, and store receipts for every group.</p>
          <div class="auth-highlights">
            <div class="auth-highlight">
              <span class="auth-highlight__dot"></span>
              <div>
                <div class="auth-highlight__title">One dashboard</div>
                <div class="auth-highlight__desc">See pending proposals, totals, and activity at a glance.</div>
              </div>
            </div>
            <div class="auth-highlight">
              <span class="auth-highlight__dot"></span>
              <div>
                <div class="auth-highlight__title">Smart splits</div>
                <div class="auth-highlight__desc">Auto-calculate shares and keep approvals tidy.</div>
              </div>
            </div>
            <div class="auth-highlight">
              <span class="auth-highlight__dot"></span>
              <div>
                <div class="auth-highlight__title">Trusted profiles</div>
                <div class="auth-highlight__desc">Find friends by email or username and stay connected.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="card auth-card">
        <div class="auth-card__header">
          <p class="auth-card__eyebrow">Account</p>
          <h2 class="auth-card__title">Sign in to Spliitz</h2>
        </div>
        <div class="auth-tabs">
          <button data-action="show-tab" data-target="login-form" class="tab-button auth-tab is-active">Sign In</button>
          <button data-action="show-tab" data-target="signup-form" class="tab-button auth-tab">Sign Up</button>
        </div>
        <div class="auth-oauth">
          <button type="button" class="auth-oauth__button auth-oauth__button--apple" data-action="apple-login">Continue with Apple</button>
          <button type="button" class="auth-oauth__button auth-oauth__button--google" data-action="google-login">Continue with Google</button>
        </div>
        <div id="login-form" class="tab-content">
          <form data-form-action="login" class="auth-form">
            <label class="auth-field">
              <span>Email address</span>
              <input name="email" type="email" autocomplete="email" required placeholder="you@email.com" class="auth-input">
            </label>
            <label class="auth-field">
              <span>Password</span>
              <input name="password" type="password" autocomplete="current-password" required placeholder="Enter your password" class="auth-input">
            </label>
            <button class="auth-submit">Sign In</button>
          </form>
          <p class="auth-helper">New here? Use Sign Up to create your account.</p>
        </div>
        <div id="signup-form" class="tab-content hidden">
          <form data-form-action="signup" class="auth-form">
            <div class="auth-form__row">
              <label class="auth-field">
                <span>First name</span>
                <input name="first_name" required placeholder="First name" class="auth-input">
              </label>
              <label class="auth-field">
                <span>Last name</span>
                <input name="last_name" required placeholder="Last name" class="auth-input">
              </label>
            </div>
            <label class="auth-field">
              <span>Username (optional)</span>
              <input name="username" placeholder="Username" class="auth-input">
            </label>
            <label class="auth-field">
              <span>Email address</span>
              <input name="email" type="email" autocomplete="email" required placeholder="you@email.com" class="auth-input">
            </label>
            <label class="auth-field">
              <span>Phone number (optional)</span>
              <input name="phone_number" type="tel" autocomplete="tel" placeholder="(555) 123-4567" class="auth-input">
            </label>
            <div class="auth-form__row">
              <label class="auth-field">
                <span>Password</span>
                <input name="password" type="password" autocomplete="new-password" required placeholder="Create a password" class="auth-input">
              </label>
              <label class="auth-field">
                <span>Confirm password</span>
                <input name="confirm_password" type="password" autocomplete="new-password" required placeholder="Confirm password" class="auth-input">
              </label>
            </div>
            <button class="auth-submit">Create Account</button>
          </form>
          <p class="auth-helper">Already have an account? Switch back to Sign In.</p>
        </div>
      </div>
    </section>
  </main>
</div>
    <div class="mt-12 py-8 text-center space-x-8 text-base font-medium text-gray-600">
      <button data-action="nav" data-target="about" class="hover:text-indigo-600 transition">About Us</button>
      <span class="text-gray-400">•</span>
      <button data-action="nav" data-target="contact" class="hover:text-indigo-600 transition">Contact Us</button>
    </div>`;
}

export function renderAbout() {
  app.innerHTML = `
<div class="home-shell">
  <header class="app-header auth-header">
    <div class="app-header__left">
      <div class="app-logo cursor-pointer" onclick="window.location.href='/'">Spliitz</div>
    </div>
  </header>
  <main class="home-main">
    <section class="max-w-4xl mx-auto w-full p-4 md:p-8">
      <div class="mb-8">
        <button data-action="nav" data-target="auth" class="text-indigo-600 hover:text-indigo-500 font-medium text-lg flex items-center gap-2">
          <span>←</span> Back
        </button>
      </div>
      
      <div class="space-y-12">
        <!-- Hero -->
        <section>
          <p class="text-indigo-600 font-bold tracking-wide uppercase mb-2">About Spliitz</p>
          <h1 class="text-4xl md:text-5xl font-bold mb-6 leading-tight text-gray-900">Splitting expenses shouldn't be a splitting headache.</h1>
          <p class="text-xl text-gray-600 max-w-2xl leading-relaxed">
            We built Spliitz because we were tired of the "who paid for what?" dance. 
            Whether it's a ski trip, a shared apartment, or Saturday night dinner, we keep the math invisible so the fun stays visible.
          </p>
        </section>

        <!-- Mission -->
        <section class="grid md:grid-cols-2 gap-8 items-center bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
          <div>
            <h3 class="text-2xl font-bold mb-4 text-gray-900">Our Mission</h3>
            <p class="text-gray-600 leading-relaxed">
              To reduce the stress and awkwardness that money places on our most important relationships. 
              We believe you shouldn't have to choose between being generous and being fair.
            </p>
          </div>
          <div class="bg-indigo-50 h-48 rounded-xl flex items-center justify-center text-6xl">
              🤝
          </div>
        </section>

        <!-- Why Us -->
        <section>
          <h3 class="text-3xl font-bold mb-8 text-gray-900">Why Choose Spliitz?</h3>
          <div class="grid md:grid-cols-3 gap-6">
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 text-indigo-600">⚡️</div>
              <h4 class="text-lg font-bold mb-2 text-gray-900">Real-time Sync</h4>
              <p class="text-gray-600">Changes update instantly across everyone's devices. No more "did you add that yet?"</p>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 text-indigo-600">🧠</div>
              <h4 class="text-lg font-bold mb-2 text-gray-900">Smart Math</h4>
              <p class="text-gray-600">We optimize debts so you pay back the right people with the fewest transfers.</p>
            </div>
            <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
               <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-2xl mb-4 text-indigo-600">🔒</div>
              <h4 class="text-lg font-bold mb-2 text-gray-900">Secure Cloud</h4>
              <p class="text-gray-600">Your data is encrypted and stored safely. Access it from anywhere, anytime.</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  </main>
</div>`;
}

export function renderContact() {
  app.innerHTML = `
<div class="home-shell">
  <header class="app-header auth-header">
    <div class="app-header__left">
      <div class="app-logo cursor-pointer" onclick="window.location.href='/'">Spliitz</div>
    </div>
  </header>
  <main class="home-main">
    <section class="max-w-4xl mx-auto w-full p-4 md:p-8">
      <div class="mb-8">
        <button data-action="nav" data-target="auth" class="text-indigo-600 hover:text-indigo-500 font-medium text-lg flex items-center gap-2">
          <span>←</span> Back
        </button>
      </div>
      
      <div class="grid md:grid-cols-2 gap-12 items-start">
        <!-- Contact Info -->
        <div class="space-y-8">
          <div>
            <p class="text-indigo-600 font-bold tracking-wide uppercase mb-2">Get in touch</p>
            <h1 class="text-4xl font-bold mb-6 text-gray-900">Contact Us</h1>
            <p class="text-lg text-gray-600 leading-relaxed">
              Have questions, feedback, or need support? We'd love to hear from you. 
              Fill out the form or send us an email directly.
            </p>
          </div>

          <div class="space-y-6">
            <div class="flex items-start space-x-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div class="bg-indigo-50 p-3 rounded-lg text-2xl">📧</div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Email Support</h3>
                <p class="text-gray-500 mb-1 text-sm">For general inquiries and technical help:</p>
                <a href="mailto:support@spliitz.com" class="text-indigo-600 hover:text-indigo-500 font-medium">support@spliitz.com</a>
              </div>
            </div>
            
             <div class="flex items-start space-x-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
              <div class="bg-indigo-50 p-3 rounded-lg text-2xl">💼</div>
              <div>
                <h3 class="text-lg font-bold text-gray-900">Partnerships</h3>
                <p class="text-gray-500 mb-1 text-sm">Interested in working with us?</p>
                <a href="mailto:partners@spliitz.com" class="text-indigo-600 hover:text-indigo-500 font-medium">partners@spliitz.com</a>
              </div>
            </div>
          </div>
        </div>

        <!-- Contact Form -->
        <div class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <h3 class="text-xl font-bold mb-6 text-gray-900">Send a message</h3>
          <form class="space-y-5" onsubmit="event.preventDefault(); alert('Thanks! We will get back to you soon.');">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Your Name</label>
              <input type="text" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="John Doe">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Email Address</label>
              <input type="email" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="john@example.com">
            </div>
             <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
               <select class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition">
                  <option>General Inquiry</option>
                  <option>Technical Support</option>
                  <option>Feature Request</option>
                  <option>Other</option>
               </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">Message</label>
              <textarea rows="4" class="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition" placeholder="How can we help?"></textarea>
            </div>
            <button class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-indigo-500/20">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  </main>
</div>`;
}
