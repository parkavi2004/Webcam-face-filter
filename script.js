// Check if user is logged in
if (!localStorage.getItem('isLoggedIn')) {
    window.location.href = 'login.html';
}

const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const filterSelect = document.getElementById('filter');
const startButton = document.getElementById('startCamera');

let isStreaming = false;
let filterHistory;
let capturedPhotos = [];
const MAX_PHOTOS = 5;
let currentFilter = 'none';

// Enable start button immediately
startButton.disabled = false;

// Load face-api.js models
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models')
]).then(() => {
    console.log('Face detection models loaded');
    // Enable start button after models are loaded
    startButton.disabled = false;
})
.catch(err => {
    console.error('Error loading face-api models:', err);
    alert('Error loading face detection models. Please check your internet connection and try again.');
});

// Start Camera button click handler
startButton.addEventListener('click', async () => {
    try {
        if (!isStreaming) {
            await startVideo();
            startButton.textContent = 'Stop Camera';
            isStreaming = true;
        } else {
            stopVideo();
            startButton.textContent = 'Start Camera';
            isStreaming = false;
        }
    } catch (error) {
        console.error('Error toggling camera:', error);
        alert('Error accessing camera. Please make sure your camera is connected and not in use by another application.');
    }
});

async function startVideo() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support webcam access. Please try using Chrome, Firefox, or Edge.');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            } 
        });
        
        console.log('Camera access granted');
        video.srcObject = stream;
        await video.play();
        
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        return stream;
    } catch (err) {
        console.error('Error accessing camera:', err);
        if (err.name === 'NotAllowedError') {
            throw new Error('Camera access was denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
            throw new Error('No camera found. Please connect a camera and try again.');
        } else if (err.name === 'NotReadableError') {
            throw new Error('Camera is already in use by another application. Please close other applications using the camera.');
        } else {
            throw new Error('Error accessing camera: ' + err.message);
        }
    }
}

