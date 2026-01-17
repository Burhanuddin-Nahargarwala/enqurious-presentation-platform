// backend/models/Presentation.js
const mongoose = require('mongoose');

const PresentationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  domain: {
    type: String,
    required: [true, 'Please specify a domain'],
    trim: true,
    maxlength: [50, 'Domain cannot exceed 50 characters']
  },
  folderPath: {
    type: String,
    required: [true, 'Folder path is required']
  },
  slides: {
    type: [String],
    required: [true, 'Please add at least one slide'],
    validate: {
      validator: function (slides) {
        return slides.length > 0;
      },
      message: 'A presentation must have at least one slide'
    }
  },
  thumbnailPath: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  views: {
    type: Number,
    default: 0
  },
  visibility: {
    type: String,
    enum: ['public', 'private'],
    default: 'public'
  }
});

module.exports = mongoose.model('Presentation', PresentationSchema);
