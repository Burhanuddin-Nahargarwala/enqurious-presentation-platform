// backend/index.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const cors = require('cors'); // Import cors

// const User = require('./models/User');
// const Presentation = require('./models/Presentation');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Connect to MongoDB

// const User = require('./models/User');
// const Presentation = require('./models/Presentation');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ORIGIN || 'http://localhost:5173';
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Normalize origins by removing trailing slash
    const normalize = (url) => url.replace(/\/$/, '');
    if (normalize(origin) === normalize(allowed)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow cookies to be sent
};

// Middleware
app.use(cors(corsOptions)); // Enable CORS with options
app.use(express.json());

// Ensure uploads and temp directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(uploadsDir, 'temp');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create upload directories:', e);
}

// Make uploads directory static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/presentations', require('./routes/presentationRoutes'));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'API is running...' });
});

// // Test route (remove after testing)
// app.get('/test-models', async (req, res) => {
//     try {
//         // Create a test user
//         const user = new User({
//             name: 'Test User',
//             email: 'test@example.com',
//             password: 'password123'
//         });

//         // Create a test presentation
//         const presentation = new Presentation({
//             title: 'Test Presentation',
//             description: 'A test presentation',
//             user: user._id,
//             folderPath: '/uploads/test123',
//             slides: ['slide1.html', 'slide2.html']
//         });

//         // Save to database
//         await user.save();
//         await presentation.save();

//         res.json({
//             message: 'Models created successfully',
//             user,
//             presentation
//         });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
```javascript
// backend/index.js
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const cors = require('cors'); // Import cors

// const User = require('./models/User');
// const Presentation = require('./models/Presentation');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Connect to MongoDB

// const User = require('./models/User');
// const Presentation = require('./models/Presentation');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = process.env.CORS_ORIGIN || 'http://localhost:5173';
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Normalize origins by removing trailing slash
    const normalize = (url) => url.replace(/\/$/, '');
    if (normalize(origin) === normalize(allowed)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Allow cookies to be sent
};

// Middleware
app.use(cors(corsOptions)); // Enable CORS with options
app.use(express.json());

// Ensure uploads and temp directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(uploadsDir, 'temp');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create upload directories:', e);
}

// Make uploads directory static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/presentations', require('./routes/presentationRoutes'));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'API is running...' });
});

// // Test route (remove after testing)
// app.get('/test-models', async (req, res) => {
//     try {
//         // Create a test user
//         const user = new User({
//             name: 'Test User',
//             email: 'test@example.com',
//             password: 'password123'
//         });

//         // Create a test presentation
//         const presentation = new Presentation({
//             title: 'Test Presentation',
//             description: 'A test presentation',
//             user: user._id,
//             folderPath: '/uploads/test123',
//             slides: ['slide1.html', 'slide2.html']
//         });

//         // Save to database
//         await user.save();
//         await presentation.save();

//         res.json({
//             message: 'Models created successfully',
//             user,
//             presentation
//         });
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// });

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle Unhandled Rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${ PORT } `));

// Fix for Render 502 Bad Gateway errors (Keep-Alive Timeout)
// Render's load balancer defaults to 60s, so Node must be higher.
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
```