function stopVideo() {
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

// Handle video stream
video.addEventListener('loadedmetadata', () => {
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
});

// Process video frames
video.addEventListener('play', () => {
    function processFrame() {
        if (video.paused || video.ended) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw current video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Get the entire frame data
        const frameData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Apply filter to the entire frame
        const filteredFrame = applyFilter(frameData, filterSelect.value);
        ctx.putImageData(filteredFrame, 0, 0);

        // Request next frame
        requestAnimationFrame(processFrame);
    }

    // Start processing frames
    processFrame();
});

function applyFilter(imageData, filter) {
    const data = imageData.data;
    
    switch (filter) {
        case 'grayscale':
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            break;
            
        case 'invert':
            for (let i = 0; i < data.length; i += 4) {
                data[i] = 255 - data[i];
                data[i + 1] = 255 - data[i + 1];
                data[i + 2] = 255 - data[i + 2];
            }
            break;
            
        case 'sepia':
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                data[i] = Math.min(0.393 * r + 0.769 * g + 0.189 * b, 255);
                data[i + 1] = Math.min(0.349 * r + 0.686 * g + 0.168 * b, 255);
                data[i + 2] = Math.min(0.272 * r + 0.534 * g + 0.131 * b, 255);
            }
            break;
            
        case 'pixelate':
            const pixelSize = 8;
            for (let y = 0; y < imageData.height; y += pixelSize) {
                for (let x = 0; x < imageData.width; x += pixelSize) {
                    const r = data[((y * imageData.width + x) * 4)];
                    const g = data[((y * imageData.width + x) * 4) + 1];
                    const b = data[((y * imageData.width + x) * 4) + 2];
                    for (let py = 0; py < pixelSize; py++) {
                        for (let px = 0; px < pixelSize; px++) {
                            const idx = ((y + py) * imageData.width + (x + px)) * 4;
                            data[idx] = r;
                            data[idx + 1] = g;
                            data[idx + 2] = b;
                        }
                    }
                }
            }
            break;
            
        case 'mirror':
            const temp = new Uint8ClampedArray(data);
            for (let y = 0; y < imageData.height; y++) {
                for (let x = 0; x < imageData.width; x++) {
                    const idx = (y * imageData.width + x) * 4;
                    const mirrorIdx = (y * imageData.width + (imageData.width - x - 1)) * 4;
                    data[idx] = temp[mirrorIdx];
                    data[idx + 1] = temp[mirrorIdx + 1];
                    data[idx + 2] = temp[mirrorIdx + 2];
                    data[idx + 3] = temp[mirrorIdx + 3];
                }
            }
            break;
            
        case 'red':
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(data[i] * 1.5, 255);
                data[i + 1] *= 0.5;
                data[i + 2] *= 0.5;
            }
            break;
            
        case 'blue':
            for (let i = 0; i < data.length; i += 4) {
                data[i] *= 0.5;
                data[i + 1] *= 0.5;
                data[i + 2] = Math.min(data[i + 2] * 1.5, 255);
            }
            break;
            
        case 'green':
            for (let i = 0; i < data.length; i += 4) {
                data[i] *= 0.5;
                data[i + 1] = Math.min(data[i + 1] * 1.5, 255);
                data[i + 2] *= 0.5;
            }
            break;
            
        case 'vintage':
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i], g = data[i + 1], b = data[i + 2];
                data[i] = Math.min(0.393 * r + 0.769 * g + 0.189 * b, 255);
                data[i + 1] = Math.min(0.349 * r + 0.686 * g + 0.168 * b, 255);
                data[i + 2] = Math.min(0.272 * r + 0.534 * g + 0.131 * b, 255);
                data[i] = Math.min(data[i] * 1.1, 255);
                data[i + 1] = Math.min(data[i + 1] * 1.1, 255);
                data[i + 2] *= 0.9;
            }
            break;
            
        case 'blur':
            const w = imageData.width;
            const h = imageData.height;
            const copy = new Uint8ClampedArray(data);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    for (let c = 0; c < 3; c++) {
                        let sum = 0;
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                const idx = ((y + dy) * w + (x + dx)) * 4 + c;
                                sum += copy[idx];
                            }
                        }
                        const idx = (y * w + x) * 4 + c;
                        data[idx] = sum / 9;
                    }
                }
            }
            break;

        case 'neon':
            for (let i = 0; i < data.length; i += 4) {
                // Increase brightness and contrast
                data[i] = Math.min(data[i] * 1.5, 255);     // Red
                data[i + 1] = Math.min(data[i + 1] * 1.5, 255); // Green
                data[i + 2] = Math.min(data[i + 2] * 1.5, 255); // Blue
                
                // Add glow effect
                if (data[i] > 200 || data[i + 1] > 200 || data[i + 2] > 200) {
                    data[i] = Math.min(data[i] * 1.2, 255);
                    data[i + 1] = Math.min(data[i + 1] * 1.2, 255);
                    data[i + 2] = Math.min(data[i + 2] * 1.2, 255);
                }
            }
            break;

        case 'rainbow':
            for (let i = 0; i < data.length; i += 4) {
                const pixelX = (i / 4) % imageData.width;
                const pixelY = Math.floor((i / 4) / imageData.width);
                const hue = (pixelX + pixelY) % 360;
                
                // Convert HSV to RGB
                const h = hue / 60;
                const s = 1;
                const v = 1;
                
                const c = v * s;
                const x = c * (1 - Math.abs(h % 2 - 1));
                const m = v - c;
                
                let r, g, b;
                if (h < 1) { r = c; g = x; b = 0; }
                else if (h < 2) { r = x; g = c; b = 0; }
                else if (h < 3) { r = 0; g = c; b = x; }
                else if (h < 4) { r = 0; g = x; b = c; }
                else if (h < 5) { r = x; g = 0; b = c; }
                else { r = c; g = 0; b = x; }
                
                data[i] = (r + m) * 255;
                data[i + 1] = (g + m) * 255;
                data[i + 2] = (b + m) * 255;
            }
            break;

        case 'posterize':
            const levels = 4;
            const step = 255 / (levels - 1);
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.round(data[i] / step) * step;
                data[i + 1] = Math.round(data[i + 1] / step) * step;
                data[i + 2] = Math.round(data[i + 2] / step) * step;
            }
            break;

        case 'emboss':
            const embossWidth = imageData.width;
            const embossHeight = imageData.height;
            const embossCopy = new Uint8ClampedArray(data);
            for (let y = 1; y < embossHeight - 1; y++) {
                for (let x = 1; x < embossWidth - 1; x++) {
                    for (let c = 0; c < 3; c++) {
                        const idx = (y * embossWidth + x) * 4 + c;
                        const topLeft = embossCopy[((y - 1) * embossWidth + (x - 1)) * 4 + c];
                        const bottomRight = embossCopy[((y + 1) * embossWidth + (x + 1)) * 4 + c];
                        data[idx] = 128 + (topLeft - bottomRight);
                    }
                }
            }
            break;

        case 'sketch':
            // First convert to grayscale
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            
            // Then apply edge detection
            const sketchWidth = imageData.width;
            const sketchHeight = imageData.height;
            const sketchCopy = new Uint8ClampedArray(data);
            for (let y = 1; y < sketchHeight - 1; y++) {
                for (let x = 1; x < sketchWidth - 1; x++) {
                    const idx = (y * sketchWidth + x) * 4;
                    const top = sketchCopy[((y - 1) * sketchWidth + x) * 4];
                    const bottom = sketchCopy[((y + 1) * sketchWidth + x) * 4];
                    const left = sketchCopy[(y * sketchWidth + (x - 1)) * 4];
                    const right = sketchCopy[(y * sketchWidth + (x + 1)) * 4];
                    
                    const diff = Math.abs(top - bottom) + Math.abs(left - right);
                    const value = 255 - Math.min(diff, 255);
                    
                    data[idx] = data[idx + 1] = data[idx + 2] = value;
                }
            }
            break;

        case 'warm':
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(data[i] * 1.2, 255);     // Increase red
                data[i + 1] = Math.min(data[i + 1] * 1.1, 255); // Slightly increase green
                data[i + 2] *= 0.9; // Decrease blue
            }
            break;

        case 'cool':
            for (let i = 0; i < data.length; i += 4) {
                data[i] *= 0.9; // Decrease red
                data[i + 1] = Math.min(data[i + 1] * 1.1, 255); // Slightly increase green
                data[i + 2] = Math.min(data[i + 2] * 1.2, 255); // Increase blue
            }
            break;
    }
    
    return imageData;
}

