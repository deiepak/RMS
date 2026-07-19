const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const db = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

app.set('io', io);

app.use(cors());
app.use(express.json());

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Socket handlers
require('./socket/handlers')(io);

// Routes
const expensesRoutes = require('./routes/expenses');
const financialLogRoutes = require('./routes/financial-log');
const ledgerRoutes = require('./routes/ledger');
const stationRoutes = require('./routes/stations');
const settingsRoutes = require('./routes/settings');
const packagesRoutes = require('./routes/packages');
const adventuresRoutes = require('./routes/adventures');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/tables', require('./routes/tables'));
app.use('/api/settings', settingsRoutes);
app.use('/api/employees', require('./routes/employees'));

app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/tv', require('./routes/tv'));
app.use('/api/promos', require('./routes/promos'));
app.use('/api/ledger', ledgerRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/financial-log', financialLogRoutes);
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/assistance', require('./routes/assistance'));
app.use('/api/stations', stationRoutes);
app.use('/api/stock-requests', require('./routes/stock_requests'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/packages', require('./routes/packages'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/adventures', adventuresRoutes);
app.use('/api/social', require('./routes/social'));
app.use('/api/cctv', require('./routes/cctv'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

const PORT = process.env.API_PORT || 3001;

async function startServer() {
  try {
    console.log('Running migrations...');
    await db.migrate.latest();
    console.log('Migrations up to date.');

    console.log('Running seeds...');
    await db.seed.run();
    console.log('Seeds applied.');

    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
      const monitorService = require('./services/cctv/monitorService');
      monitorService.start();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
