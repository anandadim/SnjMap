const { createApp } = Vue;

createApp({
    data() {
        return {
            map: null,
            locations: [],
            filteredLocations: [],
            markers: [],
            searchQuery: '',
            selectedCategory: '',
            categories: [],
            tileLayers: {},
            currentLayer: 'osm',
            isIndonesiaLocked: true,
            indonesiaBounds: [[-11.0, 95.0], [6.0, 141.0]], // Indonesia approximate bounds
            indonesiaMask: null, // Mask overlay layer
            indonesiaGeoJSON: null, // GeoJSON for clipping
            labeledLayer: null, // Layer with labels (clipped to Indonesia)
            cleanLayer: null, // Clean map layer for outside Indonesia
            outsideMaskLayer: null, // Polygon mask covering outside Indonesia
            indonesiaLabelsLayer: null // Custom labels for Indonesia
        }
    },
    
    computed: {
        totalLocations() {
            return this.locations.length;
        },
        
        hasActiveFilters() {
            return this.searchQuery.trim() || this.selectedCategory;
        }
    },
    
    async mounted() {
        await this.loadLocations();
        this.initMap();
        this.extractCategories();
        this.filterLocations();
    },
    
    methods: {
        async loadLocations() {
            try {
                const response = await fetch('/api/locations');
                const data = await response.json();
                this.locations = data.locations || [];
            } catch (error) {
                console.error('Error loading locations:', error);
                this.locations = [];
            }
        },
        
        initMap() {
            // Initialize map centered on Jakarta with bounds and zoom limits
            this.map = L.map('map', {
                center: [-6.2088, 106.8456],
                zoom: 11,
                maxBounds: this.indonesiaBounds,
                maxBoundsViscosity: 1.0,
                minZoom: 5,
                maxZoom: 18
            });

            if (!this.map.getPane('basemap')) {
                this.map.createPane('basemap');
                this.map.getPane('basemap').style.zIndex = 200;
            }

            // Define tile layers - using only stable raster tiles
            this.tileLayers = {
                osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    name: 'OpenStreetMap',
                    pane: 'basemap',
                    maxZoom: 19,
                    crossOrigin: true
                }),
                positron: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    name: 'CartoDB Positron',
                    pane: 'basemap',
                    maxZoom: 20,
                    crossOrigin: true
                }),
                satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: '© Esri © DigitalGlobe © GeoEye © Earthstar Geographics © CNES/Airbus DS © USDA © USGS © AeroGRID © IGN © IGP',
                    name: 'Satellite',
                    pane: 'basemap',
                    maxZoom: 19,
                    crossOrigin: true
                })
            };

            // Set default layer
            this.currentLayer = 'osm';
            this.tileLayers.osm.addTo(this.map);
            
            // Add custom controls
            this.addRecenterControl();
            this.addLayerSwitcher();
            this.addIndonesiaLockControl();
            
            // Add bounds restriction event listeners
            this.map.on('moveend', this.checkBounds);
            this.map.on('zoomend', this.checkBounds);
        },
        
        extractCategories() {
            const categorySet = new Set();
            this.locations.forEach(location => {
                location.businesses.forEach(business => {
                    categorySet.add(business.category);
                });
            });
            this.categories = Array.from(categorySet).sort();
        },
        
        filterLocations() {
            let filtered = this.locations;

            // Filter by search query
            if (this.searchQuery.trim()) {
                const query = this.searchQuery.toLowerCase();
                filtered = filtered.filter(location => {
                    // Search in location name
                    if (location.name && location.name.toLowerCase().includes(query)) {
                        return true;
                    }

                    // Search in address
                    if (location.address.toLowerCase().includes(query)) {
                        return true;
                    }

                    // Search in business names
                    return location.businesses.some(business =>
                        business.name.toLowerCase().includes(query)
                    );
                });
            }

            // Filter by category
            if (this.selectedCategory) {
                filtered = filtered.filter(location => {
                    return location.businesses.some(business =>
                        business.category === this.selectedCategory
                    );
                });
            }

            this.filteredLocations = filtered;
            this.updateMapMarkers();
        },

        getStageTooltipText(location) {
            const stageMap = {
                survey: '🔍 On-Survey',
                build: '🚧 Dalam Pembangunan',
                permit: '📑 Pengurusan Izin',
                operational: '🏢 Beroperasi'
            };
            return stageMap[location.stage] || '';
        },

        getStageMarkerColor(stage) {
            const stageColorMap = {
                survey: '#3388ff',
                build: '#fd7e14',
                permit: '#ffc107',
                operational: '#28a745'
            };
            return stageColorMap[stage] || '#3388ff';
        },

        updateMapMarkers() {
            // Clear existing markers
            this.markers.forEach(marker => {
                this.map.removeLayer(marker);
            });
            this.markers = [];

            // Add markers for filtered locations
            this.filteredLocations.forEach(location => {
                const marker = this.createCustomMarker(location);
                marker.addTo(this.map);

                // Add tooltip with location name (permanent)
                const stageText = this.getStageTooltipText(location);
                const tooltipContent = location.name ? `${location.name}` : '';

                marker.bindTooltip(tooltipContent, {
                    permanent: true,
                    direction: 'bottom',
                    offset: [0, 10],
                    className: 'location-label'
                });

                // Add hover event to show stage tooltip
                marker.on('mouseover', () => {
                    if (stageText) {
                        marker.setTooltipContent(`${location.name}<br><span class="stage-tooltip-text">${stageText}</span>`);
                    }
                });

                marker.on('mouseout', () => {
                    marker.setTooltipContent(tooltipContent);
                });

                // Create popup content
                const popupContent = this.createPopupContent(location);
                marker.bindPopup(popupContent, {
                    maxWidth: 350,
                    className: 'custom-popup'
                });

                this.markers.push(marker);
            });

            // Fit map to show all markers
            if (this.markers.length > 0) {
                const group = new L.featureGroup(this.markers);
                this.map.fitBounds(group.getBounds().pad(0.1));
            }
        },
        
        createCustomMarker(location) {
            const markerOptions = {
                lat: location.lat,
                lng: location.lng
            };

            // Check if all businesses at this location are inactive
            const allBusinessesInactive = location.businesses.length > 0 &&
                location.businesses.every(business => business.active === false);

            // Check if location has custom marker settings
            if (location.marker) {
                // Determine marker type (backward compatibility)
                let markerType = location.marker.type;
                if (!markerType) {
                    if (location.marker.icon) {
                        markerType = 'icon';
                    } else if (location.marker.color && location.marker.color !== '#3388ff') {
                        markerType = 'color';
                    } else {
                        markerType = 'default';
                    }
                }

                if (markerType === 'icon' && location.marker.icon) {
                    // Use custom icon
                    const customIcon = L.icon({
                        iconUrl: location.marker.icon,
                        iconSize: [32, 32],
                        iconAnchor: [16, 32],
                        popupAnchor: [0, -32],
                        shadowUrl: 'libs/leaflet/images/marker-shadow.png',
                        shadowSize: [41, 41],
                        shadowAnchor: [12, 41],
                        className: allBusinessesInactive ? 'custom-icon-inactive' : ''
                    });

                    return L.marker([location.lat, location.lng], { icon: customIcon });
                } else if (markerType === 'color' && location.marker.color) {
                    // Use colored marker (create SVG marker)
                    const coloredIcon = this.createColoredMarker(location.marker.color, allBusinessesInactive);
                    return L.marker([location.lat, location.lng], { icon: coloredIcon });
                }
            }

            // Default marker (blue)
            const stageColor = this.getStageMarkerColor(location.stage);
            const coloredIcon = this.createColoredMarker(stageColor, allBusinessesInactive);
            return L.marker([location.lat, location.lng], { icon: coloredIcon });
        },
        
        createColoredMarker(color, isInactive = false) {
            const svgIcon = `
                <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"
                          fill="${color}" stroke="#fff" stroke-width="2"/>
                    <circle cx="12.5" cy="12.5" r="6" fill="#fff"/>
                </svg>
            `;

            return L.divIcon({
                html: svgIcon,
                iconSize: [25, 41],
                iconAnchor: [12.5, 41],
                popupAnchor: [0, -41],
                className: `custom-colored-marker ${isInactive ? 'custom-icon-inactive' : ''}`
            });
        },
        
        createPopupContent(location) {
            let content = `
                <div class="popup-content">
                    <div class="popup-header">
                        ${location.name ? `🏢 ${location.name}` : '📍 Lokasi'}
                    </div>
                    <div style="font-size: 13px; color: #666; margin-bottom: 10px;">📍 ${location.address}</div>
            `;

            location.businesses.forEach(business => {
                const statusClass = business.active ? 'status-active' : 'status-inactive';
                const statusText = business.active ? '✓ Aktif' : '✗ Non-aktif';
                content += `
                    <div class="business-item ${business.active ? '' : 'business-inactive'}">
                        <div class="business-name">${business.name}</div>
                        <div class="business-status ${statusClass}">${statusText}</div>
                        <div class="business-category">${business.category}</div>
                        <div class="business-phone">📞 ${business.phone}</div>
                        ${business.description ? `<div class="business-description">${business.description}</div>` : ''}
                    </div>
                `;
            });

            content += '</div>';
            return content;
        },
        
        addRecenterControl() {
            // Create custom re-center control
            const RecenterControl = L.Control.extend({
                onAdd: function(map) {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                    
                    container.style.backgroundColor = 'white';
                    container.style.backgroundImage = 'none';
                    container.style.width = '30px';
                    container.style.height = '30px';
                    container.style.cursor = 'pointer';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';
                    container.style.fontSize = '16px';
                    container.innerHTML = '🎯';
                    container.title = 'Re-center Map (Smart Fit)';
                    
                    container.onclick = function() {
                        // Visual feedback
                        container.style.backgroundColor = '#e4e4e4';
                        setTimeout(() => {
                            container.style.backgroundColor = 'white';
                        }, 150);
                        
                        // Call the re-center method from Vue instance
                        if (window.vueApp) {
                            window.vueApp.recenterMap();
                        }
                    };
                    
                    return container;
                },
                
                onRemove: function(map) {
                    // Nothing to do here
                }
            });
            
            // Add control to map (positioned below zoom controls)
            this.map.addControl(new RecenterControl({ position: 'topleft' }));
            
            // Add compass control
            this.addCompassControl();
            
            // Store Vue instance globally so the control can access it
            window.vueApp = this;
        },
        
        recenterMap() {
            // Smart re-center logic
            let markersToFit = [];
            let message = '';
            
            // Check if there are any active filters
            const hasActiveFilter = this.searchQuery.trim() || this.selectedCategory;
            
            if (hasActiveFilter && this.filteredLocations.length > 0) {
                // Re-center to filtered results
                markersToFit = this.markers;
                message = `Menampilkan ${this.filteredLocations.length} lokasi hasil filter`;
            } else if (this.markers.length > 0) {
                // Re-center to all markers
                markersToFit = this.markers;
                message = `Menampilkan semua ${this.markers.length} lokasi TDN`;
            } else {
                // Fallback to Indonesia center
                this.map.setView([-6.2088, 106.8456], 6);
                this.showToast('Kembali ke pusat Indonesia');
                return;
            }
            
            // Fit bounds to markers with smooth animation
            if (markersToFit.length > 0) {
                const group = new L.featureGroup(markersToFit);
                this.map.fitBounds(group.getBounds().pad(0.1), {
                    animate: true,
                    duration: 1.0
                });
                this.showToast(message);
            }
        },
        
        showToast(message) {
            // Create toast notification
            const toast = document.createElement('div');
            toast.className = 'toast-notification';
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-size: 14px;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            
            document.body.appendChild(toast);
            
            // Show toast
            setTimeout(() => {
                toast.style.opacity = '1';
            }, 100);
            
            // Hide and remove toast
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 2000);
        },
        
        addCompassControl() {
            // Create custom compass control
            const CompassControl = L.Control.extend({
                onAdd: function(map) {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                    
                    container.style.backgroundColor = 'white';
                    container.style.backgroundImage = 'none';
                    container.style.width = '30px';
                    container.style.height = '30px';
                    container.style.cursor = 'pointer';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';
                    container.style.fontSize = '16px';
                    container.innerHTML = '🧭';
                    container.title = 'Reset Orientation (North Up)';
                    
                    container.onclick = function() {
                        // Visual feedback
                        container.style.backgroundColor = '#e4e4e4';
                        setTimeout(() => {
                            container.style.backgroundColor = 'white';
                        }, 150);
                        
                        // Call the compass method from Vue instance
                        if (window.vueApp) {
                            window.vueApp.resetOrientation();
                        }
                    };
                    
                    return container;
                },
                
                onRemove: function(map) {
                    // Nothing to do here
                }
            });
            
            // Add compass control to map
            this.map.addControl(new CompassControl({ position: 'topleft' }));
        },
        
        resetOrientation() {
            // Reset map bearing/rotation to 0 (North up)
            if (this.map.getBearing && this.map.setBearing) {
                // If map supports rotation (like Mapbox GL)
                this.map.setBearing(0);
                this.showToast('Orientasi peta direset ke Utara');
            } else {
                // For standard Leaflet, we can reset to a standard view
                // Get current center and zoom
                const center = this.map.getCenter();
                const zoom = this.map.getZoom();
                
                // Reset view with animation
                this.map.setView(center, zoom, {
                    animate: true,
                    duration: 0.5
                });
                
                this.showToast('Peta direset ke orientasi standar');
            }
        },
        
        addLayerSwitcher() {
            // Create layer switcher container
            const LayerSwitcher = L.Control.extend({
                onAdd: function(map) {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control layer-switcher-container');
                    
                    // Create buttons for each layer
                    const layers = [
                        { key: 'osm', icon: '🗺️', title: 'OpenStreetMap' },
                        { key: 'positron', icon: '🎯', title: 'Clean Map' },
                        { key: 'satellite', icon: '🛰️', title: 'Satellite' }
                    ];
                    
                    layers.forEach(layer => {
                        const button = L.DomUtil.create('div', 'leaflet-control-custom layer-button', container);
                        button.innerHTML = layer.icon;
                        button.title = layer.title;
                        button.dataset.layer = layer.key;
                        
                        // Set active state for default layer
                        if (window.vueApp && layer.key === window.vueApp.currentLayer) {
                            button.classList.add('active');
                        }
                        
                        button.onclick = function() {
                            if (window.vueApp) {
                                window.vueApp.switchLayer(layer.key);
                            }
                        };
                    });
                    
                    return container;
                },
                
                onRemove: function(map) {
                    // Nothing to do here
                }
            });
            
            // Add layer switcher to map (top-right)
            this.map.addControl(new LayerSwitcher({ position: 'topright' }));
        },
        
        switchLayer(layerKey) {
            // Remove all existing base layers
            Object.keys(this.tileLayers).forEach(key => {
                const layer = this.tileLayers[key];
                if (layer && this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            });

            if (this.labeledLayer && this.map.hasLayer(this.labeledLayer)) {
                this.map.removeLayer(this.labeledLayer);
            }

            // Add new layer
            if (this.tileLayers[layerKey]) {
                this.tileLayers[layerKey].addTo(this.map);
                this.currentLayer = layerKey;
                
                // Update button states
                document.querySelectorAll('.layer-button').forEach(btn => {
                    btn.classList.remove('active');
                });
                document.querySelector(`[data-layer="${layerKey}"]`).classList.add('active');
                
                // Show toast
                const layerNames = {
                    osm: 'OpenStreetMap',
                    positron: 'Clean Map',
                    satellite: 'Satellite View'
                };
                this.showToast(`Switched to ${layerNames[layerKey]}`);
            }
        },
        
        addIndonesiaLockControl() {
            // Create Indonesia lock control
            const IndonesiaLockControl = L.Control.extend({
                onAdd: function(map) {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                    container.style.backgroundColor = 'white';
                    container.style.backgroundImage = 'none';
                    container.style.width = '30px';
                    container.style.height = '30px';
                    container.style.cursor = 'pointer';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';
                    container.style.fontSize = '16px';
                    container.innerHTML = '🇮🇩';
                    container.title = 'Lock/Unlock Indonesia View';
                    
                    // Update initial state
                    if (window.vueApp && window.vueApp.isIndonesiaLocked) {
                        container.style.backgroundColor = '#667eea';
                        container.style.color = 'white';
                    }
                    
                    container.onclick = function() {
                        // Visual feedback
                        container.style.backgroundColor = '#e4e4e4';
                        setTimeout(() => {
                            if (window.vueApp) {
                                window.vueApp.toggleIndonesiaLock();
                                // Update button appearance based on lock state
                                if (window.vueApp.isIndonesiaLocked) {
                                    container.style.backgroundColor = '#667eea';
                                    container.style.color = 'white';
                                } else {
                                    container.style.backgroundColor = 'white';
                                    container.style.color = 'black';
                                }
                            }
                        }, 150);
                    };
                    
                    return container;
                },
                
                onRemove: function(map) {
                    // Nothing to do here
                }
            });
            
            // Add Indonesia lock control to map (below zoom controls)
            this.map.addControl(new IndonesiaLockControl({ position: 'topleft' }));
        },
        
        toggleIndonesiaLock() {
            this.isIndonesiaLocked = !this.isIndonesiaLocked;
            
            if (this.isIndonesiaLocked) {
                // Lock to Indonesia bounds
                this.map.setMaxBounds(this.indonesiaBounds);
                this.fitToIndonesia();
                this.showToast('Map locked to Indonesia 🇮🇩');
            } else {
                // Unlock bounds
                this.map.setMaxBounds(null);
                this.showToast('Map unlocked - worldwide view available');
            }
        },
        
        fitToIndonesia() {
            // Fit map to Indonesia bounds with some padding
            // Don't restrict zoom level - allow users to zoom in freely
            this.map.fitBounds(this.indonesiaBounds, {
                padding: [20, 20]
            });
        },
        
        checkBounds() {
            // Only check bounds if lock is enabled
            if (this.isIndonesiaLocked) {
                const center = this.map.getCenter();
                
                // Check if center point is outside Indonesia bounds
                if (center.lat < this.indonesiaBounds[0][0] || // South of Indonesia
                    center.lat > this.indonesiaBounds[1][0] || // North of Indonesia
                    center.lng < this.indonesiaBounds[0][1] || // West of Indonesia
                    center.lng > this.indonesiaBounds[1][1]) {  // East of Indonesia
                    
                    // Only recenter if center is outside Indonesia
                    // Don't interfere with zooming within Indonesia
                    this.fitToIndonesia();
                    this.showToast('Auto-centered to Indonesia (map locked)');
                }
            }
        },
        
        isBoundsWithin(innerBounds, outerBounds) {
            return innerBounds[0][0] >= outerBounds[0][0] && // South >= Outer South
                   innerBounds[0][1] >= outerBounds[0][1] && // West >= Outer West
                   innerBounds[1][0] <= outerBounds[1][0] && // North <= Outer North
                   innerBounds[1][1] <= outerBounds[1][1];   // East <= Outer East
        },
        
        async applyIndonesiaClipping() {
            try {
                // Define Indonesia bounds (native Leaflet LatLngBounds)
                const indonesiaBounds = L.latLngBounds(
                    L.latLng(-11.0, 95.0),   // Southwest
                    L.latLng(6.0, 141.0)     // Northeast
                );
                
                // Create OSM tile layer with bounds restriction (native Leaflet feature)
                this.labeledLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    name: 'OSM Map (Indonesia Only)',
                    bounds: indonesiaBounds
                });
                
                // Remove current layer
                if (this.tileLayers[this.currentLayer]) {
                    this.map.removeLayer(this.tileLayers[this.currentLayer]);
                }
                
                // Add OSM layer (native Leaflet method)
                this.labeledLayer.addTo(this.map);
                
                // Set map bounds to Indonesia (native Leaflet method)
                this.map.setMaxBounds(indonesiaBounds);
                this.map.fitBounds(indonesiaBounds);
                
            } catch (error) {
                console.error('Error applying Indonesia clipping:', error);
            }
        },
        
        removeIndonesiaClipping() {
            // Remove layers (native Leaflet method)
            if (this.labeledLayer) {
                this.map.removeLayer(this.labeledLayer);
                this.labeledLayer = null;
            }
            
            // Remove max bounds restriction (native Leaflet method)
            this.map.setMaxBounds(null);
            
            // Restore original layer (native Leaflet method)
            if (this.tileLayers[this.currentLayer]) {
                this.tileLayers[this.currentLayer].addTo(this.map);
            }
        },
        
        addIndonesiaMask() {
            // Fallback mask overlay (keep existing implementation)
            const worldBounds = [[-90, -180], [90, 180]];
            const indonesiaBounds = this.indonesiaBounds;
            
            // Top rectangle
            const topRect = L.rectangle([
                [worldBounds[1][0], worldBounds[0][1]],
                [indonesiaBounds[1][0], worldBounds[1][1]]
            ], {
                color: '#2c3e50',
                fillColor: '#2c3e50',
                fillOpacity: 0.95,
                weight: 0,
                interactive: false
            });
            
            // Bottom rectangle
            const bottomRect = L.rectangle([
                [indonesiaBounds[0][0], worldBounds[0][1]],
                [worldBounds[0][0], worldBounds[1][1]]
            ], {
                color: '#2c3e50',
                fillColor: '#2c3e50',
                fillOpacity: 0.95,
                weight: 0,
                interactive: false
            });
            
            // Left rectangle
            const leftRect = L.rectangle([
                [indonesiaBounds[0][0], worldBounds[0][1]],
                [indonesiaBounds[1][0], indonesiaBounds[0][1]]
            ], {
                color: '#2c3e50',
                fillColor: '#2c3e50',
                fillOpacity: 0.95,
                weight: 0,
                interactive: false
            });
            
            // Right rectangle
            const rightRect = L.rectangle([
                [indonesiaBounds[0][0], indonesiaBounds[1][1]],
                [indonesiaBounds[1][0], worldBounds[1][1]]
            ], {
                color: '#2c3e50',
                fillColor: '#2c3e50',
                fillOpacity: 0.95,
                weight: 0,
                interactive: false
            });
            
            this.indonesiaMask = L.layerGroup([topRect, bottomRect, leftRect, rightRect]);
            this.indonesiaMask.addTo(this.map);
        },
        
        removeIndonesiaMask() {
            if (this.indonesiaMask) {
                this.map.removeLayer(this.indonesiaMask);
                this.indonesiaMask = null;
            }
        }
    }
}).mount('#app');