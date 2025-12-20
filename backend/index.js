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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
// Make uploads directory static (Legacy/Fallback)
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// S3 Proxy Route for serving files
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

app.get(/^\/uploads\/(.+)/, async (req, res) => {
  try {
    const key = req.params[0];

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `uploads/${key}`
    });

    const response = await s3Client.send(command);

    // Set Content-Type
    if (response.ContentType) {
      res.setHeader('Content-Type', response.ContentType);
    } else {
      const contentType = mime.lookup(key) || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
    }

    // Pipe S3 stream to response
    response.Body.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey') {
      console.error(`File not found in S3: uploads/${req.params[0]}`);
      return res.status(404).send('File not found');
    }
    console.error('S3 Proxy Error:', err);
    res.status(500).send('Error fetching file');
  }
});

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/presentations', require('./routes/presentationRoutes'));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'API is running...' });
});

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
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT} `));

// Fix for Render 502 Bad Gateway errors (Keep-Alive Timeout)
// Render's load balancer defaults to 60s, so Node must be higher.
server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