// Add logout functionality
document.getElementById('logout').addEventListener('click', () => {
    // Stop video if it's running
    if (isStreaming) {
        stopVideo();
    }
    // Clear login state
    localStorage.removeItem('isLoggedIn');
    // Redirect to login page
    window.location.href = 'login.html';
});

// Initialize filter history when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    filterHistory = new FilterHistory();
    loadPhotosFromLocalStorage(); // Load saved photos
});

// Initialize filter history
let recentFilters = [];

// Update the filter selection handler
document.getElementById('filter').addEventListener('change', function(e) {
    currentFilter = e.target.value;
    console.log('Filter selected:', currentFilter);
    
    // Clear the canvas when changing filters
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save the filter to history
    if (filterHistory) {
        filterHistory.saveFilter(currentFilter);
    }
    
    // Add to recent filters
    addToRecentFilters(currentFilter);
});

function addToRecentFilters(filter) {
    // Remove filter if it already exists
    recentFilters = recentFilters.filter(f => f.name !== filter);
    
    // Add new filter at the beginning
    recentFilters.unshift({
        name: filter,
        timestamp: new Date()
    });
    
    // Keep only the last 5 filters
    if (recentFilters.length > 5) {
        recentFilters.pop();
    }
    
    // Update the UI
    updateRecentFiltersUI();
}

function updateRecentFiltersUI() {
    const filterList = document.querySelector('.filter-list');
    filterList.innerHTML = '';
    
    recentFilters.forEach(filter => {
        const li = document.createElement('li');
        li.className = 'filter-item';
        
        const timeAgo = getTimeAgo(filter.timestamp);
        
        li.innerHTML = `
            <span class="filter-name" data-filter="${filter.name}">${getFilterDisplayName(filter.name)}</span>
            <span class="filter-timestamp">${timeAgo}</span>
        `;
        
        // Add click handler to apply filter
        li.querySelector('.filter-name').addEventListener('click', () => {
            document.getElementById('filter').value = filter.name;
            // Trigger change event
            document.getElementById('filter').dispatchEvent(new Event('change'));
        });
        
        filterList.appendChild(li);
    });
}

