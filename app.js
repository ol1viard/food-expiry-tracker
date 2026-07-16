/* ==========================================================================
   FreshGuard – Food Expiry & Waste Tracker  |  app.js
   Full client-side SPA with Auth, Multi-User, Admin Panel, and Theme Toggle
   ========================================================================== */

'use strict';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = {
    produce:   { name: 'Vegetables',      icon: 'fa-solid fa-carrot',           colorClass: 'badge-produce',   dotClass: 'dot-success' },
    fruit:     { name: 'Fruit',           icon: 'fa-solid fa-apple-whole',      colorClass: 'badge-pantry',    dotClass: 'dot-warning' },
    dairy:     { name: 'Dairy',           icon: 'fa-solid fa-cheese',           colorClass: 'badge-dairy',     dotClass: 'dot-info' },
    meat:      { name: 'Meat & Fish',     icon: 'fa-solid fa-drumstick-bite',   colorClass: 'badge-meat',      dotClass: 'dot-danger' },
    bakery:    { name: 'Bakery',          icon: 'fa-solid fa-bread-slice',      colorClass: 'badge-bakery',    dotClass: 'dot-warning' },
    pantry:    { name: 'Pantry Staples',  icon: 'fa-solid fa-box',              colorClass: 'badge-pantry',    dotClass: 'dot-muted' },
    beverages: { name: 'Beverages',       icon: 'fa-solid fa-wine-glass-empty', colorClass: 'badge-beverages', dotClass: 'dot-info' },
    leftovers: { name: 'Leftovers',       icon: 'fa-solid fa-bowl-food',        colorClass: 'badge-leftovers', dotClass: 'dot-muted' }
};

const RECIPE_DB = [
    {
        name: 'Avocado Smash',
        desc: 'Smashed fresh avocado on toasted sourdough slice with a perfectly poached egg.',
        prepTime: '10 mins', difficulty: 'Easy',
        required: ['produce', 'bakery'],
        tags: ['KETO', 'FRESH'],
        steps: ['Toast bread.', 'Mash avocado with salt, pepper, and lemon juice.', 'Spread on toast and top with egg.']
    },
    {
        name: 'Pomegranate Bowl',
        desc: 'Vibrant bowl of pomegranate seeds, salad greens, and crispy baked tofu.',
        prepTime: '15 mins', difficulty: 'Easy',
        required: ['produce', 'fruit', 'pantry'],
        tags: ['VEGAN', 'ANTIOXIDANT'],
        steps: ['Chop greens and crispy tofu.', 'Mix in a bowl with pomegranate seeds.', 'Toss with light vinaigrette.']
    },
    {
        name: 'Grilled Salmon',
        desc: 'Pan-seared premium salmon fillet paired with fresh lemon and asparagus.',
        prepTime: '20 mins', difficulty: 'Medium',
        required: ['meat', 'produce'],
        tags: ['HIGH PROTEIN', 'OMEGA 3'],
        steps: ['Season salmon with salt and herbs.', 'Sear in a hot skillet with olive oil.', 'Serve with lemon slices.']
    },
    {
        name: 'Supreme Leftovers Stir-Fry',
        desc: 'A speedy stir-fry designed to use up any vegetables, leftovers, or meats.',
        prepTime: '15 mins', difficulty: 'Easy',
        required: ['produce', 'leftovers', 'meat'],
        tags: ['QUICK', 'WASTE-LESS'],
        steps: ['Heat oil in a pan on high.', 'Sauté chopped vegetables and meats.', 'Toss with soy sauce, garlic and rice.']
    },
    {
        name: 'Fluffy French Toast',
        desc: 'Transform stale bakery bread and extra milk into a golden breakfast treat.',
        prepTime: '10 mins', difficulty: 'Easy',
        required: ['bakery', 'dairy'],
        tags: ['BREAKFAST', 'SWEET'],
        steps: ['Whisk eggs, milk and cinnamon.', 'Dip bread slices until soaked.', 'Cook on buttered skillet until golden.']
    }
];

const DEMO_ITEMS = [
    { name: 'Organic Milk',     category: 'dairy',    storage: 'fridge',  qty: 750, unit: 'ml',     daysOffset:  2 },
    { name: 'Bananas',          category: 'fruit',    storage: 'pantry',  qty: 6,   unit: 'units',  daysOffset:  8 },
    { name: 'Spinach',          category: 'produce',  storage: 'fridge',  qty: 200, unit: 'g',      daysOffset:  0 },
    { name: 'Salmon',           category: 'meat',     storage: 'freezer', qty: 2,   unit: 'packs',  daysOffset:  4 },
    { name: 'Sourdough',        category: 'bakery',   storage: 'pantry',  qty: 1,   unit: 'loaf',   daysOffset:  3 },
    { name: 'Greek Yogurt',     category: 'dairy',    storage: 'fridge',  qty: 500, unit: 'g',      daysOffset:  12 }
];

const FREQUENT_ADDITIONS = [
    { name: 'Whole Milk',     category: 'dairy',    qty: 1, unit: 'liter',  days: 7 },
    { name: 'Fresh Carrots',  category: 'produce',  qty: 500, unit: 'g',    days: 10 },
    { name: 'Bananas',        category: 'fruit',    qty: 6,   unit: 'pcs',   days: 5 },
    { name: 'Sourdough',      category: 'bakery',   qty: 1,   unit: 'loaf',  days: 3 }
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let currentUser  = null;   // { username, role }
let allUsers     = [];     // [{ username, password, role }]
let allFoodItems = [];     // [{ id, username, name, category, storage, qty, unit, dateAdded, dateExpiry }]
let allHistory   = [];     // [{ id, username, name, category, storage, qty, unit, resolution, dateHandled }]

let editingItemId = null;
let undoStack     = null;
let authToken     = null;

const activeFilters = {
    search:   '',
    storage:  'all',
    category: 'all',
    sort:     'expiry-soon'
};

// ---------------------------------------------------------------------------
// Image Asset Helpers
// ---------------------------------------------------------------------------

function getItemImage(name, customImage) {
    if (customImage) return customImage; // Per-item custom photo takes priority
    const n = (name || '').toLowerCase();
    if (n.includes('milk') || n.includes('yogurt') || n.includes('dairy') || n.includes('cheese')) {
        return 'images/organic_milk.jpg';
    }
    if (n.includes('banana') || n.includes('fruit') || n.includes('tropical')) {
        return 'images/bananas.jpg';
    }
    if (n.includes('spinach') || n.includes('lettuce') || n.includes('green') || n.includes('veggie') || n.includes('produce') || n.includes('carrot') || n.includes('avocado')) {
        return 'images/spinach.jpg';
    }
    if (n.includes('salmon') || n.includes('fish') || n.includes('steak') || n.includes('meat') || n.includes('chicken')) {
        return 'images/salmon.jpg';
    }
    if (n.includes('bread') || n.includes('sourdough') || n.includes('bakery') || n.includes('loaf')) {
        return 'images/sourdough.jpg';
    }
    return 'images/organic_milk.jpg'; // Fallback
}

// ---------------------------------------------------------------------------
// Photo Upload Helpers
// ---------------------------------------------------------------------------

let pendingImageData = null; // holds base64 string for current form session

function initPhotoUpload(inputId, previewId, placeholderId) {
    const input       = $(inputId);
    const preview     = $(previewId);
    const placeholder = $(placeholderId);
    if (!input) return;

    input.addEventListener('change', () => {
        const file = input.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.', 'warning');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be under 5 MB.', 'warning');
            return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            pendingImageData = e.target.result;
            if (preview)     { preview.src = pendingImageData; preview.style.display = 'block'; }
            if (placeholder) placeholder.style.display = 'none';

            // If this is the track form, also update the camera scan card as a live preview
            if (inputId === 'track-photo-input') {
                const scanCard = $('btn-camera-scan');
                if (scanCard) {
                    scanCard.style.backgroundImage  = `url('${pendingImageData}')`;
                    scanCard.style.backgroundSize   = 'cover';
                    scanCard.style.backgroundPosition = 'center';
                    const overlay = scanCard.querySelector('.scan-bg-overlay');
                    if (overlay) overlay.style.opacity = '0.55';
                }
            }
        };
        reader.readAsDataURL(file);
    });
}

function resetPhotoUpload(inputId, previewId, placeholderId) {
    pendingImageData = null;
    const input       = $(inputId);
    const preview     = $(previewId);
    const placeholder = $(placeholderId);
    if (input)   input.value = '';
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    if (placeholder) placeholder.style.display = 'flex';

    // Reset camera scan card too
    if (inputId === 'track-photo-input') {
        const scanCard = $('btn-camera-scan');
        if (scanCard) {
            scanCard.style.backgroundImage  = '';
            scanCard.style.backgroundSize   = '';
            scanCard.style.backgroundPosition = '';
            const overlay = scanCard.querySelector('.scan-bg-overlay');
            if (overlay) overlay.style.opacity = '';
        }
    }
}

// ---------------------------------------------------------------------------
// Backend sync helpers
// ---------------------------------------------------------------------------

async function fetchUserData() {
    try {
        const headers = { 'Authorization': `Bearer ${authToken}` };
        const [foodRes, histRes] = await Promise.all([
            fetch('/api/food', { headers }),
            fetch('/api/history', { headers })
        ]);
        
        if (foodRes.ok && histRes.ok) {
            allFoodItems = await foodRes.json();
            allHistory = await histRes.json();
        } else {
            if (foodRes.status === 401 || foodRes.status === 403) {
                logoutDirect();
            }
        }
    } catch (err) {
        console.error('Network error fetching user data:', err);
        showToast('Failed to sync with server.', 'warning');
    }
}

function logoutDirect() {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('freshr_token');
    localStorage.removeItem('freshr_session');
    showLandingPage();
}

async function loadStorage() {
    try {
        authToken = localStorage.getItem('freshr_token');
        const saved = localStorage.getItem('freshr_session');
        currentUser = saved ? JSON.parse(saved) : null;
        
        if (currentUser && authToken) {
            await fetchUserData();
        } else {
            currentUser = null;
            authToken = null;
        }
    } catch (_) {
        currentUser = null;
        authToken = null;
    }
}

function saveUsers()     {}
function saveFoodItems() {}
function saveHistory()   {}
function saveSession()   {}
function clearSession()  {
    localStorage.removeItem('freshr_token');
    localStorage.removeItem('freshr_session');
}

// ---------------------------------------------------------------------------
// Per-user data views
// ---------------------------------------------------------------------------

