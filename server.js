const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const { Readable } = require('stream');

const app = express();
const PORT = process.env.PORT || 5100;

// Configure multer for CSV uploads
const csvStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/temp/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadFile = multer({ 
  storage: csvStorage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

// Bulk import from CSV or Excel endpoint
app.post('/api/locations/bulk-import', uploadFile.single('file'), async (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting bulk import...`);
  console.log(`[${new Date().toISOString()}] File: ${req.file.originalname} (${req.file.size} bytes)`);

  try {
    if (!req.file) {
      console.error(`[${new Date().toISOString()}] No file uploaded`);
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    const stats = {
      added: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    let csvData = [];
    const ext = path.extname(req.file.originalname).toLowerCase();

    console.log(`[${new Date().toISOString()}] File extension: ${ext}`);
    console.log(`[${new Date().toISOString()}] Parsing file...`);

    // Parse file based on extension
    if (ext === '.csv') {
      // Parse CSV
      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(req.file.path);
        stream
          .pipe(csv())
          .on('data', (row) => {
            csvData.push(row);
          })
          .on('end', () => {
            console.log(`[${new Date().toISOString()}] CSV parsed successfully: ${csvData.length} rows`);
            resolve();
          })
          .on('error', (error) => {
            console.error(`[${new Date().toISOString()}] CSV parsing error:`, error);
            reject(error);
          });
      });
    } else if (ext === '.xlsx' || ext === '.xls') {
      // Parse Excel file
      console.log(`[${new Date().toISOString()}] Parsing Excel file...`);
      const workbook = xlsx.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      csvData = xlsx.utils.sheet_to_json(sheet);
      console.log(`[${new Date().toISOString()}] Excel parsed successfully: ${csvData.length} rows`);
    } else {
      console.error(`[${new Date().toISOString()}] Unsupported file format: ${ext}`);
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    console.log(`[${new Date().toISOString()}] Reading existing locations...`);
    // Read existing locations
    const data = fs.readFileSync('./data/locations.json', 'utf8');
    const locations = JSON.parse(data);
    const existingLocations = locations.locations || [];
    console.log(`[${new Date().toISOString()}] Existing locations: ${existingLocations.length}`);

    // Process each row
    console.log(`[${new Date().toISOString()}] Processing ${csvData.length} rows...`);
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const progress = Math.round(((i + 1) / csvData.length) * 100);
      
      if (i % 5 === 0 || i === csvData.length - 1) {
        console.log(`[${new Date().toISOString()}] Progress: ${progress}% (${i + 1}/${csvData.length}) - Added: ${stats.added}, Updated: ${stats.updated}, Skipped: ${stats.skipped}, Errors: ${stats.errors.length}`);
      }

      try {
        // Skip empty rows
        if (!row.TDN || !row.latitude || !row.longitude) {
          stats.errors.push(`Missing required fields: ${JSON.stringify(row)}`);
          continue;
        }

        const rawStatus = row.Status ? String(row.Status).trim().toLowerCase() : '';
        const stage =
          rawStatus === 'active' ? 'operational' :
          rawStatus === 'on-survey' ? 'survey' :
          rawStatus === 'development' ? 'build' :
          rawStatus === 'permit' ? 'permit' :
          'survey';

        const stageColorMap = {
          survey: '#3388ff',
          build: '#fd7e14',
          permit: '#ffc107',
          operational: '#28a745'
        };

        const rawIcon = row.Icon ? String(row.Icon).trim() : '';
        const marker = stage !== 'operational'
          ? { type: 'color', color: stageColorMap[stage] || '#3388ff', icon: '' }
          : (rawIcon
            ? { type: 'icon', color: '#3388ff', icon: rawIcon }
            : { type: 'default', color: '#3388ff', icon: '' });

        const newLocation = {
          id: Date.now() + Math.random(),
          name: row.TDN.trim(),
          address: row.Alamat ? row.Alamat.trim() : '',
          lat: parseFloat(row.latitude),
          lng: parseFloat(row.longitude),
          marker,
          businesses: [
            {
              name: row.TDN.trim(),
              category: 'Toko Daging Nusantara',
              phone: 'Tidak tersedia',
              description: `Toko Daging Nusantara - ${row.TDN.trim()}`,
              active: true
            }
          ],
          stage
        };

        // Check if location already exists (by name and coordinates)
        const existingIndex = existingLocations.findIndex(loc => {
          return loc.name.toLowerCase() === newLocation.name.toLowerCase() &&
                 Math.abs(loc.lat - newLocation.lat) < 0.0001 &&
                 Math.abs(loc.lng - newLocation.lng) < 0.0001;
        });

        if (existingIndex !== -1) {
          // Location exists, check if data is different
          const existing = existingLocations[existingIndex];
          const isSame = 
            existing.address === newLocation.address &&
            (existing.marker?.type || 'default') === (newLocation.marker?.type || 'default') &&
            (existing.marker?.color || '#3388ff') === (newLocation.marker?.color || '#3388ff') &&
            (existing.marker?.icon || '') === (newLocation.marker?.icon || '') &&
            existing.stage === newLocation.stage;

          if (isSame) {
            stats.skipped++;
          } else {
            // Update existing location
            const updated = {
              ...existing,
              address: newLocation.address,
              marker: newLocation.marker,
              stage: newLocation.stage
            };

            existingLocations[existingIndex] = updated;
            stats.updated++;
          }
        } else {
          // New location, add it
          existingLocations.push(newLocation);
          stats.added++;
        }
      } catch (error) {
        stats.errors.push(`Error processing row: ${error.message}`);
      }
    }

    console.log(`[${new Date().toISOString()}] Processing complete. Saving data...`);
    // Save updated locations
    locations.locations = existingLocations;
    fs.writeFileSync('./data/locations.json', JSON.stringify(locations, null, 2));
    console.log(`[${new Date().toISOString()}] Data saved successfully`);

    // Clean up temp file
    console.log(`[${new Date().toISOString()}] Cleaning up temp file...`);
    fs.unlinkSync(req.file.path);
    console.log(`[${new Date().toISOString()}] Temp file deleted`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${new Date().toISOString()}] Bulk import completed in ${duration}s`);
    console.log(`[${new Date().toISOString()}] Final stats: Added=${stats.added}, Updated=${stats.updated}, Skipped=${stats.skipped}, Errors=${stats.errors.length}`);

    res.json({
      message: 'Bulk import completed',
      stats,
      total: csvData.length,
      duration
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Bulk import error:`, error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});