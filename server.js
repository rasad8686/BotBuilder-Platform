require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/bots', require('./routes/bots'));
app.use('/api/bots', require('./routes/messages'));

app.get('/', (req, res) => {
  res.json({ message: 'BotBuilder API is running' });
});

pool.connect()
  .then(() => console.log('Database: Connected'))
  .catch(err => console.error('Database connection error:', err));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});