function myItems()   { return allFoodItems.filter(i => i.username === currentUser.username); }
function myHistory() { return allHistory.filter(i => i.username === currentUser.username); }

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayStr() { return new Date().toISOString().split('T')[0]; }

function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function daysRemaining(expiryStr) {
    const today  = new Date(); today.setHours(0,0,0,0);
    const expiry = new Date(expiryStr); expiry.setHours(0,0,0,0);
    return Math.ceil((expiry - today) / 86400000);
}

function freshnessPercent(item) {
    const dr = daysRemaining(item.dateExpiry);
    if (dr <= 0) return 0;
    const added  = new Date(item.dateAdded);
    const expiry = new Date(item.dateExpiry);
    const total  = Math.ceil((expiry - added) / 86400000);
    if (total <= 0) return Math.min(100, Math.max(0, (dr / 10) * 100));
    return Math.min(100, Math.max(0, Math.round((dr / total) * 100)));
}

function expiryStatus(days) {
    if (days < 0) return { label: 'Expired',       cls: 'text-danger',  card: 'border-danger',  badge: 'badge-danger'  };
    if (days <= 3) return { label: 'Expiring Soon', cls: 'text-warning', card: 'border-warning', badge: 'badge-warning' };
    return               { label: 'Safe',           cls: 'text-success', card: 'border-success', badge: 'badge-success' };
}

function friendlyDate(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}

function relativeDate(str) {
    if (!str) return '';
    const diff = Math.floor((new Date() - new Date(str)) / 86400000);
    if (diff === 0) return 'today';
    if (diff === 1) return 'yesterday';
    return `${diff} days ago`;
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

function escHTML(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------------------------------------------------------------------------
// DOM shortcuts
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    await loadStorage();
    initTheme();
    setDateDisplay();
    bindAuthEvents();
    bindLandingEvents();
    bindAppEvents();

    if (currentUser) {
        showApp();
    } else {
        showLandingPage();
    }

    await checkPasswordResetURL();
});

function setDateDisplay() {
    const el = $('current-date-display');
    if (el) el.textContent = new Date().toLocaleDateString('en-US',
        { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}

// ---------------------------------------------------------------------------
// THEME SWITCHER
// ---------------------------------------------------------------------------

function initTheme() {
    const savedTheme = localStorage.getItem('freshr_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    updateThemeButtons();
}

function toggleTheme() {
    if (document.body.classList.contains('dark-theme')) {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('freshr_theme', 'light');
    } else {
        document.body.classList.add('dark-theme');
        localStorage.setItem('freshr_theme', 'dark');
    }
    updateThemeButtons();
}

function updateThemeButtons() {
    const isDark = document.body.classList.contains('dark-theme');
    const iconClass = isDark ? 'fa-sun' : 'fa-moon';
    
    const mBtn = $('btn-theme-toggle');
    const sBtn = $('btn-sidebar-theme-toggle');
    
    if (mBtn) mBtn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    if (sBtn) sBtn.innerHTML = `<i class="fa-solid ${iconClass}"></i> Theme`;
}

// ===========================================================================
// AUTH
// ===========================================================================

function showLandingPage() {
    const landing = $('landing-page-container');
    if (landing) landing.style.display = 'block';
    $('auth-overlay').style.display  = 'none';
    $('app-container').style.display = 'none';
}

function showAuth(view) {
    const landing = $('landing-page-container');
    if (landing) landing.style.display = 'none';
    $('auth-overlay').style.display  = 'flex';
    $('app-container').style.display = 'none';
    toggleAuthView(view);
}

function toggleAuthView(view) {
    $('auth-signin-view').style.display = view === 'signin' ? 'block' : 'none';
    $('auth-signup-view').style.display = view === 'signup' ? 'block' : 'none';
    
    // Update headers
    const titleDisp = $('auth-title-display');
    const taglineDisp = $('auth-tagline-display');
    if (titleDisp && taglineDisp) {
        if (view === 'signin') {
            titleDisp.textContent = 'Login';
            taglineDisp.textContent = 'Welcome back please login to your account';
        } else {
            titleDisp.textContent = 'Create Account';
            taglineDisp.textContent = 'Join FreshGuard to track expiry & reduce waste';
        }
    }

    const tabSignin = $('tab-btn-signin');
    const tabSignup = $('tab-btn-signup');
    if (tabSignin && tabSignup) {
        if (view === 'signin') {
            tabSignin.classList.add('active');
            tabSignup.classList.remove('active');
        } else {
            tabSignup.classList.add('active');
            tabSignin.classList.remove('active');
        }
    }
    clearAuthErrors();
}

function clearAuthErrors() {
    ['signin-error','signup-error'].forEach(id => {
        const el = $(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
}

function showAuthError(id, msg) {
    const el = $(id);
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

function bindAuthEvents() {
    const tabSignin = $('tab-btn-signin');
    const tabSignup = $('tab-btn-signup');
    if (tabSignin) tabSignin.addEventListener('click', () => toggleAuthView('signin'));
    if (tabSignup) tabSignup.addEventListener('click', () => toggleAuthView('signup'));

    $('signin-form').addEventListener('submit', async e => {
        e.preventDefault();
        const username = $('signin-username').value.trim().toLowerCase();
        const password = $('signin-password').value;
        if (!username || !password) {
            showAuthError('signin-error', 'Please enter username and password.');
            return;
        }
        try {
            const res = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                showAuthError('signin-error', data.error || 'Incorrect username or password.');
                return;
            }
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('freshr_token', authToken);
            localStorage.setItem('freshr_session', JSON.stringify(currentUser));
            
            await fetchUserData();

            $('signin-form').reset();
            showApp();
        } catch (err) {
            showAuthError('signin-error', 'Network error signing in.');
        }
    });

    $('signup-form').addEventListener('submit', async e => {
        e.preventDefault();
        const username = $('signup-username').value.trim().toLowerCase();
        const password = $('signup-password').value;
        const role     = $('signup-role').value;
        if (!username || !password) { showAuthError('signup-error', 'All fields are required.'); return; }
        if (username.length < 3)    { showAuthError('signup-error', 'Username must be at least 3 characters.'); return; }
        if (password.length < 4)    { showAuthError('signup-error', 'Password must be at least 4 characters.'); return; }

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            const data = await res.json();
            if (!res.ok) {
                showAuthError('signup-error', data.error || 'Failed to sign up.');
                return;
            }
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('freshr_token', authToken);
            localStorage.setItem('freshr_session', JSON.stringify(currentUser));
            
            allFoodItems = [];
            allHistory = [];
            
            $('signup-form').reset();
            showToast(`Welcome, ${username}!`, 'success');
            showApp();
        } catch (err) {
            showAuthError('signup-error', 'Network error signing up.');
        }
    });

    // Google Auth Flow
    const googleModalOverlay = $('google-modal-overlay');
    const googleEmailInput   = $('google-email-input');
    const googleRoleSelect   = $('google-role-select');
    const googleModalError   = $('google-modal-error');

    function openGoogleModal() {
        if (googleModalError) { googleModalError.style.display = 'none'; googleModalError.textContent = ''; }
        if (googleEmailInput)  googleEmailInput.value = '';
        if (googleRoleSelect)  googleRoleSelect.value = 'user';
        if (googleModalOverlay) googleModalOverlay.style.display = 'flex';
        if (googleEmailInput)  setTimeout(() => googleEmailInput.focus(), 50);
    }

    function closeGoogleModal() {
        if (googleModalOverlay) googleModalOverlay.style.display = 'none';
    }

    const btnGoogleAuth = $('btn-google-auth');
    if (btnGoogleAuth) btnGoogleAuth.addEventListener('click', openGoogleModal);

    const btnGoogleClose = $('btn-google-modal-close');
    if (btnGoogleClose) btnGoogleClose.addEventListener('click', closeGoogleModal);

    if (googleModalOverlay) {
        googleModalOverlay.addEventListener('click', e => {
            if (e.target === googleModalOverlay) closeGoogleModal();
        });
    }

    const btnGoogleConfirm = $('btn-google-confirm');
    if (btnGoogleConfirm) {
        btnGoogleConfirm.addEventListener('click', async () => {
            const email = (googleEmailInput ? googleEmailInput.value.trim().toLowerCase() : '');
            const role  = (googleRoleSelect ? googleRoleSelect.value : 'user');

            // Secure Google email validation matching server-side checks
            const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
            if (!email || !emailRegex.test(email)) {
                if (googleModalError) {
                    googleModalError.textContent = 'Please enter a valid and secure Google email address ending in @gmail.com';
                    googleModalError.style.display = 'block';
                }
                return;
            }

            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, role })
                });
                const data = await res.json();
                if (!res.ok) {
                    if (googleModalError) {
                        googleModalError.textContent = data.error || 'Google Sign-In failed.';
                        googleModalError.style.display = 'block';
                    }
                    return;
                }
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('freshr_token', authToken);
                localStorage.setItem('freshr_session', JSON.stringify(currentUser));
                
                await fetchUserData();
                closeGoogleModal();
                showToast(`Signed in as ${currentUser.displayName}!`, 'success');
                showApp();
            } catch (err) {
                if (googleModalError) {
                    googleModalError.textContent = 'Network error during Google Sign-In.';
                    googleModalError.style.display = 'block';
                }
            }
        });
    }

    // Forgot Password
    const linkForgot = $('link-forgot-password');
    const forgotModalOverlay = $('forgot-modal-overlay');
    const forgotUsernameInput = $('forgot-username-input');
    const forgotModalError = $('forgot-modal-error');
    const forgotPromptContainer = $('forgot-prompt-container');
    const forgotPromptText = $('forgot-prompt-text');

    function openForgotModal() {
        if (forgotModalError) { forgotModalError.style.display = 'none'; forgotModalError.textContent = ''; }
        if (forgotUsernameInput) forgotUsernameInput.value = '';
        if (forgotPromptContainer) forgotPromptContainer.style.display = 'none';
        if (forgotModalOverlay) forgotModalOverlay.style.display = 'flex';
        if (forgotUsernameInput) setTimeout(() => forgotUsernameInput.focus(), 50);
    }

    function closeForgotModal() {
        if (forgotModalOverlay) forgotModalOverlay.style.display = 'none';
    }

    if (linkForgot) linkForgot.addEventListener('click', e => { e.preventDefault(); openForgotModal(); });

    const btnForgotClose = $('btn-forgot-modal-close');
    if (btnForgotClose) btnForgotClose.addEventListener('click', closeForgotModal);

    const btnForgotGenerate = $('btn-forgot-generate');
    if (btnForgotGenerate) {
        btnForgotGenerate.addEventListener('click', async () => {
            const username = (forgotUsernameInput ? forgotUsernameInput.value.trim().toLowerCase() : '');
            if (!username) {
                if (forgotModalError) {
                    forgotModalError.textContent = 'Please enter your username.';
                    forgotModalError.style.display = 'block';
                }
                return;
            }
            // Generate prompt based on existence
            const promptText = `Hello Admin, I forgot my password for my FreshGuard account. My username is "${username}". Please generate and send me a password reset link. Thanks!`;
            if (forgotPromptText) forgotPromptText.value = promptText;
            if (forgotPromptContainer) forgotPromptContainer.style.display = 'block';
        });
    }

    $('btn-forgot-copy').addEventListener('click', () => {
        if (forgotPromptText) {
            forgotPromptText.select();
            navigator.clipboard.writeText(forgotPromptText.value)
                .then(() => showToast('Request prompt copied!', 'success'));
        }
    });

    $('btn-forgot-email').addEventListener('click', () => {
        if (forgotPromptText) {
            const subject = encodeURIComponent('FreshGuard Password Reset Request');
            const body = encodeURIComponent(forgotPromptText.value);
            window.open(`mailto:admin@example.com?subject=${subject}&body=${body}`, '_blank');
        }
    });

    // Reset Password Form
    const resetForm = $('reset-password-form');
    const resetModalError = $('reset-modal-error');
    const resetModalOverlay = $('reset-modal-overlay');

    if (resetForm) {
        resetForm.addEventListener('submit', async e => {
            e.preventDefault();
            const newPassword = $('reset-new-password').value;
            const confirmPassword = $('reset-confirm-password').value;

            if (newPassword !== confirmPassword) {
                if (resetModalError) {
                    resetModalError.textContent = 'Passwords do not match.';
                    resetModalError.style.display = 'block';
                }
                return;
            }

            const targetUser = window.pendingResetUser; // { username, token }
            if (!targetUser) return;

            try {
                const res = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: targetUser.username, token: targetUser.token, password: newPassword })
                });
                const data = await res.json();
                if (!res.ok) {
                    if (resetModalError) {
                        resetModalError.textContent = data.error || 'Failed to reset password.';
                        resetModalError.style.display = 'block';
                    }
                    return;
                }

                if (resetModalOverlay) resetModalOverlay.style.display = 'none';
                showToast('Password reset successfully! Log in now.', 'success');
                window.history.pushState({}, document.title, window.location.pathname);
                window.pendingResetUser = null;
            } catch (err) {
                if (resetModalError) {
                    resetModalError.textContent = 'Network error resetting password.';
                    resetModalError.style.display = 'block';
                }
            }
        });
    }

    const btnResetClose = $('btn-reset-modal-close');
    if (btnResetClose) {
        btnResetClose.addEventListener('click', () => {
            if (resetModalOverlay) resetModalOverlay.style.display = 'none';
            window.history.pushState({}, document.title, window.location.pathname);
            window.pendingResetUser = null;
        });
    }
}

