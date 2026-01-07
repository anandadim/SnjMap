const { createApp } = Vue;

createApp({
    data() {
        return {
            locations: [],
            newLocation: {
                name: '',
                address: '',
                lat: '',
                lng: '',
                marker: {
                    type: 'default',
                    color: '#3388ff',
                    icon: null
                },
                businesses: []
            },
            modal: {
                show: false,
                type: '', // 'location' or 'business'
                title: '',
                data: {},
                locationId: null,
                businessIndex: null
            },
            alert: {
                show: false,
                type: '', // 'success' or 'error'
                message: ''
            }
        }
    },
    
    async mounted() {
        await this.loadLocations();
    },
    
    methods: {
        async loadLocations() {
            try {
                const response = await fetch('/api/locations');
                const data = await response.json();
                this.locations = data.locations || [];
            } catch (error) {
                this.showAlert('error', 'Gagal memuat data lokasi');
                console.error('Error loading locations:', error);
            }
        },
        
        async addLocation() {
            try {
                const locationData = {
                    name: this.newLocation.name,
                    address: this.newLocation.address,
                    lat: parseFloat(this.newLocation.lat),
                    lng: parseFloat(this.newLocation.lng),
                    marker: {
                        color: this.newLocation.marker.color,
                        icon: this.newLocation.marker.icon
                    },
                    businesses: []
                };
                
                const response = await fetch('/api/locations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(locationData)
                });
                
                if (response.ok) {
                    this.showAlert('success', 'Lokasi berhasil ditambahkan');
                    this.newLocation = { 
                        name: '',
                        address: '', 
                        lat: '', 
                        lng: '', 
                        marker: { type: 'default', color: '#3388ff', icon: null },
                        businesses: [] 
                    };
                    await this.loadLocations();
                } else {
                    this.showAlert('error', 'Gagal menambahkan lokasi');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat menambahkan lokasi');
                console.error('Error adding location:', error);
            }
        },
        
        editLocation(location) {
            // Ensure marker object exists with proper structure
            if (!location.marker) {
                location.marker = { type: 'default', color: '#3388ff', icon: null };
            } else {
                // Backward compatibility - determine type from existing data
                if (!location.marker.type) {
                    if (location.marker.icon) {
                        location.marker.type = 'icon';
                    } else if (location.marker.color && location.marker.color !== '#3388ff') {
                        location.marker.type = 'color';
                    } else {
                        location.marker.type = 'default';
                    }
                }
            }
            
            this.modal = {
                show: true,
                type: 'location',
                title: 'Edit Lokasi',
                data: { 
                    ...location,
                    marker: { ...location.marker }
                },
                locationId: location.id,
                businessIndex: null
            };
        },
        
        async saveLocation() {
            try {
                const response = await fetch(`/api/locations/${this.modal.locationId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: this.modal.data.name,
                        address: this.modal.data.address,
                        lat: parseFloat(this.modal.data.lat),
                        lng: parseFloat(this.modal.data.lng),
                        marker: this.modal.data.marker
                    })
                });
                
                if (response.ok) {
                    this.showAlert('success', 'Lokasi berhasil diperbarui');
                    this.closeModal();
                    await this.loadLocations();
                } else {
                    this.showAlert('error', 'Gagal memperbarui lokasi');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat memperbarui lokasi');
                console.error('Error updating location:', error);
            }
        },
        
        async deleteLocation(locationId) {
            if (!confirm('Apakah Anda yakin ingin menghapus lokasi ini?')) {
                return;
            }
            
            try {
                const response = await fetch(`/api/locations/${locationId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.showAlert('success', 'Lokasi berhasil dihapus');
                    await this.loadLocations();
                } else {
                    this.showAlert('error', 'Gagal menghapus lokasi');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat menghapus lokasi');
                console.error('Error deleting location:', error);
            }
        },
        
        addBusiness(location) {
            this.modal = {
                show: true,
                type: 'business',
                title: 'Tambah Bisnis Baru',
                data: {
                    name: '',
                    category: '',
                    phone: '',
                    description: ''
                },
                locationId: location.id,
                businessIndex: -1 // -1 indicates new business
            };
        },
        
        editBusiness(location, business) {
            const businessIndex = location.businesses.findIndex(b => b.name === business.name);
            this.modal = {
                show: true,
                type: 'business',
                title: 'Edit Bisnis',
                data: { ...business },
                locationId: location.id,
                businessIndex: businessIndex
            };
        },
        
        async saveBusiness() {
            try {
                const location = this.locations.find(loc => loc.id === this.modal.locationId);
                if (!location) return;
                
                const updatedBusinesses = [...location.businesses];
                
                if (this.modal.businessIndex === -1) {
                    // Add new business
                    updatedBusinesses.push(this.modal.data);
                } else {
                    // Update existing business
                    updatedBusinesses[this.modal.businessIndex] = this.modal.data;
                }
                
                const response = await fetch(`/api/locations/${this.modal.locationId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        businesses: updatedBusinesses
                    })
                });
                
                if (response.ok) {
                    this.showAlert('success', 'Bisnis berhasil disimpan');
                    this.closeModal();
                    await this.loadLocations();
                } else {
                    this.showAlert('error', 'Gagal menyimpan bisnis');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat menyimpan bisnis');
                console.error('Error saving business:', error);
            }
        },
        
        async deleteBusiness(location, business) {
            if (!confirm(`Apakah Anda yakin ingin menghapus bisnis "${business.name}"?`)) {
                return;
            }
            
            try {
                const updatedBusinesses = location.businesses.filter(b => b.name !== business.name);
                
                const response = await fetch(`/api/locations/${location.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        businesses: updatedBusinesses
                    })
                });
                
                if (response.ok) {
                    this.showAlert('success', 'Bisnis berhasil dihapus');
                    await this.loadLocations();
                } else {
                    this.showAlert('error', 'Gagal menghapus bisnis');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat menghapus bisnis');
                console.error('Error deleting business:', error);
            }
        },
        
        closeModal() {
            this.modal = {
                show: false,
                type: '',
                title: '',
                data: {},
                locationId: null,
                businessIndex: null
            };
        },
        
        showAlert(type, message) {
            this.alert = {
                show: true,
                type: type,
                message: message
            };
            
            // Auto hide alert after 5 seconds
            setTimeout(() => {
                this.alert.show = false;
            }, 5000);
        },
        
        async handleIconUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('icon', file);
            
            try {
                const response = await fetch('/api/upload-icon', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.newLocation.marker.icon = result.path;
                    this.showAlert('success', 'Icon berhasil diupload');
                } else {
                    this.showAlert('error', 'Gagal mengupload icon');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat mengupload icon');
                console.error('Error uploading icon:', error);
            }
        },
        
        async handleModalIconUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('icon', file);
            
            try {
                const response = await fetch('/api/upload-icon', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.modal.data.marker.icon = result.path;
                    this.showAlert('success', 'Icon berhasil diupload');
                } else {
                    this.showAlert('error', 'Gagal mengupload icon');
                }
            } catch (error) {
                this.showAlert('error', 'Terjadi kesalahan saat mengupload icon');
                console.error('Error uploading icon:', error);
            }
        },
        
        removeIcon() {
            this.newLocation.marker.icon = null;
        },
        
        removeModalIcon() {
            this.modal.data.marker.icon = null;
        },
        
        resetMarkerOptions() {
            // Reset options when marker type changes
            if (this.newLocation.marker.type === 'default') {
                this.newLocation.marker.color = '#3388ff';
                this.newLocation.marker.icon = null;
            } else if (this.newLocation.marker.type === 'color') {
                this.newLocation.marker.icon = null;
            } else if (this.newLocation.marker.type === 'icon') {
                this.newLocation.marker.color = '#3388ff';
            }
        },
        
        resetModalMarkerOptions() {
            // Reset options when marker type changes in modal
            if (this.modal.data.marker.type === 'default') {
                this.modal.data.marker.color = '#3388ff';
                this.modal.data.marker.icon = null;
            } else if (this.modal.data.marker.type === 'color') {
                this.modal.data.marker.icon = null;
            } else if (this.modal.data.marker.type === 'icon') {
                this.modal.data.marker.color = '#3388ff';
            }
        }
    }
}).mount('#app');