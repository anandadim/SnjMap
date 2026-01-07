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

- **Frontend**: Vue 3, Leaflet.js (Local libraries)
- **Backend**: Node.js, Express
- **Data**: JSON file (mudah di-upgrade ke database)
- **Map**: OpenStreetMap tiles (Online)
- **Deployment**: Hybrid offline-ready approach

## Offline Capability

**Hybrid Approach:**
- ✅ Vue.js & Leaflet libraries: Local (tidak butuh internet)
- ✅ App functionality: 100% offline setelah libraries loaded
- 🌐 Map tiles: Online (auto-cached di browser)
- 📱 Progressive caching untuk performa optimal

**Keuntungan:**
- Startup cepat tanpa CDN delay
- Reliable di network internal
- Map tetap interaktif dengan tiles online
- Auto-cache tiles setelah pertama kali akses

## Instalasi

1. Clone atau download project ini
2. Install dependencies:
   ```bash
   npm install
   ```

3. Jalankan server:
   ```bash
   npm run dev
   ```

4. Buka browser:
   - Map: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

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
│   └── locations.json     # Store data
└── server.js             # Express API server
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