// ===========================================================================
// APP SHELL
// ===========================================================================

function showApp() {
    $('auth-overlay').style.display  = 'none';
    const landing = $('landing-page-container');
    if (landing) landing.style.display = 'none';
    $('app-container').style.display = 'flex';
    updateSidebarProfile();
    switchTab('dashboard');
}

function updateSidebarProfile() {
    const displayName = currentUser.displayName || currentUser.username;
    $('sidebar-username').textContent = displayName;
    const roleLabel = currentUser.role === 'admin' ? 'Administrator' : 'Regular User';
    const providerBadge = currentUser.provider === 'google' ? ' <span style="font-size:0.65rem;color:#A75F63;">● Google</span>' : '';
    $('sidebar-role').innerHTML = roleLabel + providerBadge;
    
    const adminLink = $('nav-admin');
    if (adminLink) adminLink.style.display = currentUser.role === 'admin' ? 'flex' : 'none';
}

function bindLandingEvents() {
    const sections = document.querySelectorAll('.landing-page-container section');
    const navLinks = document.querySelectorAll('.landing-nav-link, .landing-mobile-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.scrollY >= (sectionTop - 120)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    const mMenuBtn = $('btn-landing-mobile-menu');
    const mNav = $('landing-mobile-nav');
    if (mMenuBtn && mNav) {
        mMenuBtn.addEventListener('click', () => {
            mNav.style.display = mNav.style.display === 'none' ? 'flex' : 'none';
        });
        
        mNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mNav.style.display = 'none';
            });
        });
    }

    const bindBtn = (id, view) => {
        const btn = $(id);
        if (btn) btn.addEventListener('click', () => {
            if (mNav) mNav.style.display = 'none';
            showAuth(view);
        });
    };

    bindBtn('landing-btn-login', 'signin');
    bindBtn('landing-mobile-btn-login', 'signin');
    bindBtn('landing-btn-signup', 'signup');
    bindBtn('landing-mobile-btn-signup', 'signup');
    bindBtn('hero-btn-start', 'signup');
    bindBtn('about-btn-join', 'signup');

    const backBtn = $('btn-auth-back-landing');
    if (backBtn) backBtn.addEventListener('click', showLandingPage);

    const signupSwitch = $('link-go-to-signup');
    const signinSwitch = $('link-go-to-signin');
    if (signupSwitch) signupSwitch.addEventListener('click', e => { e.preventDefault(); toggleAuthView('signup'); });
    if (signinSwitch) signinSwitch.addEventListener('click', e => { e.preventDefault(); toggleAuthView('signin'); });

    document.querySelectorAll('.toggle-password-visibility').forEach(icon => {
        icon.addEventListener('click', () => {
            const targetId = icon.dataset.target;
            const input = $(targetId);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            }
        });
    });
}

function bindAppEvents() {
    // Navigation (Sidebar)
    document.querySelectorAll('.nav-item[data-tab]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchTab(link.getAttribute('data-tab'));
        });
    });

    // Navigation (Mobile Bottom Bar)
    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchTab(link.getAttribute('data-tab'));
        });
    });

    // Logout
    $('btn-logout').addEventListener('click', () => {
        currentUser = null;
        clearSession();
        showLandingPage();
        showToast('You have been logged out.', 'info');
    });

    // Mobile specific interactions
    $('btn-theme-toggle').addEventListener('click', toggleTheme);
    $('btn-sidebar-theme-toggle').addEventListener('click', toggleTheme);
    
    $('btn-mobile-menu').addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.style.display = sidebar.style.display === 'flex' ? 'none' : 'flex';
            sidebar.style.height = '100vh';
            sidebar.style.position = 'fixed';
            sidebar.style.top = '0';
            sidebar.style.left = '0';
        }
    });

    // Close mobile menu if clicked outside or on a nav item
    document.addEventListener('click', e => {
        if (window.innerWidth < 768) {
            const sidebar = document.querySelector('.sidebar');
            const menuBtn = $('btn-mobile-menu');
            if (sidebar && sidebar.style.display === 'flex' && !sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
                sidebar.style.display = 'none';
            }
        }
    });

    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                document.querySelector('.sidebar').style.display = 'none';
            }
        });
    });

    // Add shortcuts triggers
    $('btn-add-food-trigger').addEventListener('click', () => {
        if (window.innerWidth < 768) switchTab('add');
        else openModal();
    });
    $('btn-mobile-fab').addEventListener('click', () => switchTab('add'));
    $('btn-add-food-list-trigger').addEventListener('click', () => openModal());

    // Search and filters
    $('inventory-search').addEventListener('input', e => {
        activeFilters.search = e.target.value.trim().toLowerCase();
        renderInventoryGrid();
    });

    $('storage-filter-tabs').addEventListener('click', e => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        document.querySelectorAll('#storage-filter-tabs .filter-chip').forEach(b => b.classList.remove('active'));
        chip.classList.add('active');
        activeFilters.storage = chip.dataset.filter;
        renderInventoryGrid();
    });

    // Forms
    $('form-modal-overlay').addEventListener('click', closeModal);
    $('btn-close-modal').addEventListener('click',   closeModal);
    $('btn-cancel-modal').addEventListener('click',  closeModal);
    $('food-item-form').addEventListener('submit',   handleFoodFormSubmit);

    // Track Form
    $('track-item-form').addEventListener('submit', handleTrackFormSubmit);

    // Photo Upload — Snap & Track form
    initPhotoUpload('track-photo-input', 'track-photo-preview', 'track-photo-placeholder');

    // Photo Upload — Desktop Modal form
    initPhotoUpload('modal-photo-input', 'modal-photo-preview', 'modal-photo-placeholder');

    // Camera scan card triggers the track photo input
    const cameraScanCard = $('btn-camera-scan');
    if (cameraScanCard) {
        cameraScanCard.addEventListener('click', () => {
            const input = $('track-photo-input');
            if (input) input.click();
        });
    }

    // Date hint buttons
    document.querySelectorAll('.btn-date-hint').forEach(btn => {
        btn.addEventListener('click', () => {
            $('food-expiry').value = offsetDate(parseInt(btn.dataset.days));
        });
    });

    // Recipes
    $('btn-find-recipes').addEventListener('click', matchRecipes);

    // History
    $('btn-clear-history').addEventListener('click', clearHistory);

    // Admin Panel
    $('admin-create-user-form').addEventListener('submit', handleAdminCreateUser);

    // Admin reset
    const adminResetModal = $('modal-admin-reset');
    const adminResetClose = $('btn-close-admin-reset');
    const adminResetOverlay = $('admin-reset-overlay');
    const closeAdminResetModal = () => { if (adminResetModal) adminResetModal.style.display = 'none'; };
    if (adminResetClose) adminResetClose.addEventListener('click', closeAdminResetModal);
    if (adminResetOverlay) adminResetOverlay.addEventListener('click', closeAdminResetModal);

    $('btn-admin-reset-copy').addEventListener('click', () => {
        const urlInput = $('admin-reset-url-input');
        if (urlInput) {
            urlInput.select();
            navigator.clipboard.writeText(urlInput.value)
                .then(() => showToast('Reset link copied!', 'success'));
        }
    });

    $('btn-admin-reset-email').addEventListener('click', () => {
        const urlInput = $('admin-reset-url-input');
        const usernameEl = $('admin-reset-username');
        if (urlInput && usernameEl) {
            const username = usernameEl.textContent;
            const user = allUsers.find(u => u.username === username);
            const email = (user && user.email) ? user.email : '';
            const subject = encodeURIComponent('FreshGuard Password Reset Link');
            const body = encodeURIComponent(`Here is the link to reset your FreshGuard password:\n\n${urlInput.value}`);
            window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        }
    });
}

