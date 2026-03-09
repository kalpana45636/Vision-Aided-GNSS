document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Navigation Menu Toggle ---
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            navLinks.style.flexDirection = 'column';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '100%';
            navLinks.style.left = '0';
            navLinks.style.width = '100%';
            navLinks.style.background = 'rgba(5, 8, 20, 0.95)';
            navLinks.style.padding = '1rem';
        });
    }

    // --- 2. Integrated Navigation & Vision Module ---
    
    // Map Initialization
    let currentLat = 37.7749;
    let currentLng = -122.4194;

    const map = L.map('navigation-map', {
        zoomControl: true,
        attributionControl: false
    }).setView([currentLat, currentLng], 16);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: "<div class='marker-pin'></div>",
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    // Camera Layer pin
    const liveMarker = L.marker([currentLat, currentLng], { icon: customIcon }).addTo(map);

    // Path tracking
    let pathCoordinates = [[currentLat, currentLng]];
    const routeLine = L.polyline(pathCoordinates, {
        color: '#ef4444', 
        weight: 5, 
        opacity: 0.8, 
        smoothFactor: 1
    }).addTo(map);

    let photoMarkers = []; // Keep track of uploaded photo markers

    // Directional velocities for visible movement (Removed random drift)
    // let vLat = 0.00005;
    // let vLng = 0.00005;

    // DOM Elements
    const camFeed = document.getElementById('camera-feed');
    const captureCanvas = document.getElementById('capture-canvas');
    const captureBtn = document.getElementById('capture-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const imageUpload = document.getElementById('image-upload');
    const camLat = document.getElementById('cam-lat');
    const camLng = document.getElementById('cam-lng');
    const camTime = document.getElementById('cam-time');

    // Camera Stream Logic (WebRTC)
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
            camFeed.srcObject = stream;
        } catch (err) {
            console.error("Camera access denied or unavailable: ", err);
            // Fallback visualization if no camera or permission denied
            camFeed.style.backgroundColor = "#111";
            camFeed.insertAdjacentHTML('afterend', '<p style="position:absolute; color:#ef4444; font-family:var(--font-heading); text-align:center;">CAMERA FEED UNAVAILABLE</p>');
        }
    }

    initCamera();

    // State tracking to prevent map jerking during animations
    let isFlying = false;

    // Simulated GPS and Time overlay update
    setInterval(() => {
        // Minor steady drift to simulate subtle GNSS updates instead of aggressive moving
        currentLat += 0.000001; 
        currentLng += 0.000001;

        const newLatLng = [currentLat, currentLng];
        liveMarker.setLatLng(newLatLng);
        
        // Update trail
        pathCoordinates.push(newLatLng);
        routeLine.setLatLngs(pathCoordinates);
        
        if (!isFlying) {
            map.panTo(newLatLng, { animate: true, duration: 1 });
        }

        // Update overlay
        camLat.innerText = currentLat.toFixed(5);
        camLng.innerText = currentLng.toFixed(5);
        camTime.innerText = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    }, 1000);


    // Capture Photo Logic
    captureBtn.addEventListener('click', () => {
        if (!camFeed.srcObject) return; // Prevent if no camera

        // Draw current video frame to hidden canvas
        captureCanvas.width = camFeed.videoWidth;
        captureCanvas.height = camFeed.videoHeight;
        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(camFeed, 0, 0, captureCanvas.width, captureCanvas.height);
        
        const dataUrl = captureCanvas.toDataURL('image/jpeg');
        // For captured photos, we know the exact location is where we are right now.
        processImageResult(dataUrl, "Captured", { lat: currentLat, lng: currentLng });
    });

    // Upload Image Logic
    uploadBtn.addEventListener('click', () => imageUpload.click());

    // Helper function to convert EXIF GPS coordinate array to decimal degrees
    function convertDMSToDD(degrees, minutes, seconds, direction) {
        let dd = degrees + (minutes / 60) + (seconds / 3600);
        if (direction === "S" || direction === "W") {
            dd = dd * -1;
        }
        return dd;
    }

    imageUpload.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const file = this.files[0];
            
            // First, read EXIF data to get location
            EXIF.getData(file, function() {
                let visionLat = null;
                let visionLng = null;
                
                const latArray = EXIF.getTag(this, "GPSLatitude");
                const latRef = EXIF.getTag(this, "GPSLatitudeRef");
                const lngArray = EXIF.getTag(this, "GPSLongitude");
                const lngRef = EXIF.getTag(this, "GPSLongitudeRef");

                if (latArray && latRef && lngArray && lngRef) {
                    visionLat = convertDMSToDD(latArray[0], latArray[1], latArray[2], latRef);
                    visionLng = convertDMSToDD(lngArray[0], lngArray[1], lngArray[2], lngRef);
                    
                    // Update our internal system state to the actual photo location
                    currentLat = visionLat;
                    currentLng = visionLng;
                } else {
                    console.warn("No EXIF GPS data found on image. Falling back to simulated location update.");
                    // Fallback simulated jump just like before
                    visionLat = currentLat + 0.005; 
                    visionLng = currentLng + 0.005;
                    currentLat = visionLat;
                    currentLng = visionLng;
                }

                // Now read the image for display
                const reader = new FileReader();
                reader.onload = (e) => {
                    const extractedCoords = { lat: visionLat, lng: visionLng };
                    // If we had to fallback, we can signal processImageResult by passing null for coords
                    if (!latArray) extractedCoords.lat = null; 
                    processImageResult(e.target.result, "Uploaded", (latArray ? extractedCoords : null));
                };
                reader.readAsDataURL(file);
            });
        }
    });

    function processImageResult(imageDataUrl, type, extractedCoords = null) {
        // If we extracted true EXIF coords, use them. Otherwise fallback to current sim location.
        let pinLat = extractedCoords && extractedCoords.lat != null ? extractedCoords.lat : currentLat;
        let pinLng = extractedCoords && extractedCoords.lng != null ? extractedCoords.lng : currentLng;
        
        let timeStamp = new Date().toLocaleTimeString();
        let locationText = `LAT: ${pinLat.toFixed(5)}°<br>LON: ${pinLng.toFixed(5)}°`;
        let sourceText = extractedCoords && extractedCoords.lat != null ? 
                        '<span style="color:#10b981; font-size:0.8rem;">(From Image EXIF)</span>' : 
                        '<span style="color:#ef4444; font-size:0.8rem;">(No EXIF - Used Device Location)</span>';

        // Create Leaflet Popup content
        const popupContent = `
            <div class="popup-content">
                <img src="${imageDataUrl}" alt="${type} Frame" style="max-width: 200px; max-height: 150px; object-fit: cover;" />
                <div class="popup-details" style="text-align: left; margin-top: 5px;">
                    <strong>Type:</strong> ${type} ${sourceText}<br>
                    <strong>Location:</strong><br>${locationText}<br>
                    <strong>TIME:</strong> ${timeStamp}
                </div>
            </div>
        `;

        // Add standard marker to map
        const photoMarker = L.marker([pinLat, pinLng]).addTo(map);
        photoMarker.bindPopup(popupContent, { minWidth: 200 }).openPopup();
        photoMarkers.push(photoMarker);

        // Suspend tracking pan during the fly animation
        isFlying = true;
        map.flyTo([pinLat, pinLng], 15, { duration: 1.5 });
        
        // Resume tracking pan after the animation completes
        setTimeout(() => {
            isFlying = false;
        }, 1600);
    }

    // Reset Path Logic
    const resetPathBtn = document.getElementById('reset-path-btn');
    if (resetPathBtn) {
        resetPathBtn.addEventListener('click', () => {
            pathCoordinates = [[currentLat, currentLng]];
            routeLine.setLatLngs(pathCoordinates);
            photoMarkers.forEach(m => map.removeLayer(m));
            photoMarkers = [];
        });
    }

    // --- 5. Results Charts (Chart.js) ---
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    const accCtx = document.getElementById('accuracyChart').getContext('2d');
    new Chart(accCtx, {
        type: 'line',
        data: {
            labels: ['0s', '10s', '20s', '30s', '40s', '50s', '60s'],
            datasets: [
                {
                    label: 'Pure GNSS Error (m)',
                    data: [1.2, 1.5, 4.2, 5.1, 2.5, 1.1, 0.9], // Spike represents urban canyon
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Vision-Aided Error (m)',
                    data: [0.2, 0.25, 0.3, 0.35, 0.25, 0.2, 0.15],
                    borderColor: '#00f0ff',
                    backgroundColor: 'rgba(0, 240, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });

    const detCtx = document.getElementById('detectionChart').getContext('2d');
    new Chart(detCtx, {
        type: 'bar',
        data: {
            labels: ['Clear', 'Rain', 'Fog', 'Night', 'Snow'],
            datasets: [{
                label: 'Detection Confidence (%)',
                data: [98, 85, 76, 82, 79],
                backgroundColor: [
                    'rgba(0, 240, 255, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // --- 6. Form Submission Prevention (Demo) ---
    document.getElementById('contactForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.innerText = 'Message Sent!';
        btn.style.background = '#10b981';
        btn.style.color = '#fff';
        btn.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.5)';
        setTimeout(() => {
            e.target.reset();
            btn.innerText = 'Send Message';
            btn.style = '';
        }, 3000);
    });

});
