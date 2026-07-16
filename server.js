const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ---------------------------------------------------------------------------
// Load .env file (lightweight, no dotenv dependency needed)
// ---------------------------------------------------------------------------
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex > 0) {
                    const key = trimmed.substring(0, eqIndex).trim();
                    const value = trimmed.substring(eqIndex + 1).trim();
                    if (!process.env[key]) process.env[key] = value;
                }
            }
        });
    }
} catch (_) { /* .env loading is optional */ }


const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = 'freshguard-super-secret-key-12345!';


app.use(express.json({ limit: '10mb' })); // support image uploads

// Database Initialization
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err);
    } else {
        console.log('Connected to SQLite database at:', dbPath);
    }
});

// SQLite Promise Wrappers
const dbRun = (query, params = []) => new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
    });
});

const dbGet = (query, params = []) => new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Setup Tables & Seed Data
async function initDb() {
    try {
        await dbRun(`
            CREATE TABLE IF NOT EXISTS users (
                username TEXT PRIMARY KEY,
                password TEXT,
                role TEXT,
                provider TEXT,
                email TEXT,
                displayName TEXT,
                resetToken TEXT,
                resetTokenExpiry INTEGER,
                adminVerifyCode TEXT,
                adminVerifyStatus TEXT
            )
        `);
        // Migrate existing tables — add columns if they don't exist yet
        try { await dbRun('ALTER TABLE users ADD COLUMN adminVerifyCode TEXT'); } catch(_) {}
        try { await dbRun('ALTER TABLE users ADD COLUMN adminVerifyStatus TEXT'); } catch(_) {}

        // Failed logins tracking table
        await dbRun(`
            CREATE TABLE IF NOT EXISTS failed_logins (
                username TEXT PRIMARY KEY,
                attempts INTEGER DEFAULT 0,
                lastAttempt INTEGER,
                alertSent INTEGER DEFAULT 0
            )
        `);

        await dbRun(`
            CREATE TABLE IF NOT EXISTS food_items (
                id TEXT PRIMARY KEY,
                username TEXT,
                name TEXT,
                category TEXT,
                storage TEXT,
                qty REAL,
                unit TEXT,
                dateAdded TEXT,
                dateExpiry TEXT,
                imageData TEXT
            )
        `);

        await dbRun(`
            CREATE TABLE IF NOT EXISTS history_log (
                id TEXT PRIMARY KEY,
                username TEXT,
                name TEXT,
                category TEXT,
                storage TEXT,
                qty REAL,
                unit TEXT,
                resolution TEXT,
                dateHandled TEXT
            )
        `);

        // Seed default accounts
        const admin = await dbGet('SELECT * FROM users WHERE username = ?', ['admin']);
        if (!admin) {
            const adminHash = await bcrypt.hash('admin123', 10);
            await dbRun('INSERT INTO users (username, password, role, provider) VALUES (?, ?, ?, ?)', ['admin', adminHash, 'admin', 'local']);
            console.log('Seeded default admin account.');
        }

        const user = await dbGet('SELECT * FROM users WHERE username = ?', ['user']);
        if (!user) {
            const userHash = await bcrypt.hash('user123', 10);
            await dbRun('INSERT INTO users (username, password, role, provider) VALUES (?, ?, ?, ?)', ['user', userHash, 'user', 'local']);
            console.log('Seeded default user account.');
        }
    } catch (err) {
        console.error('Error during database initialization:', err);
    }
}

initDb();

// JWT Verification Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = payload; // { username, role }
        next();
    });
}

// ---------------------------------------------------------------------------
// AUTHENTICATION ENDPOINTS
// ---------------------------------------------------------------------------