// ===========================================================================
// TAB SWITCHING
// ===========================================================================

const TAB_TITLES = {
    dashboard: 'Healthy Feed',
    recipes:   'Smart Recipes',
    add:       'Snap & Track',
    inventory: 'Pantry Grid',
    history:   'Waste Log',
    admin:     'Admin Panel'
};

function switchTab(tabId) {
    if (tabId === 'admin' && currentUser?.role !== 'admin') return;

    // Sidebar active nav sync
    document.querySelectorAll('.sidebar .nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.querySelector(`.sidebar .nav-item[data-tab="${tabId}"]`);
    if (navEl) navEl.classList.add('active');

    // Bottom nav active sync
    document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));
    const bottomEl = document.querySelector(`.bottom-nav-item[data-tab="${tabId}"]`);
    if (bottomEl) bottomEl.classList.add('active');

    // Tab content active state
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active-tab'));
    const tab = $(`tab-${tabId}`);
    if (tab) tab.classList.add('active-tab');

    // Title text
    const title = $('page-title');
    if (title) title.textContent = TAB_TITLES[tabId] || 'FreshGuard';

    // Renders
    if      (tabId === 'dashboard') refreshDashboard();
    else if (tabId === 'inventory') renderInventoryGrid();
    else if (tabId === 'recipes')   renderRecipesTab();
    else if (tabId === 'history')   renderHistoryTab();
    else if (tabId === 'admin')     renderAdminTab();
    else if (tabId === 'add')       renderAddTab();
}

// ===========================================================================
// DEMO DATA
// ===========================================================================

async function loadDemoData() {
    const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    try {
        allFoodItems = allFoodItems.filter(i => i.username !== currentUser.username);
        
        const promises = DEMO_ITEMS.map(async d => {
            const newItem = {
                id:         uid(),
                name:       d.name,
                category:   d.category,
                storage:    d.storage,
                qty:        d.qty,
                unit:       d.unit,
                dateAdded:  offsetDate(-Math.abs(d.daysOffset) - 2),
                dateExpiry: offsetDate(d.daysOffset)
            };
            
            await fetch('/api/food', {
                method: 'POST',
                headers,
                body: JSON.stringify(newItem)
            });

            return { ...newItem, username: currentUser.username };
        });

        const newItemsList = await Promise.all(promises);
        allFoodItems = allFoodItems.concat(newItemsList);

        refreshDashboard();
        showToast('Demo inventory loaded!', 'success');
    } catch (err) {
        showToast('Failed to load demo data to server.', 'danger');
    }
}

// ===========================================================================
// DASHBOARD (Healthy Feed)
// ===========================================================================

function refreshDashboard() {
    const items = myItems();
    
    // Calculate expiring soon / action required items (<= 3 days remaining)
    const expiringSoon = items
        .map(i => ({ ...i, dr: daysRemaining(i.dateExpiry) }))
        .filter(i => i.dr <= 3)
        .sort((a,b) => a.dr - b.dr);

    const count = expiringSoon.length;
    
    // Update banner UI
    const countEl = $('dashboard-expiring-count');
    const watermarkEl = $('dashboard-expiring-watermark');
    if (countEl) countEl.textContent = count;
    if (watermarkEl) watermarkEl.textContent = count;

    // Overlapping Avatars
    const avatarsRow = $('dashboard-expiring-avatars');
    if (avatarsRow) {
        if (count === 0) {
            avatarsRow.innerHTML = '';
        } else {
            const listToRender = expiringSoon.slice(0, 3);
            let avatarsHTML = listToRender.map(item => {
                const img = getItemImage(item.name);
                return `<div class="expiring-avatar"><img src="${img}" alt="${escHTML(item.name)}"></div>`;
            }).join('');
            
            if (count > 3) {
                avatarsHTML += `<div class="expiring-avatar-plus">+${count - 3}</div>`;
            }
            avatarsRow.innerHTML = avatarsHTML;
        }
    }

    // Render category pills scroll
    renderDashboardCategories(items);

    // Render suggestions feed
    renderDashboardFeed(expiringSoon, items);
}

function renderDashboardCategories(items) {
    const list = $('dashboard-categories-list');
    if (!list) return;

    // Count items left per category
    const catCounts = {};
    Object.keys(CATEGORIES).forEach(k => { catCounts[k] = 0; });
    items.forEach(i => {
        if (catCounts[i.category] !== undefined) {
            catCounts[i.category]++;
        }
    });

    // Render list
    list.innerHTML = Object.keys(CATEGORIES).map(catKey => {
        const cat = CATEGORIES[catKey];
        const count = catCounts[catKey];
        const img = getItemImage(catKey === 'produce' ? 'spinach' : catKey === 'fruit' ? 'bananas' : catKey === 'dairy' ? 'organic_milk' : catKey === 'meat' ? 'salmon' : catKey === 'bakery' ? 'sourdough' : 'organic_milk');
        
        let dotColorClass = 'dot-success';
        if (catKey === 'meat') dotColorClass = 'dot-danger';
        else if (catKey === 'dairy') dotColorClass = 'dot-info';
        else if (catKey === 'fruit') dotColorClass = 'dot-warning';
        else if (catKey === 'produce') dotColorClass = 'dot-success';
        else dotColorClass = 'dot-muted';

        return `
            <a href="#" class="category-pill-card" onclick="filterByCategoryTab('${catKey}')">
                <div class="category-pill-image">
                    <img src="${img}" alt="${cat.name}">
                </div>
                <span class="category-pill-name">${cat.name}</span>
                <span class="category-pill-sub">
                    <span class="category-dot ${dotColorClass}"></span>
                    ${count} items
                </span>
            </a>
        `;
    }).join('');
}

function filterByCategoryTab(catKey) {
    activeFilters.category = catKey;
    activeFilters.storage = 'all';
    switchTab('inventory');
    
    // Sync category selectors
    const select = $('category-filter-select');
    if (select) select.value = catKey;
}

