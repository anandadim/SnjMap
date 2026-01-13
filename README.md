# Store Locator

Web aplikasi untuk menampilkan lokasi toko menggunakan peta open source (OpenStreetMap) dengan Vue.js dan Leaflet.

## Fitur

### Map View
- 🗺️ Peta interaktif menggunakan OpenStreetMap
- 📍 Marker untuk setiap lokasi toko dengan customization
- 🎨 Custom marker colors dan icons (PNG/JPG)
- 🔍 Search berdasarkan nama bisnis atau alamat
- 🏷️ Filter berdasarkan kategori bisnis
- 📱 Responsive design
- 💬 Popup dengan informasi detail multiple bisnis per lokasi

### Admin Panel
- ➕ Tambah lokasi baru dengan koordinat
- 🎨 Customize marker dengan warna atau upload icon
- ✏️ Edit informasi lokasi dan bisnis
- 🗑️ Hapus lokasi dan bisnis
- 📊 Kelola multiple bisnis per lokasi
- 🖼️ Upload custom icons (PNG/JPG, max 2MB)
- 🎯 Interface yang user-friendly

## Teknologi

- **Frontend**: Vue 3, Leaflet.js, Leaflet.VectorGrid (Local libraries)
- **Backend**: Node.js, Express
- **Data**: JSON file (mudah di-upgrade ke database)
- **Map**: 
  - **Indonesia Vector Tiles** (Self-hosted, offline-ready)
  - OpenStreetMap tiles (Online fallback)
- **Tile Server**: Custom Express server with @mapbox/mbtiles
- **Deployment**: Hybrid offline-ready approach

## Offline Capability

**Hybrid Approach:**
- ✅ Vue.js & Leaflet libraries: Local (tidak butuh internet)
- ✅ App functionality: 100% offline setelah libraries loaded
- ✅ Indonesia Vector Tiles: Self-hosted (100% offline untuk area Indonesia)
- 🌐 Other map tiles: Online (OSM, CartoDB, Satellite)
- 📱 Progressive caching untuk performa optimal

**Keuntungan:**
- Startup cepat tanpa CDN delay
- Reliable di network internal
- Peta Indonesia 100% offline dengan vector tiles
- Map tetap interaktif dengan tiles online untuk layer lain
- Auto-cache tiles setelah pertama kali akses

## Instalasi

### Prerequisites

- Node.js (v14+)
- Java 21+ (untuk Planetiler)
- Homebrew (untuk macOS dependencies)

### Setup Vector Tiles (Indonesia Only)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Planetiler (Java-based tile generator):**
   ```bash
   # Install Java 21 via Homebrew (macOS)
   brew install openjdk@21
   
   # Download Planetiler
   curl -L -o planetiler.jar https://github.com/onthegomap/planetiler/releases/download/v0.8.0/planetiler.jar
   ```

3. **Download OSM data Indonesia:**
   ```bash
   # Create data directory
   mkdir -p data/sources
   
   # Download Indonesia OSM data (~1.6 GB)
   curl -L -o data/sources/indonesia.osm.pbf https://download.geofabrik.de/asia/indonesia-latest.osm.pbf
   ```

4. **Download additional data sources:**
   ```bash
   # Lake centerlines (~77 MB)
   curl -L -o data/sources/lake_centerline.shp.zip https://dev.maptiler.download/geodata/omt/lake_centerline.shp.zip
   
   # Natural Earth (~413 MB)
   curl -L -o data/sources/natural_earth_vector.sqlite.zip https://dev.maptiler.download/geodata/omt/natural_earth_vector.sqlite.zip
   
   # Water polygons (~866 MB)
   curl -L -o data/sources/water-polygons-split-3857.zip https://osmdata.openstreetmap.de/download/water-polygons-split-3857.zip
   ```

5. **Generate vector tiles:**
   ```bash
   # Set Java path
   export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"
   
   # Generate Indonesia vector tiles (~15-30 minutes)
   java -jar planetiler.jar --area=indonesia --output=data/indonesia.mbtiles --input=data/sources/indonesia.osm.pbf --force
   ```

6. **Install MBTiles dependency:**
   ```bash
   npm install @mapbox/mbtiles
   ```

### Jalankan Server

1. **Start tile server (port 8080):**
   ```bash
   node tileserver.js
   ```

2. **Start main application (port 5100):**
   ```bash
   npm run dev
   ```

3. **Buka browser:**
   - Map: http://localhost:5100
   - Admin Panel: http://localhost:5100/admin
   - Tile Server: http://localhost:8080/tiles/indonesia/metadata

## Struktur Project

```
store-locator/
├── public/
│   ├── libs/              # Local libraries (offline-ready)
│   │   ├── vue.js         # Vue 3 framework
│   │   └── leaflet/       # Leaflet map library + assets
│   ├── index.html         # Main map view
│   └── app.js            # Map functionality
├── admin/
│   ├── index.html         # Admin panel
│   └── admin.js          # Admin functionality
├── data/
│   ├── locations.json     # Store data
│   ├── indonesia.mbtiles  # Indonesia vector tiles (generated)
│   └── sources/           # OSM data sources for tile generation
│       ├── indonesia.osm.pbf
│       ├── lake_centerline.shp.zip
│       ├── natural_earth_vector.sqlite.zip
│       └── water-polygons-split-3857.zip
├── server.js             # Express API server
├── tileserver.js         # Vector tile server (port 8080)
└── planetiler.jar        # Tile generator tool
```

## Struktur Data

Data toko disimpan dalam `data/locations.json`:

```json
{
  "locations": [
    {
      "id": 1,
      "address": "Jl. Sudirman No. 123, Jakarta",
      "lat": -6.2088,
      "lng": 106.8456,
      "marker": {
        "color": "#3388ff",
        "icon": "/uploads/icons/custom-icon.png"
      },
      "businesses": [
        {
          "name": "Toko ABC",
          "category": "Grosir",
          "phone": "021-1234-5678",
          "description": "Deskripsi bisnis"
        }
      ]
    }
  ]
}
```

## Kategori Bisnis

- Grosir
- Toko
- Kedai Steak
- Nusantara Resto

## Penggunaan

### Menambah Data Toko

1. Buka Admin Panel
2. Isi form "Tambah Lokasi Baru"
3. Masukkan alamat dan koordinat (lat, lng)
4. Klik "Tambah Lokasi"
5. Tambahkan bisnis dengan klik "Tambah Bisnis"

### Marker Customization

**Opsi Marker:**
1. **Default** - Marker biru standar Leaflet
2. **Custom Color** - Pilih warna dari color picker
3. **Custom Icon** - Upload file PNG/JPG (max 2MB)

**Cara Customize:**
1. Di Admin Panel, saat tambah/edit lokasi
2. Pilih warna di color picker ATAU upload icon
3. Preview langsung tersedia
4. Icon akan otomatis resize ke 32x32px

### Import Data Existing

Jika sudah ada 29 data toko, bisa langsung edit file `data/locations.json` atau gunakan Admin Panel untuk input satu per satu.

## Development

Project ini siap untuk:
- Upgrade ke database (SQLite/PostgreSQL)
- Tambah fitur routing
- Export/import CSV
- User authentication
- Real-time updates

## Deployment

Untuk deployment lokal:
1. Set NODE_ENV=production
2. Jalankan `npm start`
3. Akses via IP lokal di network

Untuk production deployment, bisa menggunakan PM2 atau Docker.