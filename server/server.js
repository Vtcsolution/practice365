const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

connectDB().then(() => {
  const { startReminderDispatcher } = require('./utils/reminderDispatcher');
  startReminderDispatcher();
});

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/matters', require('./routes/matters'));
app.use('/api/custom-fields', require('./routes/customFields'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/fixed-charges', require('./routes/fixedCharges'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/audit-log', require('./routes/auditLog'));
app.use('/api/timeline', require('./routes/timeline'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/portal', require('./routes/portal'));
app.use('/api/signatures', require('./routes/signatures'));
app.use('/api/payments', require('./routes/payments'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