function renderDashboardFeed(expiringSoon, items) {
    const list = $('dashboard-feed-list');
    if (!list) return;

    // Find recipes that can match expiring ingredients or have general suggestions
    const matchedRecipes = RECIPE_DB.map(recipe => {
        // Check if any of recipe required categories exists in expiring soon
        const isExpiringMatch = recipe.required.some(req => expiringSoon.some(i => i.category === req));
        // Check general availability in total items
        const isAvailableMatch = recipe.required.some(req => items.some(i => i.category === req));
        
        return {
            ...recipe,
            score: isExpiringMatch ? 3 : isAvailableMatch ? 1 : 0
        };
    }).sort((a,b) => b.score - a.score);

    // Limit to 3 suggestions
    const renderList = matchedRecipes.slice(0, 3);

    list.innerHTML = renderList.map(recipe => {
        const img = getItemImage(recipe.name);
        
        // Generate mock expiry text based on score
        let expiryText = 'Available';
        let expiryClass = 'text-success';
        if (recipe.name === 'Avocado Smash') {
            expiryText = 'Exp. Today';
            expiryClass = 'text-danger';
        } else if (recipe.name === 'Pomegranate Bowl') {
            expiryText = '3 Days';
            expiryClass = 'text-warning';
        } else if (recipe.name === 'Grilled Salmon') {
            expiryText = 'Exp. Tomorrow';
            expiryClass = 'text-danger';
        }

        const tagsHTML = recipe.tags.map(tag => `<span class="feed-tag">${tag}</span>`).join('');

        return `
            <div class="feed-card">
                <div class="feed-card-image">
                    <img src="${img}" alt="${escHTML(recipe.name)}">
                </div>
                <div class="feed-card-content">
                    <div class="feed-card-header">
                        <h4>${escHTML(recipe.name)}</h4>
                        <span class="feed-card-expiry ${expiryClass}">${expiryText}</span>
                    </div>
                    <span class="feed-card-sub">${escHTML(recipe.desc)}</span>
                    <div class="feed-card-tags">
                        ${tagsHTML}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===========================================================================
// INVENTORY GRID RENDER (Pantry)
// ===========================================================================

function getFilteredItems() {
    let items = myItems().map(i => ({ ...i, dr: daysRemaining(i.dateExpiry), fp: freshnessPercent(i) }));

    if (activeFilters.search)            items = items.filter(i => i.name.toLowerCase().includes(activeFilters.search));
    if (activeFilters.storage !== 'all') items = items.filter(i => i.storage === activeFilters.storage);
    if (activeFilters.category !== 'all') items = items.filter(i => i.category === activeFilters.category);

    const sortFns = {
        'expiry-soon':   (a,b) => a.dr - b.dr,
        'expiry-late':   (a,b) => b.dr - a.dr,
        'added-recent':  (a,b) => new Date(b.dateAdded) - new Date(a.dateAdded),
        'alphabetical':  (a,b) => a.name.localeCompare(b.name)
    };
    items.sort(sortFns[activeFilters.sort] || sortFns['expiry-soon']);
    return items;
}

function renderInventoryGrid() {
    const grid  = $('inventory-grid-container');
    if (!grid) return;
    
    const items = getFilteredItems();

    if (items.length === 0) {
        const isFiltered = activeFilters.search || activeFilters.category !== 'all' || activeFilters.storage !== 'all';
        grid.innerHTML = `
            <div class="no-items-placeholder" style="grid-column: 1/-1; text-align:center; padding: 40px 0;">
                <i class="fa-solid fa-basket-shopping" style="font-size:48px; color:var(--color-text-dim); margin-bottom:12px;"></i>
                <h4>No Items Found</h4>
                <p style="color:var(--color-text-muted); font-size:13px;">${isFiltered ? 'No food matches filters.' : 'Pantry is empty. Click add to begin.'}</p>
                ${!isFiltered ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="loadDemoData()">Load Demo Items</button>' : ''}
            </div>
        `;
        return;
    }

    let cardsHTML = [];
    
    items.forEach((item, index) => {
        // Inject Eco Tip card at index 4 (5th spot)
        if (index === 4) {
            cardsHTML.push(`
                <div class="eco-tip-card">
                    <div class="eco-icon-wrapper">
                        <i class="fa-solid fa-leaf"></i>
                    </div>
                    <div class="eco-tip-content">
                        <h4>Eco Tip</h4>
                        <p>Freeze your spinach today to use in smoothies later and avoid waste!</p>
                    </div>
                </div>
            `);
        }

        const cat = CATEGORIES[item.category] || CATEGORIES.pantry;
        const status = expiryStatus(item.dr);
        
        let badgeClass = 'badge-success';
        let badgeText = `${item.dr}d left`;
        if (item.dr < 0) {
            badgeClass = 'badge-danger';
            badgeText = `Expired`;
        } else if (item.dr === 0) {
            badgeClass = 'badge-danger';
            badgeText = `Today!`;
        } else if (item.dr <= 3) {
            badgeClass = 'badge-warning';
            badgeText = `${item.dr}d left`;
        }

        const img = getItemImage(item.name, item.imageData);

        cardsHTML.push(`
            <div class="food-card-premium">
                <span class="card-badge ${badgeClass}">${badgeText}</span>
                <div class="food-card-image-wrapper">
                    <img src="${img}" alt="${escHTML(item.name)}" class="food-card-img">
                </div>
                <span class="food-card-category">${cat.name}</span>
                <h4 class="food-card-name" title="${escHTML(item.name)}">${escHTML(item.name)}</h4>
                <span class="food-card-details">${item.qty} ${escHTML(item.unit)} &bull; ${item.storage}</span>
                
                <div class="food-card-actions">
                    <button class="btn-action action-resolve" onclick="resolveItem('${item.id}','consumed')" title="Consume">
                        <i class="fa-solid fa-check"></i> Eat
                    </button>
                    <button class="btn-action" onclick="openModal('${item.id}')" title="Edit">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button class="btn-action" onclick="deleteItem('${item.id}')" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `);
    });

    // In case there are less than 4 items, append Eco Tip card at the end
    if (items.length < 4) {
        cardsHTML.push(`
            <div class="eco-tip-card">
                <div class="eco-icon-wrapper">
                    <i class="fa-solid fa-leaf"></i>
                </div>
                <div class="eco-tip-content">
                    <h4>Eco Tip</h4>
                    <p>Freeze your spinach today to use in smoothies later and avoid waste!</p>
                </div>
            </div>
        `);
    }

    grid.innerHTML = cardsHTML.join('');
}

// Preserve inventory table function for layout compatibility
function renderInventoryTable() {
    const tbody = $('inventory-table-body');
    if (!tbody) return;
    const items = myItems()
        .map(i => ({ ...i, dr: daysRemaining(i.dateExpiry) }))
        .sort((a, b) => a.dr - b.dr);

    tbody.innerHTML = items.map(item => {
        const cat    = CATEGORIES[item.category] || CATEGORIES.pantry;
        const status = expiryStatus(item.dr);
        const dayTxt = item.dr < 0 ? `Expired ${Math.abs(item.dr)}d ago` : item.dr === 0 ? 'Today' : `${item.dr} days`;
        return `<tr>
            <td><div class="tbl-item-name-cell">
                <i class="${cat.icon}"></i>
                <h4>${escHTML(item.name)}</h4>
            </div></td>
            <td><span class="badge ${cat.colorClass}">${cat.name}</span></td>
            <td>${item.storage}</td>
            <td>${item.qty} ${escHTML(item.unit)}</td>
            <td>${friendlyDate(item.dateExpiry)}</td>
            <td class="${status.cls}" style="font-weight:600">${dayTxt}</td>
            <td><span class="badge ${status.badge}">${status.label}</span></td>
            <td>
                <div class="food-actions" style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-sm" onclick="openModal('${item.id}')">Edit</button>
                    <button class="btn btn-secondary btn-sm" onclick="resolveItem('${item.id}','consumed')">Eat</button>
                    <button class="btn btn-secondary btn-sm" onclick="deleteItem('${item.id}')">Delete</button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ===========================================================================
// ADD ITEM VIEW (Snap & Track)
// ===========================================================================

function renderAddTab() {
    const pillsList = $('frequent-pills-list');
    if (!pillsList) return;

    pillsList.innerHTML = FREQUENT_ADDITIONS.map((add, index) => {
        const img = getItemImage(add.name);
        const cat = CATEGORIES[add.category] || CATEGORIES.pantry;
        
        return `
            <div class="frequent-pill-card" onclick="prefillTrackForm(${index})">
                <div class="frequent-pill-image">
                    <img src="${img}" alt="${escHTML(add.name)}">
                </div>
                <div class="frequent-pill-info">
                    <h4>${escHTML(add.name)}</h4>
                    <p>${cat.name}</p>
                </div>
            </div>
        `;
    }).join('');

    // Reset Form Expiry defaults
    $('track-expiry').value = offsetDate(7);
}

function prefillTrackForm(index) {
    const item = FREQUENT_ADDITIONS[index];
    if (!item) return;

    $('track-name').value = item.name;
    $('track-category').value = item.category;
    $('track-expiry').value = offsetDate(item.days);

    showToast(`Prefilled with ${item.name}!`, 'info');
}

async function handleTrackFormSubmit(e) {
    e.preventDefault();
    const name     = $('track-name').value.trim();
    const category = $('track-category').value;
    const expiry   = $('track-expiry').value;

    if (!name || !expiry) {
        showToast('Please fill in item name.', 'warning');
        return;
    }

    // Default values for snap & track
    let qty = 1;
    let unit = 'pcs';
    let storage = 'fridge'; // Default storage

    // Check custom overrides based on name
    const n = name.toLowerCase();
    if (n.includes('milk')) { qty = 1; unit = 'liter'; storage = 'fridge'; }
    else if (n.includes('carrot') || n.includes('avocado') || n.includes('spinach')) { qty = 500; unit = 'g'; storage = 'fridge'; }
    else if (n.includes('banana')) { qty = 6; unit = 'units'; storage = 'pantry'; }
    else if (n.includes('sourdough')) { qty = 1; unit = 'loaf'; storage = 'pantry'; }

    const id = uid();
    const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    try {
        const res = await fetch('/api/food', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                id, name, category, storage, qty, unit,
                dateAdded: todayStr(), dateExpiry: expiry,
                imageData: pendingImageData || null
            })
        });

        if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Failed to add item.', 'danger');
            return;
        }

        allFoodItems.push({
            id,
            username: currentUser.username,
            name,
            category,
            storage,
            qty,
            unit,
            dateAdded: todayStr(),
            dateExpiry: expiry,
            imageData: pendingImageData || null
        });

        showToast(`Added ${name} to pantry!`, 'success');
        $('track-item-form').reset();
        resetPhotoUpload('track-photo-input', 'track-photo-preview', 'track-photo-placeholder');

        // Redirect to grid view
        switchTab('inventory');
    } catch (err) {
        showToast('Network error tracking item.', 'danger');
    }
}

// ===========================================================================
// FALLBACK/DESKTOP ADD MODAL
// ===========================================================================

function openModal(itemId) {
    editingItemId = itemId || null;
    $('modal-title').textContent = editingItemId ? 'Edit Food Item' : 'Add Food Item';
    $('food-item-form').reset();
    $('food-qty').value  = 1;
    $('food-unit').value = 'pcs';
    $('food-expiry').min = todayStr();

    // Reset photo upload state
    resetPhotoUpload('modal-photo-input', 'modal-photo-preview', 'modal-photo-placeholder');

    if (editingItemId) {
        const item = allFoodItems.find(i => i.id === editingItemId);
        if (!item) return;
        $('food-name').value     = item.name;
        $('food-category').value = item.category;
        $('food-storage').value  = item.storage;
        $('food-qty').value      = item.qty;
        $('food-unit').value     = item.unit;
        $('food-expiry').value   = item.dateExpiry;
        // Restore existing photo if any
        if (item.imageData) {
            pendingImageData = item.imageData;
            const preview = $('modal-photo-preview');
            const placeholder = $('modal-photo-placeholder');
            if (preview) { preview.src = item.imageData; preview.style.display = 'block'; }
            if (placeholder) placeholder.style.display = 'none';
        }
    } else {
        $('food-expiry').value = offsetDate(7);
    }

    $('modal-food-form').classList.add('show');
    setTimeout(() => $('food-name').focus(), 50);
}

function closeModal() {
    $('modal-food-form').classList.remove('show');
    editingItemId = null;
}

