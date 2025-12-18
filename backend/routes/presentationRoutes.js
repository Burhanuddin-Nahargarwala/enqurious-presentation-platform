// backend/routes/presentationRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const unzipper = require('unzipper');
const fs = require('fs');  // Regular fs module
const fsPromises = require('fs').promises;  // Promise-based fs module
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const Presentation = require('../models/Presentation');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Ensure we target backend/uploads/temp (one level up from routes)
        const tempDir = path.join(__dirname, '..', 'uploads', 'temp');
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
        } catch (e) {
            cb(e, tempDir);
        }
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (
            file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed' ||
            (file.mimetype && file.mimetype.startsWith('image/'))
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only .zip files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB limit (zip + optional image)
    }
});

// @route   POST /api/presentations/upload
// @desc    Upload a new presentation
// @access  Private
router.post('/upload', authMiddleware, upload.fields([
    { name: 'presentation', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
]), async (req, res) => {
    try {
        const presFiles = req.files && req.files.presentation;
        if (!presFiles || !presFiles[0]) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { title, description, domain } = req.body;
        const userId = req.user.id;

        // Create a unique folder for the presentation
        const presentationId = `presentation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const uploadsRootFs = path.join(__dirname, '..', 'uploads');
        const presentationDirFs = path.join(uploadsRootFs, presentationId);

        // Create the directory
        await fsPromises.mkdir(presentationDirFs, { recursive: true });

        // Extract the zip file
        const zipPath = presFiles[0].path;
        const thumbFile = req.files && req.files.thumbnail && req.files.thumbnail[0];

        // Read manifest directly from the ZIP (to get order and subfolder)
        let manifestSlidesFromZip = null;
        let manifestSubdirInZip = '';
        try {
            const directory = await unzipper.Open.file(zipPath);
            // Prefer a top-level manifest, else the first manifest found
            let manifestEntry = directory.files.find(f => f.path === 'manifest.json');
            if (!manifestEntry) {
                manifestEntry = directory.files.find(f => f.path.toLowerCase().endsWith('/manifest.json'))
                    || directory.files.find(f => path.posix.basename(f.path).toLowerCase() === 'manifest.json');
            }
            if (manifestEntry) {
                const buf = await manifestEntry.buffer();
                const manifest = JSON.parse(buf.toString('utf8'));
                if (Array.isArray(manifest.slides) && manifest.slides.length > 0) {
                    manifestSlidesFromZip = manifest.slides;
                    const dirName = path.posix.dirname(manifestEntry.path);
                    manifestSubdirInZip = (dirName && dirName !== '.') ? dirName : '';
                }
            }
        } catch (e) {
            // If we can't read from zip, proceed with extraction and fallback
        }

        // Extract the ZIP deterministically: write each entry to disk
        const zipDir = await unzipper.Open.file(zipPath);
        for (const entry of zipDir.files) {
            if (entry.type !== 'File') continue;
            // Normalize POSIX path, prevent path traversal
            const posixPath = entry.path;
            if (posixPath.includes('..')) continue;
            const parts = posixPath.split('/').filter(Boolean);
            const destPath = path.join(presentationDirFs, ...parts);
            const destDir = path.dirname(destPath);
            await fsPromises.mkdir(destDir, { recursive: true });
            await new Promise((resolve, reject) => {
                entry.stream()
                    .pipe(fs.createWriteStream(destPath))
                    .on('error', reject)
                    .on('finish', resolve)
                    .on('close', resolve);
            });
        }

        // Remove the temporary zip file
        await fsPromises.unlink(zipPath);

        // Determine the base directory that actually contains slides (filesystem path)
        let baseDirFs = presentationDirFs;
        if (manifestSubdirInZip) {
            // Convert posix subdir to native path
            const parts = manifestSubdirInZip.split('/').filter(Boolean);
            baseDirFs = path.join(presentationDirFs, ...parts);
        }

        let slides = null;
        if (manifestSlidesFromZip) {
            // Trust manifest order as source of truth
            slides = manifestSlidesFromZip.slice();
        } else {
            // Fallback path: look for manifest within extracted directories
            const tryReadManifestSlides = async (dir) => {
                try {
                    const data = await fsPromises.readFile(path.join(dir, 'manifest.json'), 'utf8');
                    const manifest = JSON.parse(data);
                    if (Array.isArray(manifest.slides) && manifest.slides.length > 0) {
                        return manifest.slides;
                    }
                    return null;
                } catch (e) {
                    return null;
                }
            };

            slides = await tryReadManifestSlides(baseDirFs);
            if (!slides) {
                try {
                    const entries = await fsPromises.readdir(baseDirFs, { withFileTypes: true });
                    const subdirs = entries.filter((e) => e.isDirectory());
                    if (subdirs.length === 1) {
                        baseDirFs = path.join(baseDirFs, subdirs[0].name);
                        slides = await tryReadManifestSlides(baseDirFs);
                    }
                } catch (e) {
                    // ignore and fallback to listing
                }
            }
            if (!slides) {
                const files = await fsPromises.readdir(baseDirFs);
                slides = files.filter((file) => file.toLowerCase().endsWith('.html')).sort();
            }
        }

        // Move optional thumbnail into presentation root and compute web path
        let thumbnailPathWeb = '';
        if (thumbFile) {
            try {
                const ext = path.extname(thumbFile.originalname) || path.extname(thumbFile.filename) || '.png';
                const destThumbFs = path.join(presentationDirFs, `thumbnail${ext}`);
                await fsPromises.rename(thumbFile.path, destThumbFs);
                const posixThumb = path.posix.join('/uploads', presentationId, `thumbnail${ext}`);
                thumbnailPathWeb = posixThumb;
            } catch (e) {
                console.error('Failed to move thumbnail:', e);
            }
        }

        // Create a new presentation document
        const newPresentation = new Presentation({
            title,
            description,
            domain,
            user: userId,
            // Save the web path that contains the slides (for static serving)
            folderPath: (function computeWebPath() {
                // Build POSIX path under /uploads for URLs
                let webPath = path.posix.join('uploads', presentationId);
                if (manifestSubdirInZip) {
                    webPath = path.posix.join(webPath, manifestSubdirInZip);
                }
                return webPath;
            })(),
            slides,
            thumbnailPath: thumbnailPathWeb || undefined,
        });

        await newPresentation.save();

        res.status(201).json({
            message: 'Presentation uploaded successfully',
            presentation: newPresentation,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/presentations/create
// @desc    Create a new empty presentation
// @access  Private
router.post('/create', authMiddleware, upload.single('thumbnail'), async (req, res) => {
    try {
        const { title, description, domain } = req.body;
        const userId = req.user.id;
        const thumbFile = req.file;

        // Create a unique folder for the presentation
        const presentationId = `presentation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const uploadsRootFs = path.join(__dirname, '..', 'uploads');
        const presentationDirFs = path.join(uploadsRootFs, presentationId);

        // Create the directory
        await fsPromises.mkdir(presentationDirFs, { recursive: true });

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

        await fsPromises.writeFile(path.join(presentationDirFs, 'index.html'), defaultHtml);

        // Handle thumbnail if uploaded
        let thumbnailPathWeb = '';
        if (thumbFile) {
            try {
                const ext = path.extname(thumbFile.originalname) || path.extname(thumbFile.filename) || '.png';
                const destThumbFs = path.join(presentationDirFs, `thumbnail${ext}`);
                await fsPromises.rename(thumbFile.path, destThumbFs);
                const posixThumb = path.posix.join('/uploads', presentationId, `thumbnail${ext}`);
                thumbnailPathWeb = posixThumb;
            } catch (e) {
                console.error('Failed to move thumbnail:', e);
            }
        }

        // Create a new presentation document
        const newPresentation = new Presentation({
            title,
            description,
            domain,
            user: userId,
            folderPath: path.posix.join('uploads', presentationId),
            slides: ['index.html'],
            thumbnailPath: thumbnailPathWeb || undefined,
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

// backend/routes/presentationRoutes.js
// @route   GET /api/presentations
// @desc    Get all presentations
// @access  Private
router.get('/', async (req, res) => {
    try {
        const presentations = await Presentation.find({})
            .populate('user', 'name email') // Populate user details
            .sort({ createdAt: -1 }); // Sort by newest first
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
        // Unique domains directly from Presentation collection
        const domains = await Presentation.distinct('domain');

        // Unique authors via aggregation to get user names
        const authorsAgg = await Presentation.aggregate([
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

        // Note: We intentionally do not restrict by owner here so anyone can present
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
        const { title, description, domain } = req.body;
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
            { title, description, domain },
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

        // Check if presentation exists and belongs to the user
        if (!presentation || presentation.user.toString() !== req.user.id) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Delete the presentation folder from the file system
        const folderPath = path.join(__dirname, '..', presentation.folderPath);

        // Use rm with recursive: true (Node 14+) for robust deletion
        try {
            await fsPromises.rm(folderPath, { recursive: true, force: true });
        } catch (e) {
            console.error('Error deleting folder:', e);
            // Continue to delete from DB even if folder deletion fails (or doesn't exist)
        }

        // Delete the presentation from the database
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

        // Public access: allow anyone to list files
        // if (presentation.user.toString() !== req.user.id) {
        //     return res.status(401).json({ message: 'User not authorized' });
        // }

        const folderPath = path.join(__dirname, '..', presentation.folderPath);

        // Recursive function to get all files
        async function getFiles(dir) {
            const dirents = await fsPromises.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(dirents.map((dirent) => {
                const res = path.resolve(dir, dirent.name);
                if (dirent.isDirectory()) {
                    return getFiles(res);
                } else {
                    return path.relative(folderPath, res);
                }
            }));
            return Array.prototype.concat(...files);
        }

        const files = await getFiles(folderPath);
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

        // Normalize filename (remove leading slashes) and decode
        const filename = decodeURIComponent(filenameParam.replace(/^\/+/, ''));

        const presentation = await Presentation.findById(presentationId);

        if (!presentation) {
            return res.status(404).json({ message: 'Presentation not found' });
        }

        // Public access: allow anyone to read files
        // if (presentation.user.toString() !== req.user.id) {
        //     return res.status(401).json({ message: 'User not authorized' });
        // }

        const folderPath = path.join(__dirname, '..', presentation.folderPath);
        const filePath = path.join(folderPath, filename);

        // Security check: ensure file is within presentation folder
        if (!filePath.startsWith(folderPath)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Check if file exists
        try {
            await fsPromises.access(filePath);
        } catch (e) {
            return res.status(404).json({ message: 'File not found' });
        }

        const content = await fsPromises.readFile(filePath, 'utf8');
        res.json({ content });
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

        // Normalize filename and decode
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

        const folderPath = path.join(__dirname, '..', presentation.folderPath);
        const filePath = path.join(folderPath, filename);

        // Security check
        if (!filePath.startsWith(folderPath)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await fsPromises.writeFile(filePath, content, 'utf8');
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

        // Basic validation for filename
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ message: 'Invalid filename' });
        }

        const folderPath = path.join(__dirname, '..', presentation.folderPath);
        const filePath = path.join(folderPath, filename);

        // Check if file already exists
        try {
            await fsPromises.access(filePath);
            return res.status(400).json({ message: 'File already exists' });
        } catch (e) {
            // File does not exist, proceed
        }

        await fsPromises.writeFile(filePath, content || '', 'utf8');

        // Update slides list if it's an HTML file
        if (filename.toLowerCase().endsWith('.html') && !presentation.slides.includes(filename)) {
            presentation.slides.push(filename);
            presentation.slides.sort(); // Optional: keep sorted
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

        const folderPath = path.join(__dirname, '..', presentation.folderPath);
        const filePath = path.join(folderPath, filename);

        if (!filePath.startsWith(folderPath)) {
            return res.status(403).json({ message: 'Access denied' });
        }

        try {
            await fsPromises.unlink(filePath);
        } catch (e) {
            console.warn('File not found on disk, but removing from DB:', filename);
        }

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
