const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 5100;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/icons/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'icon-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve static files
app.use('/admin', express.static('admin'));
app.use('/uploads', express.static('public/uploads'));

// Upload icon endpoint
app.post('/api/upload-icon', upload.single('icon'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({ 
      filename: req.file.filename,
      path: `/uploads/icons/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload icon' });
  }
});

// Delete icon endpoint
app.delete('/api/delete-icon/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'public/uploads/icons', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'Icon deleted successfully' });
    } else {
      res.status(404).json({ error: 'Icon not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete icon' });
  }
});

// API Routes
app.get('/api/locations', (req, res) => {
  try {
    const data = fs.readFileSync('./data/locations.json', 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ error: 'Failed to read locations data' });
  }
});

app.post('/api/locations', (req, res) => {
  try {
    const data = fs.readFileSync('./data/locations.json', 'utf8');
    const locations = JSON.parse(data);
    
    const newLocation = {
      id: Date.now(),
      ...req.body
    };
    
    locations.locations.push(newLocation);
    
    fs.writeFileSync('./data/locations.json', JSON.stringify(locations, null, 2));
    res.json(newLocation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save location' });
  }
});

app.put('/api/locations/:id', (req, res) => {
  try {
    const data = fs.readFileSync('./data/locations.json', 'utf8');
    const locations = JSON.parse(data);
    
    const locationIndex = locations.locations.findIndex(loc => loc.id == req.params.id);
    if (locationIndex === -1) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    locations.locations[locationIndex] = { ...locations.locations[locationIndex], ...req.body };
    
    fs.writeFileSync('./data/locations.json', JSON.stringify(locations, null, 2));
    res.json(locations.locations[locationIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});

app.delete('/api/locations/:id', (req, res) => {
  try {
    const data = fs.readFileSync('./data/locations.json', 'utf8');
    const locations = JSON.parse(data);
    
    locations.locations = locations.locations.filter(loc => loc.id != req.params.id);
    
    fs.writeFileSync('./data/locations.json', JSON.stringify(locations, null, 2));
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});