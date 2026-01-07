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
            currentLayer: 'osm'
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
            // Initialize map centered on Jakarta
            this.map = L.map('map').setView([-6.2088, 106.8456], 11);
            
            // Define tile layers
            this.tileLayers = {
                osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    name: 'OpenStreetMap'
                }),
                positron: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                    attribution: '© OpenStreetMap contributors © CARTO',
                    name: 'CartoDB Positron'
                }),
                satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: '© Esri © DigitalGlobe © GeoEye © Earthstar Geographics © CNES/Airbus DS © USDA © USGS © AeroGRID © IGN © IGP',
                    name: 'Satellite'
                })
            };
            
            // Set default layer
            this.currentLayer = 'osm';
            this.tileLayers.osm.addTo(this.map);
            
            // Add custom controls
            this.addRecenterControl();
            this.addLayerSwitcher();
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
                
                // Add permanent tooltip with location name
                if (location.name) {
                    marker.bindTooltip(location.name, {
                        permanent: true,
                        direction: 'bottom',
                        offset: [0, 10],
                        className: 'location-label'
                    });
                }
                
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
                        shadowAnchor: [12, 41]
                    });
                    
                    return L.marker([location.lat, location.lng], { icon: customIcon });
                } else if (markerType === 'color' && location.marker.color) {
                    // Use colored marker (create SVG marker)
                    const coloredIcon = this.createColoredMarker(location.marker.color);
                    return L.marker([location.lat, location.lng], { icon: coloredIcon });
                }
            }
            
            // Default marker (blue)
            return L.marker([location.lat, location.lng]);
        },
        
        createColoredMarker(color) {
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
                className: 'custom-colored-marker'
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
                content += `
                    <div class="business-item">
                        <div class="business-name">${business.name}</div>
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
                        if (layer.key === 'osm') {
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
            // Remove current layer
            if (this.tileLayers[this.currentLayer]) {
                this.map.removeLayer(this.tileLayers[this.currentLayer]);
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
        }
    }
}).mount('#app');