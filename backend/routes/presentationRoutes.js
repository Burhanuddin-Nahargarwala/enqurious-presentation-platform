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

// backend/routes/presentationRoutes.js
// @route   GET /api/presentations
// @desc    Get all presentations
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
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
router.get('/filters', authMiddleware, async (req, res) => {
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
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const presentation = await Presentation.findById(req.params.id);

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
        await fsPromises.rmdir(folderPath, { recursive: true });

        // Delete the presentation from the database
        await Presentation.deleteOne({ _id: req.params.id });

        res.json({ message: 'Presentation deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
