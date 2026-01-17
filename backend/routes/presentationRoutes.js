// backend/routes/presentationRoutes.js
// backend/routes/presentationRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const unzipper = require('unzipper');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const Presentation = require('../models/Presentation');
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const mime = require('mime-types');

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Helper: Upload to S3
const uploadToS3 = async (key, body, contentType) => {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType
    });
    return s3Client.send(command);
};

// Helper: Delete from S3 (single object)
const deleteObjectFromS3 = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    return s3Client.send(command);
};

// Helper: Delete folder (prefix) from S3
const deleteFolderFromS3 = async (prefix) => {
    let continuationToken = undefined;
    do {
        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });
        const listResult = await s3Client.send(listCommand);

        if (listResult.Contents && listResult.Contents.length > 0) {
            // Delete objects in batches (using Promise.all for simplicity, or DeleteObjectsCommand for efficiency)
            await Promise.all(listResult.Contents.map(obj => deleteObjectFromS3(obj.Key)));
        }
        continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);
};

// Helper: Get object content from S3
const getObjectContentFromS3 = async (key) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
    });
    const response = await s3Client.send(command);
    // Convert stream to string
    return response.Body.transformToString();
};

// Configure multer for memory storage (we don't want to save to disk anymore)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        console.log('Uploading file:', file.originalname, 'Mimetype:', file.mimetype);
        if (
            file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            file.mimetype === 'application/x-zip' ||
            file.mimetype === 'application/octet-stream' ||
            file.originalname.toLowerCase().endsWith('.zip') ||
            (file.mimetype && file.mimetype.startsWith('image/'))
        ) {
            cb(null, true);
        } else {
            console.error('Rejected file type:', file.mimetype);
            cb(new Error('Only .zip files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    }
});

// @route   POST /api/presentations/upload
// @desc    Upload a new presentation
// @access  Private
router.post('/upload', authMiddleware, (req, res) => {
    const uploadMiddleware = upload.fields([
        { name: 'presentation', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 }
    ]);

    uploadMiddleware(req, res, async (err) => {
        if (err) {
            console.error('Multer Error:', err);
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: `Upload error: ${err.message} ` });
            }
            return res.status(400).json({ message: err.message });
        }

        try {
            console.log('File upload received. Processing...');
            const presFiles = req.files && req.files.presentation;
            if (!presFiles || !presFiles[0]) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const { title, description, domain, visibility } = req.body;
            const userId = req.user.id;

            // Create a unique ID for the presentation
            const presentationId = `presentation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const s3Prefix = `uploads/${presentationId}`; // S3 "folder"

            // Extract the zip file from memory buffer
            const zipBuffer = presFiles[0].buffer;
            const thumbFile = req.files && req.files.thumbnail && req.files.thumbnail[0];

            console.log(`Extracting zip to S3 prefix: ${s3Prefix} `);

            const directory = await unzipper.Open.buffer(zipBuffer);
            const slides = [];
            let manifestSlides = null;
            let manifestSubdir = '';

            // First pass: Look for manifest
            for (const file of directory.files) {
                if (file.path === 'manifest.json' || file.path.endsWith('/manifest.json')) {
                    try {
                        const content = await file.buffer();
                        const manifest = JSON.parse(content.toString());
                        if (Array.isArray(manifest.slides)) {
                            manifestSlides = manifest.slides;
                            const dirName = path.dirname(file.path);
                            manifestSubdir = (dirName && dirName !== '.') ? dirName : '';
                        }
                    } catch (e) {
                        console.warn('Failed to parse manifest:', e);
                    }
                }
            }

            // Upload files to S3
            for (const file of directory.files) {
                if (file.type === 'Directory') continue;

                // Normalize path
                const filePath = file.path;
                const s3Key = `${s3Prefix}/${filePath}`;
                const contentType = mime.lookup(filePath) || 'application/octet-stream';

                const contentBuffer = await file.buffer();
                await uploadToS3(s3Key, contentBuffer, contentType);

                // Collect HTML slides if no manifest found
                if (!manifestSlides && filePath.toLowerCase().endsWith('.html')) {
                    // If we are in a subdirectory, we might need to adjust logic, but for now simple collection
                    slides.push(filePath);
                }
            }

            // Handle thumbnail
            let thumbnailPathWeb = '';
            if (thumbFile) {
                const ext = path.extname(thumbFile.originalname) || '.png';
                const thumbKey = `${s3Prefix}/thumbnail${ext}`;
                await uploadToS3(thumbKey, thumbFile.buffer, thumbFile.mimetype);
                thumbnailPathWeb = thumbKey; // Store S3 Key (or relative path)
            }

            // Determine final slides list
            let finalSlides = [];
            if (manifestSlides) {
                // Adjust manifest slides to include subdir if needed
                finalSlides = manifestSlides.map(s => manifestSubdir ? path.join(manifestSubdir, s).replace(/\\/g, '/') : s);
            } else {
                finalSlides = slides.sort();
            }

            console.log(`Found ${finalSlides.length} slides.`);

            // Create a new presentation document
            const newPresentation = new Presentation({
                title,
                description,
                domain,
                user: userId,
                folderPath: s3Prefix, // Store S3 prefix
                slides: finalSlides,
                thumbnailPath: thumbnailPathWeb || undefined,
                visibility: visibility || 'public'
            });

            console.log('Saving presentation to database...');
            try {
                await newPresentation.save();
                console.log('Presentation saved to DB:', newPresentation._id);
            } catch (saveError) {
                console.error('Database Save Error:', saveError);
                // Clean up S3 if save fails
                await deleteFolderFromS3(s3Prefix).catch(e => console.error('Cleanup error:', e));
                throw new Error(`Database save failed: ${saveError.message}`);
            }

            res.status(201).json({
                message: 'Presentation uploaded successfully',
                presentation: newPresentation,
            });
        } catch (err) {
            console.error('Upload Processing Error:', err);
            res.status(500).json({ message: `Server error: ${err.message}` });
        }
    });
});

// @route   POST /api/presentations/create
// @desc    Create a new empty presentation
// @access  Private
router.post('/create', authMiddleware, upload.single('thumbnail'), async (req, res) => {
    try {
        const { title, description, domain, visibility } = req.body;
        const userId = req.user.id;
        const thumbFile = req.file;

        const presentationId = `presentation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const s3Prefix = `uploads/${presentationId}`;

        // Create a default index.html
        const defaultHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f9ff; color: #0f172a; }
        h1 { font-size: 3rem; margin-bottom: 1rem; }
        p { font-size: 1.5rem; color: #475569; }
    </style>
</head>
<body>
    <div style="text-align: center;">
        <h1>${title}</h1>
        <p>${description || 'Welcome to your new presentation'}</p>
    </div>
</body>
</html>`;

        await uploadToS3(`${s3Prefix}/index.html`, defaultHtml, 'text/html');

        // Handle thumbnail
        let thumbnailPathWeb = '';
        if (thumbFile) {
            const ext = path.extname(thumbFile.originalname) || '.png';
            const thumbKey = `${s3Prefix}/thumbnail${ext}`;
            await uploadToS3(thumbKey, thumbFile.buffer, thumbFile.mimetype);
            thumbnailPathWeb = thumbKey;
        }

        const newPresentation = new Presentation({
            title,
            description,
            domain,
            user: userId,
            folderPath: s3Prefix,
            slides: ['index.html'],
            thumbnailPath: thumbnailPathWeb || undefined,
            visibility: visibility || 'public'
        });

        await newPresentation.save();

        res.status(201).json({
            message: 'Presentation created successfully',
            presentation: newPresentation,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/presentations
// @desc    Get all presentations
// @access  Private
router.get('/', async (req, res) => {
    try {
        const presentations = await Presentation.find({
            $or: [{ visibility: 'public' }, { visibility: { $exists: false } }]
        })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json(presentations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/presentations/my
// @desc    Get logged-in user's presentations
// @access  Private
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const presentations = await Presentation.find({ user: req.user.id })
            .populate('user', 'name email')
            .sort({ createdAt: -1 });
        res.json(presentations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/presentations/filters
// @desc    Get unique domains and authors that have presentations
// @access  Private
router.get('/filters', async (req, res) => {
    try {
        // Unique domains directly from Presentation collection (public only)
        const domains = await Presentation.find({
            $or: [{ visibility: 'public' }, { visibility: { $exists: false } }]
        }).distinct('domain');

        // Unique authors via aggregation to get user names (public only)
        const authorsAgg = await Presentation.aggregate([
            {
                $match: {
                    $or: [{ visibility: 'public' }, { visibility: { $exists: false } }]
                }
            },
            { $group: { _id: '$user' } },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            { $project: { _id: 0, id: '$user._id', name: '$user.name' } },
            { $sort: { name: 1 } }
        ]);

        res.json({
            domains: domains.sort(),
            authors: authorsAgg
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/presentations/:id
// @desc    Get a single presentation by ID (visible to any authenticated user)
// @access  Private
router.get('/:id', async (req, res) => {
    try {
        // Validate ObjectId to prevent CastError if a non-ID (like "upload") is passed
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        const presentation = await Presentation.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        ).populate('user', 'name email');

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Check visibility
        if (presentation.visibility === 'private') {
            // If private, only allow author
            // We need to check if user is authenticated and is the owner
            // Since this route is currently public (no authMiddleware), we need to handle this carefully.
            // Ideally, we should check for a token if present, or require auth for private presentations.

            // For now, let's assume if it's private, we require a token.
            // But wait, the route definition is: router.get('/:id', async (req, res) => {
            // It doesn't have authMiddleware.
            // We need to manually verify token if present, or return 401/403.

            // Let's use a helper or simple check.
            // Actually, the requirement says "Private: Visible only to the author".
            // So we must verify the user.

            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({ message: 'Private presentation. Please log in.' });
            }

            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (presentation.user._id.toString() !== decoded.user.id) {
                    return res.status(403).json({ message: 'Not authorized to view this private presentation' });
                }
            } catch (e) {
                return res.status(401).json({ message: 'Invalid token' });
            }
        }

        res.json(presentation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/presentations/:id
// @desc    Update a presentation
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, description, domain, visibility } = req.body;
        let presentation = await Presentation.findById(req.params.id);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Check user
        if (presentation.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        presentation = await Presentation.findByIdAndUpdate(
            req.params.id,
            { title, description, domain, visibility },
            { new: true, runValidators: true }
        );

        res.json(presentation);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/presentations/:id
// @desc    Delete a presentation and its files
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const presentation = await Presentation.findById(req.params.id);

        if (!presentation || presentation.user.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Delete from S3
        try {
            await deleteFolderFromS3(presentation.folderPath);
        } catch (e) {
            console.error('Error deleting from S3:', e);
            // Continue to delete from DB even if S3 deletion fails (or doesn't exist)
        }

        // Delete from DB
        await Presentation.deleteOne({ _id: req.params.id });

        res.json({ message: 'Presentation deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/presentations/:id/files
// @desc    List all files in a presentation
// @access  Private
router.get('/:id/files', async (req, res) => {
    try {
        const presentation = await Presentation.findById(req.params.id);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Check visibility
        if (presentation.visibility === 'private') {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({ message: 'Private presentation. Please log in.' });
            }
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (presentation.user.toString() !== decoded.user.id) {
                    return res.status(403).json({ message: 'Not authorized' });
                }
            } catch (e) {
                return res.status(401).json({ message: 'Invalid token' });
            }
        }

        const prefix = presentation.folderPath.endsWith('/') ? presentation.folderPath : `${presentation.folderPath}/`;

        const listCommand = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: prefix
        });
        const listResult = await s3Client.send(listCommand);

        const files = listResult.Contents ? listResult.Contents.map(obj => obj.Key.replace(prefix, '')) : [];
        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/presentations/:id/files/:filename
// @desc    Get content of a specific file
// @access  Private
// Using Regex to match /:id/files/:filename+ because of path-to-regexp v8 strictness
router.get(/^\/([^\/]+)\/files\/(.+)$/, async (req, res) => {
    try {
        const presentationId = req.params[0];
        const filenameParam = req.params[1];
        const filename = decodeURIComponent(filenameParam.replace(/^\/+/, ''));

        const presentation = await Presentation.findById(presentationId);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Check visibility
        if (presentation.visibility === 'private') {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) {
                return res.status(401).json({ message: 'Private presentation. Please log in.' });
            }
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (presentation.user.toString() !== decoded.user.id) {
                    return res.status(403).json({ message: 'Not authorized' });
                }
            } catch (e) {
                return res.status(401).json({ message: 'Invalid token' });
            }
        }

        const s3Key = `${presentation.folderPath}/${filename}`;

        try {
            const content = await getObjectContentFromS3(s3Key);
            res.json({ content });
        } catch (e) {
            return res.status(404).json({ message: 'File not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/presentations/:id/files/:filename
// @desc    Update content of a specific file
// @access  Private
router.put(/^\/([^\/]+)\/files\/(.+)$/, authMiddleware, async (req, res) => {
    try {
        const presentationId = req.params[0];
        const filenameParam = req.params[1];
        const filename = decodeURIComponent(filenameParam.replace(/^\/+/, ''));

        const presentation = await Presentation.findById(presentationId);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        if (presentation.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        const { content } = req.body;
        if (content === undefined) {
            return res.status(400).json({ message: 'Content is required' });
        }

        const s3Key = `${presentation.folderPath}/${filename}`;
        const contentType = mime.lookup(filename) || 'text/plain';

        await uploadToS3(s3Key, content, contentType);
        res.json({ message: 'File updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/presentations/:id/files
// @desc    Create a new file in a presentation
// @access  Private
router.post('/:id/files', authMiddleware, async (req, res) => {
    try {
        const presentation = await Presentation.findById(req.params.id);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        if (presentation.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        const { filename, content } = req.body;
        if (!filename) {
            return res.status(400).json({ message: 'Filename is required' });
        }

        // Basic validation
        if (filename.includes('..') || filename.includes('\\')) {
            return res.status(400).json({ message: 'Invalid filename' });
        }

        const s3Key = `${presentation.folderPath}/${filename}`;
        const contentType = mime.lookup(filename) || 'text/plain';

        // Check if exists (optional, S3 overwrites by default which is often fine, but we can check)
        try {
            await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
            return res.status(400).json({ message: 'File already exists' });
        } catch (e) {
            // Not found, proceed
        }

        await uploadToS3(s3Key, content || '', contentType);

        if (filename.toLowerCase().endsWith('.html') && !presentation.slides.includes(filename)) {
            presentation.slides.push(filename);
            presentation.slides.sort();
            await presentation.save();
        }

        res.status(201).json({ message: 'File created successfully', filename });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/presentations/:id/files/:filename
// @desc    Delete a specific file
// @access  Private
router.delete(/^\/([^\/]+)\/files\/(.+)$/, authMiddleware, async (req, res) => {
    try {
        const presentationId = req.params[0];
        const filenameParam = req.params[1];
        // Normalize filename and decode
        const filename = decodeURIComponent(filenameParam.replace(/^\/+/, ''));

        const presentation = await Presentation.findById(presentationId);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        if (presentation.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        const s3Key = `${presentation.folderPath}/${filename}`;
        await deleteObjectFromS3(s3Key);

        // Remove from slides list if it's there
        if (presentation.slides.includes(filename)) {
            presentation.slides = presentation.slides.filter(s => s !== filename);
            await presentation.save();
        }

        res.json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