async function handleFoodFormSubmit(e) {
    e.preventDefault();
    const name     = $('food-name').value.trim();
    const category = $('food-category').value;
    const storage  = $('food-storage').value;
    const qty      = parseFloat($('food-qty').value);
    const unit     = $('food-unit').value.trim() || 'pcs';
    const expiry   = $('food-expiry').value;

    if (!name || isNaN(qty) || qty <= 0 || !expiry) {
        showToast('Please fill in required fields.', 'warning');
        return;
    }

    const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    try {
        if (editingItemId) {
            const body = { name, category, storage, qty, unit, dateExpiry: expiry };
            if (pendingImageData) body.imageData = pendingImageData;
            
            const res = await fetch(`/api/food/${editingItemId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || 'Failed to update item.', 'danger');
                return;
            }
            
            const idx = allFoodItems.findIndex(i => i.id === editingItemId);
            if (idx !== -1) {
                allFoodItems[idx] = { ...allFoodItems[idx], name, category, storage, qty, unit, dateExpiry: expiry };
                if (pendingImageData) allFoodItems[idx].imageData = pendingImageData;
            }
            showToast(`Updated "${name}"`, 'info');
        } else {
            const id = uid();
            const body = {
                id, name, category, storage, qty, unit,
                dateAdded: todayStr(), dateExpiry: expiry,
                imageData: pendingImageData || null
            };
            const res = await fetch('/api/food', {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || 'Failed to add item.', 'danger');
                return;
            }
            allFoodItems.push({
                id, username: currentUser.username,
                name, category, storage, qty, unit,
                dateAdded: todayStr(), dateExpiry: expiry,
                imageData: pendingImageData || null
            });
            showToast(`Added "${name}"!`, 'success');
        }

        closeModal();
        resetPhotoUpload('modal-photo-input', 'modal-photo-preview', 'modal-photo-placeholder');
        refreshCurrentTab();
    } catch (err) {
        showToast('Network error saving item.', 'danger');
    }
}

function refreshCurrentTab() {
    const active = document.querySelector('.sidebar .nav-item.active') || document.querySelector('.bottom-nav-item.active');
    const tab = active ? active.dataset.tab : 'dashboard';
    
    if      (tab === 'dashboard') refreshDashboard();
    else if (tab === 'inventory') renderInventoryGrid();
    else if (tab === 'admin')     renderAdminTab();
}

// ===========================================================================
// CONSUME / WASTE / DELETE
// ===========================================================================

async function resolveItem(id, resolution) {
    const idx = allFoodItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = allFoodItems[idx];

    const histId = uid();
    const dateHandled = todayStr();
    const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    try {
        const histRes = await fetch('/api/history', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                id: histId, name: item.name, category: item.category,
                storage: item.storage, qty: item.qty, unit: item.unit,
                resolution, dateHandled
            })
        });

        if (!histRes.ok) {
            showToast('Failed to log history on server.', 'danger');
            return;
        }

        const delRes = await fetch(`/api/food/${id}`, {
            method: 'DELETE',
            headers
        });

        if (!delRes.ok) {
            showToast('Failed to delete item from server.', 'danger');
            return;
        }

        allHistory.unshift({
            id: histId, username: currentUser.username,
            name: item.name, category: item.category,
            storage: item.storage, qty: item.qty, unit: item.unit,
            resolution, dateHandled
        });
        
        allFoodItems.splice(idx, 1);
        
        const message = resolution === 'consumed' ? `Logged ${item.name} as consumed!` : `Logged ${item.name} as waste.`;
        showToast(message, resolution === 'consumed' ? 'success' : 'warning');
        refreshCurrentTab();
    } catch (err) {
        showToast('Network error resolving item.', 'danger');
    }
}

async function deleteItem(id) {
    const idx = allFoodItems.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = allFoodItems[idx];
    
    const headers = { 
        'Authorization': `Bearer ${authToken}`
    };

    try {
        const res = await fetch(`/api/food/${id}`, {
            method: 'DELETE',
            headers
        });

        if (!res.ok) {
            showToast('Failed to delete item from server.', 'danger');
            return;
        }

        undoStack = { item: { ...item }, idx };
        allFoodItems.splice(idx, 1);
        
        showToast(`Removed "${item.name}"`, 'info', async () => {
            if (!undoStack) return;
            try {
                const addRes = await fetch('/api/food', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(undoStack.item)
                });
                if (!addRes.ok) {
                    showToast('Failed to restore item to server.', 'danger');
                    return;
                }
                
                allFoodItems.splice(undoStack.idx, 0, undoStack.item);
                undoStack = null;
                refreshCurrentTab();
                showToast('Restored!', 'success');
            } catch (err) {
                showToast('Network error restoring item.', 'danger');
            }
        });
        
        refreshCurrentTab();
    } catch (err) {
        showToast('Network error deleting item.', 'danger');
    }
}

// ===========================================================================
// SMART RECIPES VIEW
// ===========================================================================

function renderRecipesTab() {
    const checklist = $('recipe-ingredients-checklist');
    const available = myItems()
        .map(i => ({ ...i, dr: daysRemaining(i.dateExpiry) }))
        .filter(i => i.dr >= 0)
        .sort((a, b) => a.dr - b.dr);

    if (available.length === 0) {
        checklist.innerHTML = `<p style="color:var(--color-text-dim);text-align:center;padding:16px 0">No ingredients in pantry.</p>`;
        $('btn-find-recipes').disabled = true;
        $('recipes-grid-container').innerHTML = '';
        $('recipe-matches-count').textContent = '0 suggestions';
        return;
    }

    $('btn-find-recipes').disabled = false;
    checklist.innerHTML = available.map(item => {
        const dotCls = item.dr <= 3 ? 'color-warning' : 'color-fridge';
        const color = item.dr <= 3 ? 'var(--color-warning)' : 'var(--color-success)';
        
        return `<label class="ingredient-checkbox-label">
            <input type="checkbox" name="recipe-ingredient" value="${item.category}" checked data-name="${escHTML(item.name)}">
            <span>${escHTML(item.name)}</span>
            <span class="urgency-dot" style="background:${color}" title="${item.dr} days remaining"></span>
        </label>`;
    }).join('');

    matchRecipes();
}

function matchRecipes() {
    const checked = Array.from(document.querySelectorAll('input[name="recipe-ingredient"]:checked'));
    const selCats = [...new Set(checked.map(c => c.value))];
    const grid    = $('recipes-grid-container');
    const countEl = $('recipe-matches-count');

    if (selCats.length === 0) {
        countEl.textContent = '0 suggestions';
        grid.innerHTML = `<div class="no-items-placeholder" style="grid-column:1/-1; text-align:center; padding:40px;">
            <h4>No Ingredients Selected</h4>
            <p>Toggle ingredients in the checklist to explore meal matches.</p>
        </div>`;
        return;
    }

    const matched = RECIPE_DB
        .map(r => {
            const statuses = r.required.map(req => ({
                label: CATEGORIES[req]?.name || req,
                matched: selCats.includes(req)
            }));
            return { ...r, statuses, matchCount: statuses.filter(s => s.matched).length };
        })
        .filter(r => r.matchCount > 0)
        .sort((a, b) => (b.matchCount / b.required.length) - (a.matchCount / a.required.length));

    countEl.textContent = `${matched.length} matches`;

    if (matched.length === 0) {
        grid.innerHTML = `<div class="no-items-placeholder" style="grid-column:1/-1; text-align:center;">
            <h4>No Recipes Match</h4>
            <p>Try adding items in other categories to discover more.</p>
        </div>`;
        return;
    }

    grid.innerHTML = matched.map(r => {
        const ingList = r.statuses.map(s =>
            `<li class="${s.matched ? 'matched' : 'missing'}">
                <i class="fa-solid ${s.matched ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                <span>${escHTML(s.label)}</span>
            </li>`
        ).join('');
        
        const steps = r.steps.map((s,i) => `<li><strong>${i+1}.</strong> ${escHTML(s)}</li>`).join('');
        
        return `<div class="recipe-card">
            <h4>${escHTML(r.name)}</h4>
            <p class="recipe-desc">${escHTML(r.desc)}</p>
            <div class="recipe-meta">
                <span><i class="fa-solid fa-clock"></i> ${r.prepTime}</span>
                <span><i class="fa-solid fa-gauge"></i> ${r.difficulty}</span>
            </div>
            <div class="recipe-ingredients-match" style="margin-bottom:12px">
                <h5>Ingredients Check</h5>
                <ul>${ingList}</ul>
            </div>
            <div class="recipe-ingredients-match">
                <h5>Preparation Steps</h5>
                <ul style="flex-direction:column;gap:4px;align-items:start">${steps}</ul>
            </div>
        </div>`;
    }).join('');
}

// ===========================================================================
// HISTORY / LOG TAB
// ===========================================================================

function renderHistoryTab() {
    const hist     = myHistory();
    const consumed = hist.filter(h => h.resolution === 'consumed').length;
    const wasted   = hist.filter(h => h.resolution === 'wasted').length;
    const pct      = hist.length > 0 ? Math.round((consumed / hist.length) * 100) : 100;

    $('history-total-managed').textContent  = hist.length;
    $('history-total-consumed').textContent = consumed;
    $('history-total-wasted').textContent   = wasted;
    $('efficiency-performance-text').textContent = pct + '%';
    $('linear-consumed-fill').style.width   = pct + '%';

    const tbody = $('history-table-body');
    if (!tbody) return;
    
    if (hist.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:3rem;color:var(--color-text-dim);">
            No logged activity. Eat or discard items from the pantry.
        </td></tr>`;
        return;
    }

    tbody.innerHTML = hist.map(item => {
        const cat     = CATEGORIES[item.category] || CATEGORIES.pantry;
        const isWaste = item.resolution === 'wasted';
        return `<tr class="${isWaste ? 'tbl-row-wasted' : 'tbl-row-consumed'}">
            <td><div class="tbl-item-name-cell">
                <i class="${cat.icon}"></i>
                <h4>${escHTML(item.name)}</h4>
            </div></td>
            <td><span class="badge ${cat.colorClass}">${cat.name}</span></td>
            <td>${item.storage}</td>
            <td>${item.qty} ${escHTML(item.unit)}</td>
            <td><span class="badge ${isWaste ? 'badge-danger' : 'badge-success'}">
                ${isWaste ? 'Wasted' : 'Eaten'}
            </span></td>
            <td>${friendlyDate(item.dateHandled)}</td>
        </tr>`;
    }).join('');
}

async function clearHistory() {
    if (!confirm('Clear activity logs?')) return;

    try {
        const res = await fetch('/api/history', {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) {
            showToast('Failed to clear logs on server.', 'danger');
            return;
        }

        allHistory = [];
        renderHistoryTab();
        showToast('Logs cleared.', 'info');
    } catch (err) {
        showToast('Network error clearing logs.', 'danger');
    }
}

// ===========================================================================
// ADMIN PANEL VIEW
// ===========================================================================

async function renderAdminTab() {
    if (currentUser?.role !== 'admin') return;

    try {
        const headers = { 'Authorization': `Bearer ${authToken}` };
        const res = await fetch('/api/admin/data', { headers });
        if (!res.ok) {
            showToast('Failed to load admin data.', 'danger');
            return;
        }
        const { users, items, logs } = await res.json();
        
        allUsers = users;

        const expired  = items.filter(i => daysRemaining(i.dateExpiry) < 0).length;
        const warning  = items.filter(i => { const d = daysRemaining(i.dateExpiry); return d >= 0 && d <= 3; }).length;

        $('admin-metric-users').textContent   = users.length;
        $('admin-metric-items').textContent   = items.length;
        $('admin-metric-warning').textContent = warning;
        $('admin-metric-expired').textContent = expired;

        const tbody = $('admin-users-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = users.map(u => {
            const uItems = items.filter(i => i.username === u.username).length;
            const uLogs  = logs.filter(i => i.username === u.username).length;
            const isSelf = u.username === currentUser.username;

            let actions = '—';
            if (!isSelf) {
                const isGoogle = u.provider === 'google';
                const resetBtn = isGoogle ? '' : `
                    <button class="btn btn-secondary btn-sm" onclick="adminGenerateResetLink('${u.username}')" style="margin-right:4px;">
                        Link
                    </button>
                `;
                actions = `
                    <div style="display:flex; align-items:center;">
                        ${resetBtn}
                        <button class="btn btn-secondary btn-sm" onclick="adminDeleteUser('${u.username}')">
                            Remove
                        </button>
                    </div>
                `;
            }

            return `<tr>
                <td><strong>${escHTML(u.username)}</strong> ${isSelf ? '<span class="badge badge-info">You</span>' : ''}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-warning' : 'badge-success'}">${u.role}</span></td>
                <td>${uItems}</td>
                <td>${uLogs}</td>
                <td>${actions}</td>
            </tr>`;
        }).join('');

        // Load pending admin requests
        await renderAdminPendingRequests();
        // Load failed login alerts
        await renderAdminFailedLogins();
    } catch (err) {
        showToast('Network error loading admin panel.', 'danger');
    }
}

async function renderAdminFailedLogins() {
    const container = $('admin-failed-logins-list');
    const countBadge = $('admin-failed-logins-count');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/failed-logins', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const alerts = await res.json();

        if (countBadge) {
            if (alerts.length > 0) {
                countBadge.textContent = alerts.length;
                countBadge.style.display = 'inline';
            } else {
                countBadge.style.display = 'none';
            }
        }

        if (alerts.length === 0) {
            container.innerHTML = '<div class="empty-state-sm"><i class="fa-solid fa-shield-check"></i> No login alerts at this time.</div>';
            return;
        }

        container.innerHTML = alerts.map(u => {
            const timeAgo = u.lastAttempt ? relativeDate(new Date(u.lastAttempt).toISOString().split('T')[0]) : 'recently';
            return `
                <div class="admin-failed-login-row">
                    <div class="admin-failed-login-info">
                        <div class="admin-failed-login-icon"><i class="fa-solid fa-lock"></i></div>
                        <div>
                            <span class="admin-failed-login-username">${escHTML(u.username)}</span>
                            <span class="admin-failed-login-meta">${u.attempts} failed attempt${u.attempts !== 1 ? 's' : ''} &bull; ${timeAgo}</span>
                        </div>
                    </div>
                    <div class="admin-failed-login-actions">
                        <button class="btn btn-primary btn-sm" onclick="adminSendResetForFailed('${escHTML(u.username)}')">
                            <i class="fa-solid fa-key"></i> Send Reset Link
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="adminClearFailedLogin('${escHTML(u.username)}')">
                            <i class="fa-solid fa-check"></i> Dismiss
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = '<div class="empty-state-sm">Failed to load alerts.</div>';
    }
}

async function adminDeleteUser(username) {
    if (username === currentUser.username) return;
    if (!confirm(`Remove account for user "${username}"?`)) return;

    try {
        const res = await fetch(`/api/admin/users/${username}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Failed to remove account.', 'danger');
            return;
        }

        showToast(`Account "${username}" removed.`, 'warning');
        await renderAdminTab();
    } catch (err) {
        showToast('Network error removing user.', 'danger');
    }
}

async function handleAdminCreateUser(e) {
    e.preventDefault();
    const username = $('admin-new-username').value.trim().toLowerCase();
    const password = $('admin-new-password').value;
    const role     = $('admin-new-role').value;
    const errEl    = $('admin-create-error');

    const showErr = msg => { errEl.textContent = msg; errEl.style.display = 'block'; };
    errEl.style.display = 'none';

    if (!username || !password)                    { showErr('Fields required.');              return; }
    if (username.length < 3)                       { showErr('Username must be 3+ characters.');       return; }
    if (password.length < 4)                       { showErr('Password must be 4+ characters.');       return; }

    try {
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username, password, role })
        });
        
        if (!res.ok) {
            const data = await res.json();
            showErr(data.error || 'Failed to create account.');
            return;
        }

        $('admin-create-user-form').reset();
        showToast(`Account "${username}" created.`, 'success');
        await renderAdminTab();
    } catch (err) {
        showErr('Network error creating user.');
    }
}

