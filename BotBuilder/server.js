require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-12345';

// Middleware
app.use(cors());
app.use(express.json());

// ============================================
// IN-MEMORY DATA STORAGE (No Database!)
// ============================================
let users = [];
let bots = [];
let userIdCounter = 1;
let botIdCounter = 1;

console.log('✅ Using in-memory storage (no database required)');

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ============================================
// ROUTES
// ============================================

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🚀 BotBuilder API v2.1',
    status: 'live',
    mode: 'in-memory',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: {
        register: 'POST /auth/register',
        login: 'POST /auth/login'
      },
      bots: {
        getAll: 'GET /bots',
        create: 'POST /bots',
        delete: 'DELETE /bots/:id'
      }
    }
  });
});

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      id: userIdCounter++,
      name,
      email,
      password: hashedPassword,
      created_at: new Date().toISOString()
    };

    users.push(newUser);

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ User registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`✅ User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// BOT ROUTES (Protected)
// ============================================

// Get all bots for logged-in user
app.get('/bots', authenticateToken, async (req, res) => {
  try {
    const userBots = bots.filter(bot => bot.user_id === req.user.id);
    
    console.log(`✅ Fetched ${userBots.length} bots for user ${req.user.id}`);

    res.json({
      success: true,
      bots: userBots
    });
  } catch (error) {
    console.error('Get bots error:', error);
    res.status(500).json({ error: 'Failed to fetch bots' });
  }
});

// Create new bot
app.post('/bots', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Bot name is required' });
    }

    // Create bot
    const newBot = {
      id: botIdCounter++,
      name,
      description: description || '',
      user_id: req.user.id,
      created_at: new Date().toISOString()
    };

    bots.push(newBot);

    console.log(`🤖 Bot created: "${name}" by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      message: 'Bot created successfully',
      bot: newBot
    });
  } catch (error) {
    console.error('Create bot error:', error);
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Delete bot
app.delete('/bots/:id', authenticateToken, async (req, res) => {
  try {
    const botId = parseInt(req.params.id);

    // Check if bot belongs to user
    const botIndex = bots.findIndex(
      bot => bot.id === botId && bot.user_id === req.user.id
    );

    if (botIndex === -1) {
      return res.status(404).json({ error: 'Bot not found' });
    }

    // Delete bot
    const deletedBot = bots.splice(botIndex, 1)[0];

    console.log(`🗑️  Bot deleted: "${deletedBot.name}" by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Bot deleted successfully'
    });
  } catch (error) {
    console.error('Delete bot error:', error);
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🤖 BotBuilder Backend Server           ║
║   ✅ Server running on port ${PORT}        ║
║   📡 Mode: IN-MEMORY (No Database)       ║
║   🔐 JWT Auth enabled                    ║
║   💾 Data stored in memory               ║
╚═══════════════════════════════════════════╝
  `);
  console.log('⚠️  Note: All data will be lost when server stops!');
  console.log('🚀 Ready for testing SUCCESS NOTIFICATION!\n');
});