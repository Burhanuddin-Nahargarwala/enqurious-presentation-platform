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
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173', // Allow only your frontend origin
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

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