// ===========================================================================
// TOAST NOTIFICATIONS
// ===========================================================================

function showToast(message, type = 'info', undoCb = null) {
    const container = $('toast-container');
    if (!container) return;
    
    const icons = { success:'fa-circle-check', warning:'fa-triangle-exclamation', danger:'fa-circle-xmark', info:'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fa-solid ${icons[type] || icons.info}"></i>
        <div class="toast-message">${escHTML(message)}</div>
        ${undoCb ? '<button class="btn-toast-undo">Undo</button>' : ''}
    `;
    if (undoCb) toast.querySelector('.btn-toast-undo').addEventListener('click', () => { undoCb(); toast.remove(); });
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(15px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

async function adminGenerateResetLink(username) {
    try {
        const headers = { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
        const res = await fetch('/api/auth/generate-reset', {
            method: 'POST',
            headers,
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.error || 'Failed to generate reset link.', 'danger');
            return;
        }
        
        const resetUrl = window.location.origin + window.location.pathname + `?action=reset-password&user=${encodeURIComponent(username)}&token=${data.token}`;

        const modal = $('modal-admin-reset');
        const displayUsername = $('admin-reset-username');
        const inputUrl = $('admin-reset-url-input');

        if (displayUsername) displayUsername.textContent = username;
        if (inputUrl) inputUrl.value = resetUrl;
        if (modal) modal.style.display = 'flex';
    } catch (err) {
        showToast('Network error generating reset link.', 'danger');
    }
}

async function checkPasswordResetURL() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const username = params.get('user');
    const token = params.get('token');

    if (action === 'reset-password' && username && token) {
        try {
            const res = await fetch(`/api/auth/validate-reset?user=${encodeURIComponent(username)}&token=${encodeURIComponent(token)}`);
            const data = await res.json();
            
            if (!res.ok || !data.valid) {
                showToast('Reset link invalid or expired.', 'danger');
                window.history.pushState({}, document.title, window.location.pathname);
                return;
            }

            const resetModalOverlay = $('reset-modal-overlay');
            const resetUsernameDisplay = $('reset-modal-username-display');
            const resetNewPassword = $('reset-new-password');
            const resetConfirmPassword = $('reset-confirm-password');
            const resetModalError = $('reset-modal-error');

            if (resetUsernameDisplay) resetUsernameDisplay.textContent = data.username;
            if (resetNewPassword) resetNewPassword.value = '';
            if (resetConfirmPassword) resetConfirmPassword.value = '';
            if (resetModalError) { resetModalError.style.display = 'none'; resetModalError.textContent = ''; }
            if (resetModalOverlay) resetModalOverlay.style.display = 'flex';
            if (resetNewPassword) setTimeout(() => resetNewPassword.focus(), 50);

            window.pendingResetUser = { username: data.username, token };
        } catch (err) {
            showToast('Network error validating reset link.', 'danger');
            window.history.pushState({}, document.title, window.location.pathname);
        }
    }
}

// Expose globals for inline onclick event handlers
window.loadDemoData    = loadDemoData;
window.openModal       = openModal;
window.resolveItem     = resolveItem;
window.deleteItem      = deleteItem;
window.adminDeleteUser = adminDeleteUser;
window.adminGenerateResetLink = adminGenerateResetLink;
window.filterByCategoryTab = filterByCategoryTab;
window.prefillTrackForm = prefillTrackForm;
window.adminApproveRequest = adminApproveRequest;
window.adminRejectRequest  = adminRejectRequest;
window.adminClearFailedLogin = adminClearFailedLogin;
window.adminSendResetForFailed = adminSendResetForFailed;

// ===========================================================================
// ADMIN PENDING REQUESTS
// ===========================================================================

async function renderAdminPendingRequests() {
    const container = $('admin-pending-requests-list');
    const countBadge = $('admin-requests-count');
    if (!container) return;

    try {
        const res = await fetch('/api/admin/pending-requests', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) return;
        const pending = await res.json();

        if (countBadge) {
            if (pending.length > 0) {
                countBadge.textContent = pending.length;
                countBadge.style.display = 'inline';
            } else {
                countBadge.style.display = 'none';
            }
        }

        if (pending.length === 0) {
            container.innerHTML = '<div class="empty-state-sm"><i class="fa-solid fa-check-circle"></i> No pending requests.</div>';
            return;
        }

        container.innerHTML = pending.map(u => `
            <div class="admin-request-row">
                <div class="admin-request-info">
                    <span class="admin-request-username">${escHTML(u.username)}</span>
                    <span class="admin-request-code-label">Verification Code (share this with them via phone/message):</span>
                </div>
                <span class="admin-request-code-value">${escHTML(u.adminVerifyCode)}</span>
                <div class="admin-request-actions">
                    <button class="btn btn-primary btn-sm" onclick="adminApproveRequest('${escHTML(u.username)}')">
                        <i class="fa-solid fa-check"></i> Approve
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="adminRejectRequest('${escHTML(u.username)}')">
                        Reject
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        container.innerHTML = '<div class="empty-state-sm">Failed to load requests.</div>';
    }
}

async function adminApproveRequest(username) {
    if (!confirm(`Approve admin access for "${username}"? They will be notified via verification code.`)) return;
    try {
        const res = await fetch('/api/admin/approve-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ username })
        });
        if (!res.ok) {
            const d = await res.json();
            showToast(d.error || 'Failed to approve.', 'danger');
            return;
        }
        showToast(`${username} has been approved as admin!`, 'success');
        await renderAdminTab();
    } catch (err) {
        showToast('Network error.', 'danger');
    }
}

async function adminRejectRequest(username) {
    if (!confirm(`Reject admin request from "${username}"?`)) return;
    try {
        const res = await fetch('/api/admin/reject-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ username })
        });
        if (!res.ok) {
            const d = await res.json();
            showToast(d.error || 'Failed to reject.', 'danger');
            return;
        }
        showToast(`Request from ${username} rejected.`, 'info');
        await renderAdminTab();
    } catch (err) {
        showToast('Network error.', 'danger');
    }
}

// ===========================================================================
// ADMIN VERIFICATION FLOW (For users requesting admin access)
// ===========================================================================