app.post('/api/auth/signup', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    try {
        const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hash = await bcrypt.hash(password, 10);
        await dbRun('INSERT INTO users (username, password, role, provider) VALUES (?, ?, ?, ?)', [username, hash, role, 'local']);

        const token = jwt.sign({ username, role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { username, role, provider: 'local' } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to register user: ' + err.message });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user || user.provider !== 'local') {
            return res.status(400).json({ error: 'Incorrect username or password' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            // Track failed login attempts
            const existing = await dbGet('SELECT * FROM failed_logins WHERE username = ?', [username]);
            const newAttempts = (existing ? existing.attempts : 0) + 1;
            const alertSent = existing ? existing.alertSent : 0;
            const now = Date.now();

            if (existing) {
                await dbRun('UPDATE failed_logins SET attempts = ?, lastAttempt = ? WHERE username = ?',
                    [newAttempts, now, username]);
            } else {
                await dbRun('INSERT INTO failed_logins (username, attempts, lastAttempt, alertSent) VALUES (?, ?, ?, 0)',
                    [username, newAttempts, now]);
            }

            // Flag the account for admin after 3 failed attempts (only once per wave)
            if (newAttempts >= 3 && !alertSent) {
                await dbRun('UPDATE failed_logins SET alertSent = 1 WHERE username = ?', [username]);
            }

            const remaining = Math.max(0, 3 - newAttempts);
            const hint = remaining > 0 ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before admin is notified)` : ' Your account has been flagged. Contact the admin for a password reset link.';
            return res.status(400).json({ error: 'Incorrect username or password.' + hint, failCount: newAttempts });
        }

        // Successful login — clear failed attempt record
        await dbRun('DELETE FROM failed_logins WHERE username = ?', [username]);

        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { username: user.username, role: user.role, provider: 'local' } });
    } catch (err) {
        res.status(500).json({ error: 'Authentication failed: ' + err.message });
    }
});

app.post('/api/auth/google', async (req, res) => {
    const { email, role } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Google email is required' });
    }

    // Secure the email: Ensure it is a valid Google email format (e.g. gmail.com) and secure against malicious inputs
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'Please provide a valid and secure Google email address ending with @gmail.com' });
    }

    const googleUsername = 'g_' + email.replace(/[^a-z0-9]/g, '_');

    try {
        let user = await dbGet('SELECT * FROM users WHERE username = ?', [googleUsername]);
        
        if (!user) {
            const displayName = email.split('@')[0];
            await dbRun(
                'INSERT INTO users (username, role, provider, email, displayName) VALUES (?, ?, ?, ?, ?)', 
                [googleUsername, role, 'google', email, displayName]
            );
            user = { username: googleUsername, role, provider: 'google', email, displayName };
        }

        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ 
            token, 
            user: { 
                username: user.username, 
                role: user.role, 
                provider: 'google', 
                email: user.email, 
                displayName: user.displayName || user.username 
            } 
        });
    } catch (err) {
        res.status(500).json({ error: 'Google Auth failed: ' + err.message });
    }
});

app.post('/api/auth/generate-reset', authenticateToken, async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.provider === 'google') {
            return res.status(400).json({ error: 'Google accounts cannot be reset manually' });
        }

        const token = Math.random().toString(36).substring(2, 12);
        const expiry = Date.now() + 3600000; // 1 hour

        await dbRun('UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE username = ?', [token, expiry, username]);
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate reset link: ' + err.message });
    }
});

app.get('/api/auth/validate-reset', async (req, res) => {
    const { user: username, token } = req.query;
    if (!username || !token) {
        return res.status(400).json({ error: 'Username and token parameters are required' });
    }

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user || user.resetToken !== token || !user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
            return res.status(400).json({ error: 'Reset link invalid or expired' });
        }
        res.json({ valid: true, username: user.username });
    } catch (err) {
        res.status(500).json({ error: 'Failed to validate reset: ' + err.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { username, token, password } = req.body;
    if (!username || !token || !password) {
        return res.status(400).json({ error: 'Username, token, and password are required' });
    }

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user || user.resetToken !== token || !user.resetTokenExpiry || Date.now() > user.resetTokenExpiry) {
            return res.status(400).json({ error: 'Reset link invalid or expired' });
        }

        const hash = await bcrypt.hash(password, 10);
        await dbRun('UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE username = ?', [hash, username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reset password: ' + err.message });
    }
});

// ---------------------------------------------------------------------------
// FOOD ITEMS (INVENTORY) ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/food', authenticateToken, async (req, res) => {
    try {
        const items = await dbAll('SELECT * FROM food_items WHERE username = ?', [req.user.username]);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve food items: ' + err.message });
    }
});

app.post('/api/food', authenticateToken, async (req, res) => {
    const { id, name, category, storage, qty, unit, dateAdded, dateExpiry, imageData } = req.body;
    if (!id || !name || !category || !storage || qty === undefined || !unit || !dateAdded || !dateExpiry) {
        return res.status(400).json({ error: 'Missing required food fields' });
    }

    try {
        await dbRun(
            `INSERT INTO food_items (id, username, name, category, storage, qty, unit, dateAdded, dateExpiry, imageData)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.username, name, category, storage, qty, unit, dateAdded, dateExpiry, imageData || null]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add food item: ' + err.message });
    }
});

app.put('/api/food/:id', authenticateToken, async (req, res) => {
    const { name, category, storage, qty, unit, dateExpiry, imageData } = req.body;
    const itemId = req.params.id;

    try {
        const item = await dbGet('SELECT * FROM food_items WHERE id = ? AND username = ?', [itemId, req.user.username]);
        if (!item) {
            return res.status(404).json({ error: 'Food item not found' });
        }

        // Conditionally update image data to preserve original if not uploaded
        const updatedImg = imageData !== undefined ? imageData : item.imageData;

        await dbRun(
            `UPDATE food_items 
             SET name = ?, category = ?, storage = ?, qty = ?, unit = ?, dateExpiry = ?, imageData = ?
             WHERE id = ? AND username = ?`,
            [name, category, storage, qty, unit, dateExpiry, updatedImg, itemId, req.user.username]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update food item: ' + err.message });
    }
});

app.delete('/api/food/:id', authenticateToken, async (req, res) => {
    const itemId = req.params.id;

    try {
        const item = await dbGet('SELECT * FROM food_items WHERE id = ? AND username = ?', [itemId, req.user.username]);
        if (!item) {
            return res.status(404).json({ error: 'Food item not found' });
        }

        await dbRun('DELETE FROM food_items WHERE id = ? AND username = ?', [itemId, req.user.username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete food item: ' + err.message });
    }
});

// ---------------------------------------------------------------------------
// HISTORY ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const history = await dbAll('SELECT * FROM history_log WHERE username = ? ORDER BY dateHandled DESC', [req.user.username]);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve history: ' + err.message });
    }
});

app.post('/api/history', authenticateToken, async (req, res) => {
    const { id, name, category, storage, qty, unit, resolution, dateHandled } = req.body;
    if (!id || !name || !category || !storage || qty === undefined || !unit || !resolution || !dateHandled) {
        return res.status(400).json({ error: 'Missing required history parameters' });
    }

    try {
        await dbRun(
            `INSERT INTO history_log (id, username, name, category, storage, qty, unit, resolution, dateHandled)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, req.user.username, name, category, storage, qty, unit, resolution, dateHandled]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to log history item: ' + err.message });
    }
});

app.delete('/api/history', authenticateToken, async (req, res) => {
    try {
        await dbRun('DELETE FROM history_log WHERE username = ?', [req.user.username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear history log: ' + err.message });
    }
});

// ---------------------------------------------------------------------------
// ADMIN PANEL ENDPOINTS
// ---------------------------------------------------------------------------

app.get('/api/admin/data', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    try {
        const users = await dbAll('SELECT username, role, provider, email, displayName FROM users');
        const items = await dbAll('SELECT id, username, dateExpiry FROM food_items');
        const logs = await dbAll('SELECT id, username FROM history_log');
        res.json({ users, items, logs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve admin dashboard data: ' + err.message });
    }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Username, password, and role are required' });
    }

    try {
        const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const hash = await bcrypt.hash(password, 10);
        await dbRun('INSERT INTO users (username, password, role, provider) VALUES (?, ?, ?, ?)', [username, hash, role, 'local']);
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create user: ' + err.message });
    }
});

app.delete('/api/admin/users/:username', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const targetUser = req.params.username;
    if (targetUser === req.user.username) {
        return res.status(400).json({ error: 'You cannot remove your own admin account' });
    }

    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [targetUser]);
        if (!user) {
            return res.status(404).json({ error: 'User account not found' });
        }

        // Delete user along with their associated inventory and history records
        await dbRun('DELETE FROM users WHERE username = ?', [targetUser]);
        await dbRun('DELETE FROM food_items WHERE username = ?', [targetUser]);
        await dbRun('DELETE FROM history_log WHERE username = ?', [targetUser]);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user account: ' + err.message });
    }
});

// ---------------------------------------------------------------------------
// ADMIN VERIFICATION ENDPOINTS
// ---------------------------------------------------------------------------

// Request admin access — generates a 6-digit code stored for the user
app.post('/api/auth/request-admin', authenticateToken, async (req, res) => {
    const { username } = req.user;
    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ error: 'You are already an admin' });
        if (user.adminVerifyStatus === 'pending') {
            return res.json({ code: user.adminVerifyCode, status: 'pending', message: 'Your admin request is already pending.' });
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        await dbRun('UPDATE users SET adminVerifyCode = ?, adminVerifyStatus = ? WHERE username = ?',
            [code, 'pending', username]);
        res.json({ code, status: 'pending', message: 'Admin request submitted. Share the code with the app owner to get verified.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create admin request: ' + err.message });
    }
});

// Verify admin code — user enters the code given by the owner
app.post('/api/auth/verify-admin', authenticateToken, async (req, res) => {
    const { code } = req.body;
    const { username } = req.user;
    if (!code) return res.status(400).json({ error: 'Verification code is required' });
    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.role === 'admin') return res.status(400).json({ error: 'Already an admin' });
        if (user.adminVerifyStatus !== 'pending') {
            return res.status(400).json({ error: 'No pending admin request found. Please request admin access first.' });
        }
        if (user.adminVerifyCode !== code.trim()) {
            return res.status(400).json({ error: 'Incorrect verification code. Please ask the app owner for the correct code.' });
        }
        await dbRun('UPDATE users SET role = ?, adminVerifyCode = NULL, adminVerifyStatus = ? WHERE username = ?',
            ['admin', 'approved', username]);
        // Issue a new token with updated role
        const newToken = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token: newToken, role: 'admin' });
    } catch (err) {
        res.status(500).json({ error: 'Verification failed: ' + err.message });
    }
});

// Admin sees all pending admin requests
app.get('/api/admin/pending-requests', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const pending = await dbAll(
            "SELECT username, email, displayName, adminVerifyCode, adminVerifyStatus FROM users WHERE adminVerifyStatus = 'pending'"
        );
        res.json(pending);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load pending requests: ' + err.message });
    }
});

// Admin manually approves a user's admin request
app.post('/api/admin/approve-request', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        await dbRun('UPDATE users SET role = ?, adminVerifyStatus = ? WHERE username = ?',
            ['admin', 'approved', username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to approve request: ' + err.message });
    }
});

// Admin rejects a pending admin request
app.post('/api/admin/reject-request', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });
    try {
        await dbRun('UPDATE users SET adminVerifyCode = NULL, adminVerifyStatus = ? WHERE username = ?',
            ['rejected', username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to reject request: ' + err.message });
    }
});

// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// ADMIN FAILED LOGIN ALERTS
// ---------------------------------------------------------------------------

// Get all accounts with admin alerts (3+ failed logins)
app.get('/api/admin/failed-logins', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    try {
        const alerts = await dbAll(
            'SELECT fl.username, fl.attempts, fl.lastAttempt, u.email, u.role FROM failed_logins fl LEFT JOIN users u ON fl.username = u.username WHERE fl.alertSent = 1 ORDER BY fl.lastAttempt DESC'
        );
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load failed login alerts: ' + err.message });
    }
});

// Admin clears a failed-login alert for a user
app.post('/api/admin/clear-failed-logins/:username', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { username } = req.params;
    try {
        await dbRun('DELETE FROM failed_logins WHERE username = ?', [username]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to clear alert: ' + err.message });
    }
});


// ---------------------------------------------------------------------------
// AI CHATBOT ENDPOINT  (Google Gemini + keyword-match fallback)
// ---------------------------------------------------------------------------

const CHATBOT_KNOWLEDGE = [
    // Greetings
    { patterns: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'howdy'],
      response: (name) => `Hello ${name}! 👋 I'm FreshGuard AI, your smart pantry assistant. I can help you with food storage tips, expiry information, reducing food waste, and recipe ideas. What would you like to know?` },

    // Help
    { patterns: ['help', 'what can you do', 'what do you know', 'capabilities', 'features', 'guide'],
      response: () => `I can help you with:\n\n🥦 **Food storage tips** — how to store different foods\n📅 **Expiry guidance** — how long foods last\n🍳 **Recipe ideas** — what to cook with expiring items\n♻️ **Waste reduction** — tips to minimize food waste\n🔑 **Account help** — password reset and login issues\n\nJust ask me anything about your pantry!` },

    // Milk
    { patterns: ['milk', 'dairy milk', 'whole milk', 'skim milk'],
      response: () => `🥛 **Milk Storage Tips:**\n• Opened milk lasts **5–7 days** in the fridge\n• Unopened pasteurized milk: **1–2 weeks** past the sell-by date\n• Keep at 37°F (3°C) or below\n• Freeze milk for up to **3 months** — it will expand, so leave space!\n• Signs it's bad: sour smell, lumpy texture, off taste` },

    // Yogurt
    { patterns: ['yogurt', 'greek yogurt', 'yoghurt'],
      response: () => `🫙 **Yogurt Tips:**\n• Lasts **1–3 weeks** past the sell-by date if unopened\n• Once opened: **5–7 days** in the fridge\n• The liquid (whey) on top is normal — just stir it back in\n• Can be frozen for **1–2 months** (texture may change)` },

    // Cheese
    { patterns: ['cheese', 'cheddar', 'mozzarella', 'parmesan', 'gouda'],
      response: () => `🧀 **Cheese Storage:**\n• Hard cheeses (parmesan, cheddar): **3–4 weeks** opened, **6 months** unopened\n• Soft cheeses (mozzarella, brie): **5–7 days** after opening\n• Always wrap tightly in wax paper or plastic\n• Mold on hard cheese? Cut 1 inch around and below it — the rest is safe!` },

    // Eggs
    { patterns: ['egg', 'eggs', 'fresh eggs'],
      response: () => `🥚 **Egg Storage:**\n• Raw eggs in shell: **3–5 weeks** in the fridge\n• Hard-boiled eggs: **1 week** in the fridge\n• **Float test:** Drop in water — floaters are bad, sinkers are fresh!\n• Store pointy-end down to keep the yolk centered\n• Freeze eggs out of their shell for up to **1 year**` },

    // Meat / Fish
    { patterns: ['meat', 'chicken', 'beef', 'pork', 'fish', 'salmon', 'steak', 'ground beef', 'mince'],
      response: () => `🥩 **Meat & Fish Storage:**\n• **Chicken/Turkey:** 1–2 days fridge, 9–12 months frozen\n• **Beef/Pork:** 3–5 days fridge, 4–12 months frozen\n• **Fish/Seafood:** 1–2 days fridge, 2–6 months frozen\n• Always store on the bottom shelf of the fridge to prevent drips\n• Thaw in the fridge overnight — never at room temperature` },

    // Vegetables
    { patterns: ['vegetable', 'vegetables', 'veggies', 'carrot', 'broccoli', 'spinach', 'lettuce', 'kale', 'celery', 'cabbage'],
      response: () => `🥦 **Vegetable Storage:**\n• **Leafy greens (spinach, lettuce):** 3–7 days — store in a damp paper towel\n• **Root vegetables (carrots, parsnips):** 2–4 weeks in fridge\n• **Broccoli/Cauliflower:** 3–5 days\n• **Cabbage:** 1–2 months\n• Most veggies last longer unwashed — wash just before eating!` },

    // Fruits
    { patterns: ['fruit', 'fruits', 'banana', 'apple', 'berries', 'strawberry', 'avocado', 'citrus', 'orange', 'lemon'],
      response: () => `🍎 **Fruit Storage:**\n• **Bananas:** Room temp. Put in fridge when ripe — skin darkens but inside is fine\n• **Apples:** 4–6 weeks in the fridge, 1 week at room temp\n• **Berries:** 2–3 days — don't wash until ready to eat\n• **Avocados:** Ripen at room temp, then fridge for 2–3 days\n• **Citrus:** 2–3 weeks at room temp, 1–2 months in fridge` },

    // Bread
    { patterns: ['bread', 'loaf', 'sourdough', 'baguette', 'toast'],
      response: () => `🍞 **Bread Storage:**\n• Room temp in a bread box: **3–5 days**\n• Fridge (if no mold risk): **up to 2 weeks** (but dries faster)\n• Freeze for up to **3 months** — slice before freezing for easy use!\n• Stale bread? Perfect for French toast, croutons, or breadcrumbs` },

    // Leftovers
    { patterns: ['leftovers', 'leftover', 'cooked food', 'reheating', 'reheat'],
      response: () => `🍲 **Leftover Food Tips:**\n• Store in airtight containers within **2 hours** of cooking\n• Fridge life: **3–4 days** for most cooked foods\n• Freeze leftovers for up to **2–3 months**\n• Reheat to **165°F (74°C)** to kill bacteria\n• Never reheat food more than once!` },

    // Freezing
    { patterns: ['freeze', 'freezer', 'freezing', 'frozen', 'can i freeze'],
      response: () => `❄️ **Freezer Tips:**\n• Most foods can be frozen! Key exceptions: lettuce, cucumbers, raw potatoes\n• Label everything with the **date and contents**\n• Keep freezer at **0°F (-18°C)** or below\n• **FIFO rule:** First In, First Out — use oldest items first\n• Freezer burn is safe to eat but affects quality — trim it off` },

    // Expiry dates
    { patterns: ['expiry', 'expiry date', 'best before', 'use by', 'sell by', 'expiration'],
      response: () => `📅 **Understanding Expiry Dates:**\n• **Best Before:** Quality guarantee — usually still safe after this date\n• **Use By:** Safety deadline — don't consume after this date\n• **Sell By:** For retailers — food is still good for a few days after\n• Use your senses: if it smells, looks, or tastes off — throw it out\n• FreshGuard helps you track these dates automatically! 🎯` },

    // Waste reduction
    { patterns: ['waste', 'food waste', 'reduce waste', 'save food', 'eco', 'sustainability', 'compost'],
      response: () => `♻️ **Reducing Food Waste:**\n• Plan meals before shopping — buy only what you need\n• Use the **FIFO method** (oldest items first)\n• Store food properly to extend its life\n• Freeze before it expires\n• Compost scraps that can't be saved\n• FreshGuard's waste log helps you track your eco progress! 🌱` },

    // Recipe suggestions
    { patterns: ['recipe', 'recipes', 'cook', 'what to cook', 'meal', 'dinner', 'lunch', 'food idea', 'suggestion'],
      response: () => `🍳 **Recipe Ideas:**\nCheck out the **Smart Recipes** tab in FreshGuard! It automatically suggests meals based on your expiring ingredients.\n\nSome quick ideas:\n• **Stir-fry** — great for using up vegetables and leftovers\n• **Soup** — perfect for wilting veggies and meat scraps\n• **Smoothie** — use up ripe fruits and yogurt\n• **Omelette** — eggs + any vegetables = a great meal!` },

    // Password reset
    { patterns: ['password', 'forgot password', 'reset password', 'cant login', 'locked out', 'access', 'account'],
      response: () => `🔑 **Password / Account Help:**\nIf you've forgotten your password:\n1. Click **"Forgot password?"** on the login page\n2. Enter your username to generate a reset request\n3. Copy the message and send it to the admin\n4. The admin will generate a reset link and send it to you\n5. Click the link to set a new password\n\nThe admin will be automatically notified if multiple failed login attempts are detected!` },

    // Pantry organization
    { patterns: ['pantry', 'organize', 'organize pantry', 'storage tips', 'kitchen organization'],
      response: () => `🗄️ **Pantry Organization Tips:**\n• **FIFO Rule:** Put new items at the back, old items in front\n• **Clear containers** help you see what you have at a glance\n• Group by category: grains, canned goods, snacks, etc.\n• Keep a magnetic notepad on the fridge for low-stock alerts\n• Use FreshGuard's Pantry Grid view to track everything digitally!` },

    // Chatbot identity
    { patterns: ['who are you', 'what are you', 'are you ai', 'are you a bot', 'chatbot', 'bot'],
      response: () => `🤖 I'm **FreshGuard AI**, your built-in smart pantry assistant! I'm powered by a food-domain knowledge engine designed to help you:\n• Reduce food waste\n• Store food safely\n• Find recipes from expiring ingredients\n• Manage your account\n\nI'm always learning. Ask me anything food-related!` },

    // Thank you
    { patterns: ['thank', 'thanks', 'thank you', 'cheers', 'great', 'awesome', 'perfect', 'helpful'],
      response: () => `You're welcome! 😊 I'm happy to help. Remember, FreshGuard is here to help you keep your kitchen fresh and reduce waste. Is there anything else you'd like to know?` },
];

function getChatbotResponse(message, username) {
    const lower = message.toLowerCase().trim();
    
    for (const entry of CHATBOT_KNOWLEDGE) {
        if (entry.patterns.some(p => lower.includes(p))) {
            const reply = entry.response(username || 'there');
            return reply;
        }
    }

    // Fallback
    return `🤔 I'm not sure about that specific topic, but I can help with:\n\n• Food storage and expiry tips\n• Recipe suggestions\n• Waste reduction advice\n• Account / password help\n\nTry asking something like: *"How long does chicken last?"* or *"How do I reduce food waste?"*`;
}

// ---------------------------------------------------------------------------
// Google Gemini AI Setup
// ---------------------------------------------------------------------------

let geminiModel = null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your-api-key-here') {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        geminiModel = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction: `You are FreshGuard AI, a friendly and knowledgeable smart pantry assistant built into the FreshGuard food expiry tracking app.

Your expertise includes:
- Food storage tips and best practices
- How long different foods last (fridge, freezer, room temperature)
- Understanding expiry dates (best before, use by, sell by)
- Recipe ideas and suggestions, especially for using up expiring ingredients
- Reducing food waste and sustainability tips
- Kitchen organization and pantry management
- The FreshGuard app features (pantry grid, waste log, smart recipes, categories)

Personality and style:
- Friendly, warm, and helpful
- Use emojis naturally (but not excessively)
- Use **bold** markdown for emphasis on important info
- Use bullet points (•) for lists
- Keep answers concise but informative (aim for 2-4 short paragraphs max)
- If asked about non-food topics, politely redirect: "I'm a food and pantry specialist! I'd love to help you with food storage, recipes, or waste reduction instead. 😊"
- Always be encouraging about reducing food waste

IMPORTANT: You are part of the FreshGuard web application. When relevant, mention app features like the Pantry Grid, Waste Log, Smart Recipes tab, and Categories view.`,
        });
        console.log('✅ Gemini AI initialized successfully — chatbot is AI-powered!');
    } catch (err) {
        console.warn('⚠️  Failed to initialize Gemini AI:', err.message);
        console.warn('   Chatbot will use keyword-matching fallback.');
    }
} else {
    console.log('ℹ️  No GEMINI_API_KEY set — chatbot using keyword-matching fallback.');
    console.log('   Get a free key at: https://aistudio.google.com/apikey');
}

// Per-user conversation history (in-memory, max 10 turns)
const chatHistories = new Map();
const MAX_HISTORY = 10;

function getUserHistory(username) {
    if (!chatHistories.has(username)) {
        chatHistories.set(username, []);
    }
    return chatHistories.get(username);
}

function addToHistory(username, role, text) {
    const history = getUserHistory(username);
    history.push({ role, parts: [{ text }] });
    // Keep only last MAX_HISTORY turns (each turn = user + model = 2 entries)
    while (history.length > MAX_HISTORY * 2) {
        history.shift();
    }
}

// Simple per-user rate limiter (15 req/min to stay within Gemini free tier)
const rateLimits = new Map();
function checkRateLimit(username) {
    const now = Date.now();
    if (!rateLimits.has(username)) {
        rateLimits.set(username, []);
    }
    const timestamps = rateLimits.get(username);
    // Remove entries older than 1 minute
    while (timestamps.length > 0 && timestamps[0] < now - 60000) {
        timestamps.shift();
    }
    if (timestamps.length >= 15) {
        return false; // Rate limited
    }
    timestamps.push(now);
    return true;
}

app.post('/api/chatbot', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 500) {
        return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    const username = req.user.username;

    try {
        // Try Gemini AI first
        if (geminiModel) {
            if (!checkRateLimit(username)) {
                return res.json({ reply: '⏳ You\'re sending messages too fast! Please wait a moment and try again. (Limit: 15 messages per minute)' });
            }

            try {
                const history = getUserHistory(username);
                const chat = geminiModel.startChat({ history });
                const result = await chat.sendMessage(message);
                const reply = result.response.text();

                // Save to history
                addToHistory(username, 'user', message);
                addToHistory(username, 'model', reply);

                return res.json({ reply });
            } catch (aiErr) {
                console.warn('Gemini API error, falling back to keyword matcher:', aiErr.message);
                // Fall through to keyword matcher below
            }
        }

        // Fallback: keyword-matching chatbot
        const reply = getChatbotResponse(message, username);
        res.json({ reply });
    } catch (err) {
        res.status(500).json({ error: 'Chatbot error: ' + err.message });
    }
});


// ---------------------------------------------------------------------------
// STATIC FILES & SPA FALLBACK
// ---------------------------------------------------------------------------

app.use(express.static(__dirname));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`FreshGuard server running at http://localhost:${PORT}`);
});
