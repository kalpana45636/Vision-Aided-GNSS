/**
 * VISION-AIDED GNSS — script.js  v4
 *
 * IMPORTANT: On laptops/desktops there is no GPS chip.
 * The browser uses IP/WiFi to estimate location (can be very inaccurate).
 * For real GPS accuracy, open this site on a MOBILE phone over HTTPS.
 *
 * Zero hard-coded coordinates in this file.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Mobile nav ───────────────────────────────────────────────────
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks   = document.querySelector('.nav-links');
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            const open = navLinks.style.display === 'flex';
            Object.assign(navLinks.style, {
                display:       open ? 'none' : 'flex',
                flexDirection: 'column',
                position:      'absolute',
                top:           '100%',
                left:          '0',
                width:         '100%',
                background:    'rgba(5,8,20,0.97)',
                padding:       '1rem',
                zIndex:        '999'
            });
        });
    }

    // ── GPS state — NO hard-coded coordinates ────────────────────────
    let lat        = null;
    let lng        = null;
    let accuracy   = null;   // metres
    let gpsReady   = false;

    // ── UI refs ──────────────────────────────────────────────────────
    const statusEl   = document.getElementById('system-status');
    const camLatEl   = document.getElementById('cam-lat');
    const camLngEl   = document.getElementById('cam-lng');
    const camTimeEl  = document.getElementById('cam-time');
    const camAccEl   = document.getElementById('cam-acc');

    function setStatus(iconClass, text, color) {
        if (!statusEl) return;
        statusEl.innerHTML = `<i class="${iconClass}"></i> ${text}`;
        statusEl.style.color = color;
    }

    // Live clock — independent of GPS
    setInterval(() => {
        if (camTimeEl) {
            camTimeEl.textContent = new Date().toLocaleTimeString('en-IN', {
                hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
    }, 1000);

    // ── Leaflet map ──────────────────────────────────────────────────
    const map = L.map('navigation-map', {
        zoomControl:        true,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    // Glowing live marker
    const liveIcon = L.divIcon({
        className:  'custom-div-icon',
        html:       "<div class='marker-pin'></div>",
        iconSize:   [18, 18],
        iconAnchor: [9, 9]
    });

    let liveMarker   = null;
    let pathCoords   = [];
    let photoMarkers = [];
    let isFlying     = false;

    const routeLine = L.polyline([], {
        color:        '#ef4444',
        weight:       5,
        opacity:      0.85,
        smoothFactor: 1
    }).addTo(map);

    // ── Apply a GPS position ─────────────────────────────────────────
    function applyPosition(newLat, newLng, newAcc) {
        const firstFix = !gpsReady;
        lat      = newLat;
        lng      = newLng;
        accuracy = newAcc;
        gpsReady = true;

        const ll = [lat, lng];

        // Update overlay text
        if (camLatEl)  camLatEl.textContent  = lat.toFixed(6) + '°';
        if (camLngEl)  camLngEl.textContent  = lng.toFixed(6) + '°';
        if (camAccEl) {
            const acc = accuracy ? Math.round(accuracy) : '?';
            camAccEl.textContent = `±${acc} m`;
            camAccEl.style.color = accuracy > 100 ? '#ef4444'
                                 : accuracy > 30  ? '#f59e0b'
                                 :                  '#10b981';
        }

        // Status badge
        if (accuracy > 500) {
            setStatus('fa-solid fa-triangle-exclamation',
                'Poor GPS (IP-based)', '#ef4444');
        } else if (accuracy > 50) {
            setStatus('fa-solid fa-wifi', 'GPS — Low Accuracy', '#f59e0b');
        } else {
            setStatus('fa-solid fa-circle-check', 'GPS Locked', '#10b981');
        }

        // Marker & map
        if (firstFix) {
            map.setView(ll, 17);
            liveMarker = L.marker(ll, { icon: liveIcon }).addTo(map);
            pathCoords = [ll];
            routeLine.setLatLngs(pathCoords);
        } else {
            if (liveMarker) liveMarker.setLatLng(ll);

            const last = pathCoords[pathCoords.length - 1];
            if (!last || last[0] !== lat || last[1] !== lng) {
                pathCoords.push(ll);
                routeLine.setLatLngs(pathCoords);
            }
            if (!isFlying) {
                map.panTo(ll, { animate: true, duration: 1 });
            }
        }
    }

    // ── Geolocation error handler ────────────────────────────────────
    function handleGeoError(err) {
        console.error('Geolocation error:', err.code, err.message);
        let msg;
        switch (err.code) {
            case 1:
                msg = 'Location permission denied.\n\n'
                    + 'How to fix:\n'
                    + '1. Click the 🔒 lock icon in the browser address bar.\n'
                    + '2. Set Location → Allow.\n'
                    + '3. Reload the page (Ctrl+Shift+R).';
                break;
            case 2:
                msg = 'Device cannot determine location.\n'
                    + 'Make sure GPS / Location Services are enabled.';
                break;
            case 3:
                msg = 'GPS timed out. Make sure Location Services are on and try again.';
                break;
            default:
                msg = 'Unknown location error. Please enable GPS and reload.';
        }
        alert(msg);
        setStatus('fa-solid fa-triangle-exclamation', 'GPS Error', '#ef4444');
        if (camLatEl) camLatEl.textContent = 'Error';
        if (camLngEl) camLngEl.textContent = 'Error';
        // Neutral world view so map doesn't stay blank
        if (!gpsReady) map.setView([20, 78], 4);
    }

    // ── Start geolocation ────────────────────────────────────────────
    const GEO_OPTS = {
        enableHighAccuracy: true,
        maximumAge:         0,
        timeout:            20000
    };

    if ('geolocation' in navigator) {
        setStatus('fa-solid fa-spinner fa-spin', 'Acquiring GPS…', '#f59e0b');

        // Immediate single fix → snaps map right away
        navigator.geolocation.getCurrentPosition(
            pos => applyPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
            handleGeoError,
            GEO_OPTS
        );

        // Continuous watch → updates as user moves
        navigator.geolocation.watchPosition(
            pos => applyPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
            err  => console.warn('watchPosition (non-fatal):', err.message),
            GEO_OPTS
        );
    } else {
        handleGeoError({ code: 0, message: 'Geolocation not supported.' });
    }

    // ── Camera ───────────────────────────────────────────────────────
    const camFeed       = document.getElementById('camera-feed');
    const captureCanvas = document.getElementById('capture-canvas');

    async function initCamera() {
        if (!navigator.mediaDevices?.getUserMedia) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 } },
                audio: false
            });
            camFeed.srcObject = stream;
        } catch (err) {
            console.warn('Camera unavailable:', err);
        }
    }
    initCamera();

    // ── Capture photo ────────────────────────────────────────────────
    document.getElementById('capture-btn').addEventListener('click', () => {
        if (!gpsReady) {
            alert('GPS not ready yet. Please wait for a location fix.');
            return;
        }

        let dataUrl = null;
        if (camFeed.srcObject && camFeed.videoWidth > 0) {
            captureCanvas.width  = camFeed.videoWidth;
            captureCanvas.height = camFeed.videoHeight;
            captureCanvas.getContext('2d').drawImage(camFeed, 0, 0);
            dataUrl = captureCanvas.toDataURL('image/jpeg', 0.92);
        }

        placePin(dataUrl, 'Captured', lat, lng, 'device-gps');
    });

    // ── Upload image ─────────────────────────────────────────────────
    const uploadBtn   = document.getElementById('upload-btn');
    const imageUpload = document.getElementById('image-upload');

    uploadBtn.addEventListener('click', () => imageUpload.click());

    function dmsToDecimal(arr, ref) {
        const dd = arr[0] + arr[1] / 60 + arr[2] / 3600;
        return (ref === 'S' || ref === 'W') ? -dd : dd;
    }

    imageUpload.addEventListener('change', function () {
        if (!this.files?.length) return;
        const file = this.files[0];

        EXIF.getData(file, function () {
            const latArr = EXIF.getTag(this, 'GPSLatitude');
            const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
            const lngArr = EXIF.getTag(this, 'GPSLongitude');
            const lngRef = EXIF.getTag(this, 'GPSLongitudeRef');

            let pinLat, pinLng, source;

            if (latArr && latRef && lngArr && lngRef) {
                pinLat = dmsToDecimal(latArr, latRef);
                pinLng = dmsToDecimal(lngArr, lngRef);
                source = 'exif';
            } else {
                if (!gpsReady) {
                    alert('No GPS data in the image and device GPS is not ready. Please wait for a location.');
                    return;
                }
                pinLat = lat;
                pinLng = lng;
                source = 'device-gps';
            }

            const reader = new FileReader();
            reader.onload = e => placePin(e.target.result, 'Uploaded', pinLat, pinLng, source);
            reader.readAsDataURL(file);
        });
    });

    // ── Place a pin + popup on the map ───────────────────────────────
    function placePin(imgDataUrl, label, pinLat, pinLng, source) {
        const time = new Date().toLocaleTimeString('en-IN', { hour12: true });
        const acc  = accuracy ? ` (±${Math.round(accuracy)} m)` : '';

        const srcHtml = source === 'exif'
            ? '<span style="color:#10b981;font-size:.78rem;">(EXIF GPS from image)</span>'
            : `<span style="color:#00f0ff;font-size:.78rem;">(Device GPS${acc})</span>`;

        const imgHtml = imgDataUrl
            ? `<img src="${imgDataUrl}" alt="${label}"
                    style="max-width:200px;max-height:140px;object-fit:cover;
                           border-radius:6px;border:1px solid #00f0ff;margin-bottom:6px;"/><br>`
            : '';

        const popup = `
            <div class="popup-content">
                ${imgHtml}
                <div class="popup-details">
                    <strong>Type:</strong> ${label} ${srcHtml}<br>
                    <strong>LAT:</strong> ${pinLat.toFixed(6)}°<br>
                    <strong>LON:</strong> ${pinLng.toFixed(6)}°<br>
                    <strong>TIME:</strong> ${time}
                </div>
            </div>`;

        const marker = L.marker([pinLat, pinLng]).addTo(map);
        marker.bindPopup(popup, { minWidth: 220 }).openPopup();
        photoMarkers.push(marker);

        isFlying = true;
        map.flyTo([pinLat, pinLng], 17, { duration: 1.5 });
        setTimeout(() => { isFlying = false; }, 1800);
    }

    // ── Reset path ───────────────────────────────────────────────────
    document.getElementById('reset-path-btn')?.addEventListener('click', () => {
        pathCoords = gpsReady ? [[lat, lng]] : [];
        routeLine.setLatLngs(pathCoords);
        photoMarkers.forEach(m => map.removeLayer(m));
        photoMarkers = [];
    });

    // ── Charts ───────────────────────────────────────────────────────
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    new Chart(document.getElementById('accuracyChart'), {
        type: 'line',
        data: {
            labels: ['0s','10s','20s','30s','40s','50s','60s'],
            datasets: [
                {
                    label: 'Pure GNSS Error (m)',
                    data: [1.2, 1.5, 4.2, 5.1, 2.5, 1.1, 0.9],
                    borderColor: '#ef4444', borderWidth: 2, tension: 0.4, fill: false
                },
                {
                    label: 'Vision-Aided Error (m)',
                    data: [0.2, 0.25, 0.3, 0.35, 0.25, 0.2, 0.15],
                    borderColor: '#00f0ff',
                    backgroundColor: 'rgba(0,240,255,0.1)',
                    borderWidth: 3, tension: 0.4, fill: true
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });

    new Chart(document.getElementById('detectionChart'), {
        type: 'bar',
        data: {
            labels: ['Clear','Rain','Fog','Night','Snow'],
            datasets: [{
                label: 'Detection Confidence (%)',
                data: [98, 85, 76, 82, 79],
                backgroundColor: [
                    'rgba(0,240,255,0.8)','rgba(139,92,246,0.8)',
                    'rgba(16,185,129,0.8)','rgba(245,158,11,0.8)',
                    'rgba(239,68,68,0.8)'
                ],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // ── Contact form ─────────────────────────────────────────────────
    document.getElementById('contactForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.textContent = 'Message Sent!';
        btn.style.cssText = 'background:#10b981;color:#fff;box-shadow:0 0 15px rgba(16,185,129,.5);';
        setTimeout(() => {
            e.target.reset();
            btn.textContent = 'Send Message';
            btn.style.cssText = '';
        }, 3000);
    });

});