function initAdminVerificationFlow() {
    const requestOverlay  = $('admin-request-modal-overlay');
    const verifyOverlay   = $('admin-verify-modal-overlay');
    const requestStep1    = $('admin-request-step-1');
    const requestStep2    = $('admin-request-step-2');
    const codeDisplay     = $('admin-code-display');
    const requestError    = $('admin-request-error');
    const verifyError     = $('admin-verify-error');
    const verifyInput     = $('admin-verify-code-input');

    function openAdminRequestModal() {
        if (requestStep1) requestStep1.style.display = 'block';
        if (requestStep2) requestStep2.style.display = 'none';
        if (requestError) { requestError.style.display = 'none'; requestError.textContent = ''; }
        if (requestOverlay) requestOverlay.style.display = 'flex';
    }

    function closeAdminRequestModal() {
        if (requestOverlay) requestOverlay.style.display = 'none';
    }

    function openAdminVerifyModal() {
        if (verifyError) { verifyError.style.display = 'none'; verifyError.textContent = ''; }
        if (verifyInput) verifyInput.value = '';
        if (verifyOverlay) verifyOverlay.style.display = 'flex';
        if (verifyInput) setTimeout(() => verifyInput.focus(), 50);
    }

    function closeAdminVerifyModal() {
        if (verifyOverlay) verifyOverlay.style.display = 'none';
    }

    // Close buttons
    const closeReq = $('btn-admin-request-modal-close');
    if (closeReq) closeReq.addEventListener('click', closeAdminRequestModal);
    const closeVer = $('btn-admin-verify-modal-close');
    if (closeVer) closeVer.addEventListener('click', closeAdminVerifyModal);

    // Click outside to close
    if (requestOverlay) requestOverlay.addEventListener('click', e => { if (e.target === requestOverlay) closeAdminRequestModal(); });
    if (verifyOverlay) verifyOverlay.addEventListener('click', e => { if (e.target === verifyOverlay) closeAdminVerifyModal(); });

    // Generate code button
    const btnGenerate = $('btn-generate-admin-code');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', async () => {
            if (requestError) { requestError.style.display = 'none'; }
            btnGenerate.disabled = true;
            btnGenerate.textContent = 'Generating...';
            try {
                const res = await fetch('/api/auth/request-admin', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await res.json();
                if (!res.ok) {
                    if (requestError) { requestError.textContent = data.error || 'Failed to generate code.'; requestError.style.display = 'block'; }
                    return;
                }
                if (codeDisplay) codeDisplay.textContent = data.code;
                if (requestStep1) requestStep1.style.display = 'none';
                if (requestStep2) requestStep2.style.display = 'block';
            } catch (err) {
                if (requestError) { requestError.textContent = 'Network error.'; requestError.style.display = 'block'; }
            } finally {
                btnGenerate.disabled = false;
                btnGenerate.textContent = 'Generate My Verification Code';
            }
        });
    }

    // Go to verify
    const btnGoVerify = $('btn-go-verify-code');
    if (btnGoVerify) {
        btnGoVerify.addEventListener('click', () => {
            closeAdminRequestModal();
            openAdminVerifyModal();
        });
    }

    // Submit verify code
    const btnSubmitVerify = $('btn-submit-admin-verify');
    if (btnSubmitVerify) {
        btnSubmitVerify.addEventListener('click', async () => {
            const code = verifyInput ? verifyInput.value.trim() : '';
            if (!code) {
                if (verifyError) { verifyError.textContent = 'Please enter the 6-digit code.'; verifyError.style.display = 'block'; }
                return;
            }
            btnSubmitVerify.disabled = true;
            btnSubmitVerify.textContent = 'Verifying...';
            try {
                const res = await fetch('/api/auth/verify-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (!res.ok) {
                    if (verifyError) { verifyError.textContent = data.error || 'Incorrect code.'; verifyError.style.display = 'block'; }
                    return;
                }
                // Update session with new admin token
                authToken = data.token;
                currentUser = { ...currentUser, role: 'admin' };
                localStorage.setItem('freshr_token', authToken);
                localStorage.setItem('freshr_session', JSON.stringify(currentUser));
                closeAdminVerifyModal();
                showToast('🎉 You are now an admin! Welcome.', 'success');
                updateSidebarProfile();
                switchTab('admin');
            } catch (err) {
                if (verifyError) { verifyError.textContent = 'Network error.'; verifyError.style.display = 'block'; }
            } finally {
                btnSubmitVerify.disabled = false;
                btnSubmitVerify.textContent = 'Verify & Activate Admin';
            }
        });
    }

    // Expose open function globally so it can be triggered from anywhere
    window.openAdminRequestModal = openAdminRequestModal;
    window.openAdminVerifyModal  = openAdminVerifyModal;
}


// ===========================================================================
// SHOW APP — update to also init admin verification
// ===========================================================================

const _originalShowApp = showApp;
function showApp() {
    $('auth-overlay').style.display  = 'none';
    const landing = $('landing-page-container');
    if (landing) landing.style.display = 'none';
    $('app-container').style.display = 'flex';
    updateSidebarProfile();
    switchTab('dashboard');
    // Initialize chatbot on first login
    initChatbot();
}

// Override DOMContentLoaded to init new features
document.addEventListener('DOMContentLoaded', () => {
    initAdminVerificationFlow();
}, { once: true });


// ===========================================================================
// ADMIN FAILED LOGIN HELPERS
// ===========================================================================

async function adminClearFailedLogin(username) {
    try {
        const res = await fetch(`/api/admin/clear-failed-logins/${encodeURIComponent(username)}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) {
            showToast('Failed to clear alert.', 'danger');
            return;
        }
        showToast(`Alert dismissed for "${username}".`, 'info');
        await renderAdminFailedLogins();
    } catch (err) {
        showToast('Network error.', 'danger');
    }
}

async function adminSendResetForFailed(username) {
    // Generate a reset link for this user and show the admin reset modal
    await adminGenerateResetLink(username);
    // After admin copies/sends the link, auto-dismiss the alert
    await adminClearFailedLogin(username);
}


// ===========================================================================
// AI CHATBOT
// ===========================================================================

let chatbotOpen = false;
let chatbotInitialized = false;

function initChatbot() {
    const fab       = $('btn-chatbot-fab');
    const panel     = $('chatbot-panel');
    const closeBtn  = $('btn-chatbot-close');
    const sendBtn   = $('btn-chatbot-send');
    const input     = $('chatbot-input');
    const messages  = $('chatbot-messages');
    const chips     = $('chatbot-quick-chips');

    if (!fab || !panel) return;

    // Show the fab
    fab.style.display = 'flex';

    function openChat() {
        chatbotOpen = true;
        panel.classList.add('chatbot-panel-open');
        panel.setAttribute('aria-hidden', 'false');
        fab.classList.add('chatbot-fab-active');
        $('chatbot-fab-icon').className = 'fa-solid fa-xmark chatbot-fab-icon';
        if (!chatbotInitialized) {
            chatbotInitialized = true;
            appendBotMessage(`👋 Hi **${currentUser?.username || 'there'}**! I'm FreshGuard AI.\n\nI can help you with food storage tips, expiry info, recipe ideas, and more. What would you like to know?`, true);
        }
        setTimeout(() => { if (input) input.focus(); }, 300);
    }

    function closeChat() {
        chatbotOpen = false;
        panel.classList.remove('chatbot-panel-open');
        panel.setAttribute('aria-hidden', 'true');
        fab.classList.remove('chatbot-fab-active');
        $('chatbot-fab-icon').className = 'fa-solid fa-robot chatbot-fab-icon';
    }

    fab.addEventListener('click', () => chatbotOpen ? closeChat() : openChat());
    if (closeBtn) closeBtn.addEventListener('click', closeChat);

    // Quick chip buttons
    if (chips) {
        chips.addEventListener('click', e => {
            const chip = e.target.closest('.chatbot-chip');
            if (chip && chip.dataset.msg) {
                sendMessage(chip.dataset.msg);
            }
        });
    }

    // Send via button
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            const msg = input ? input.value.trim() : '';
            if (msg) sendMessage(msg);
        });
    }

    // Send via Enter key
    if (input) {
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const msg = input.value.trim();
                if (msg) sendMessage(msg);
            }
        });
    }

    async function sendMessage(text) {
        if (!text || !text.trim()) return;
        if (input) input.value = '';

        // Hide quick chips after first user message
        if (chips) chips.style.display = 'none';

        appendUserMessage(text);
        const typingEl = appendTypingIndicator();

        try {
            const res = await fetch('/api/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ message: text })
            });
            const data = await res.json();
            typingEl.remove();

            if (res.ok) {
                appendBotMessage(data.reply);
            } else {
                appendBotMessage('Sorry, I could not process that. Please try again.');
            }
        } catch (err) {
            typingEl.remove();
            appendBotMessage('Network error. Please check your connection and try again.');
        }
    }

    function appendUserMessage(text) {
        const el = document.createElement('div');
        el.className = 'chat-msg chat-msg-user';
        el.innerHTML = `<div class="chat-bubble chat-bubble-user">${escHTML(text)}</div>`;
        messages.appendChild(el);
        scrollToBottom();
    }

    function appendBotMessage(text, skipAnim = false) {
        const el = document.createElement('div');
        el.className = 'chat-msg chat-msg-bot';
        const formatted = formatBotText(text);
        el.innerHTML = `
            <div class="chat-bot-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-bubble chat-bubble-bot">${formatted}</div>
        `;
        messages.appendChild(el);
        scrollToBottom();
        return el;
    }

    function appendTypingIndicator() {
        const el = document.createElement('div');
        el.className = 'chat-msg chat-msg-bot chat-typing';
        el.innerHTML = `
            <div class="chat-bot-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="chat-bubble chat-bubble-bot chat-typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        messages.appendChild(el);
        scrollToBottom();
        return el;
    }

    function scrollToBottom() {
        setTimeout(() => {
            if (messages) messages.scrollTop = messages.scrollHeight;
        }, 50);
    }

    function formatBotText(text) {
        // Convert markdown-like formatting to HTML
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')  // **bold**
            .replace(/\*(.+?)\*/g, '<em>$1</em>')              // *italic*
            .replace(/\n/g, '<br>')                             // newlines
            .replace(/^• /gm, '&bull; ');                      // bullets
    }
}

// ---------------------------------------------------------------------------
// Categories horizontal scroll arrows
// ---------------------------------------------------------------------------
(function initCategoryScrollArrows() {
    const list   = document.getElementById('dashboard-categories-list');
    const btnL   = document.getElementById('cat-scroll-left');
    const btnR   = document.getElementById('cat-scroll-right');
    if (!list || !btnL || !btnR) return;

    const STEP = 260;

    function updateArrows() {
        btnL.disabled = list.scrollLeft <= 0;
        btnR.disabled = list.scrollLeft + list.clientWidth >= list.scrollWidth - 1;
    }

    btnL.addEventListener('click', () => {
        list.scrollBy({ left: -STEP, behavior: 'smooth' });
    });

    btnR.addEventListener('click', () => {
        list.scrollBy({ left: STEP, behavior: 'smooth' });
    });

    list.addEventListener('scroll', updateArrows, { passive: true });

    // Re-run whenever the list is repopulated (MutationObserver)
    new MutationObserver(updateArrows).observe(list, { childList: true });

    updateArrows();
})();