function getFilterDisplayName(filterName) {
    const displayNames = {
        'none': 'No Filter',
        'grayscale': 'Grayscale',
        'sepia': 'Sepia',
        'invert': 'Invert',
        'red': 'Red Tint',
        'blue': 'Blue Tint',
        'green': 'Green Tint',
        'vintage': 'Vintage',
        'blur': 'Blur',
        'pixelate': 'Pixelate',
        'mirror': 'Mirror',
        'neon': 'Neon Glow',
        'rainbow': 'Rainbow',
        'posterize': 'Posterize',
        'emboss': 'Emboss',
        'sketch': 'Sketch',
        'warm': 'Warm Tone',
        'cool': 'Cool Tone'
    };
    return displayNames[filterName] || filterName;
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 120) return '1 min ago';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 7200) return '1 hour ago';
    return `${Math.floor(seconds / 3600)} hours ago`;
}

// Add these event listeners at the top of your script
document.getElementById('captureBtn').addEventListener('click', capturePhoto);
document.getElementById('downloadBtn').addEventListener('click', downloadPhoto);

// Update the capturePhoto function
function capturePhoto() {
    if (!isStreaming) {
        showNotification('Please start the camera first!', 'error');
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    // Draw the current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Apply the current filter if any
    if (currentFilter !== 'none') {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const filteredData = applyFilter(imageData, currentFilter);
        ctx.putImageData(filteredData, 0, 0);
    }
    
    // Convert to base64
    const photoData = canvas.toDataURL('image/jpeg');
    
    // Add to captured photos array
    capturedPhotos.unshift({
        data: photoData,
        timestamp: new Date().toLocaleTimeString(),
        filter: currentFilter
    });
    
    // Keep only the last 5 photos
    if (capturedPhotos.length > MAX_PHOTOS) {
        capturedPhotos.pop();
    }
    
    // Update the gallery
    updatePhotoGallery();
    
    // Show success message
    showNotification('Photo captured successfully!', 'success');
    
    // Save to localStorage
    savePhotosToLocalStorage();
}

// Add function to save photos to localStorage
function savePhotosToLocalStorage() {
    try {
        localStorage.setItem('capturedPhotos', JSON.stringify(capturedPhotos));
    } catch (error) {
        console.error('Error saving photos to localStorage:', error);
        showNotification('Error saving photos to storage', 'error');
    }
}

// Add function to load photos from localStorage
function loadPhotosFromLocalStorage() {
    try {
        const savedPhotos = localStorage.getItem('capturedPhotos');
        if (savedPhotos) {
            capturedPhotos = JSON.parse(savedPhotos);
            updatePhotoGallery();
        }
    } catch (error) {
        console.error('Error loading photos from localStorage:', error);
        showNotification('Error loading saved photos', 'error');
    }
}

// Update the showNotification function to handle different types
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function downloadPhoto() {
    if (capturedPhotos.length === 0) {
        alert('No photos to download!');
        return;
    }
    
    const latestPhoto = capturedPhotos[0];
    const link = document.createElement('a');
    link.href = latestPhoto.data;
    link.download = `photo_${new Date().getTime()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Photo downloaded successfully!');
}

function updatePhotoGallery() {
    const galleryGrid = document.querySelector('.gallery-grid');
    galleryGrid.innerHTML = '';
    
    if (capturedPhotos.length === 0) {
        galleryGrid.innerHTML = '<div class="no-photos">No photos captured yet</div>';
        return;
    }
    
    capturedPhotos.forEach(photo => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        const img = document.createElement('img');
        img.src = photo.data;
        img.alt = 'Captured photo';
        
        const timestamp = document.createElement('div');
        timestamp.className = 'timestamp';
        timestamp.textContent = `${photo.timestamp} - ${photo.filter}`;
        
        item.appendChild(img);
        item.appendChild(timestamp);
        galleryGrid.appendChild(item);
    });
}

document.querySelector('.gallery-grid').addEventListener('click', (e) => {
    const galleryItem = e.target.closest('.gallery-item');
    if (galleryItem) {
        const img = galleryItem.querySelector('img');
        if (img) {
            // Show the image in a larger view or download it
            window.open(img.src, '_blank');
        }
    }
}); 
