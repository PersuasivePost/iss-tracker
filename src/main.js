import './style.css';
import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- CONFIGURATION ---
const ISS_API_URL = import.meta.env.VITE_ISS_API_URL; // ISS API from environment variables
const ISS_MODEL_PATH = '/ISS_stationary.glb'; // Place your .glb file in the 'public' folder
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN; // Mapbox token from environment variables

// Check if required environment variables are loaded
if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN') {
    console.error('❌ Missing Mapbox access token! Please set VITE_MAPBOX_ACCESS_TOKEN in your .env file');
    alert('Missing Mapbox access token! Please check your .env file.');
}

if (!ISS_API_URL) {
    console.error('❌ Missing ISS API URL! Please set VITE_ISS_API_URL in your .env file');
}

// --- INITIALIZE MAPBOX GLOBE ---
mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-v9', // Satellite style
    projection: 'globe', // Display the map as a 3D globe
    zoom: 1.5,
    center: [0, 0],
    // Mobile-optimized settings
    touchZoomRotate: true,
    touchPitch: true,
    dragRotate: true,
    pitchWithRotate: true,
    doubleClickZoom: true,
    // Performance and analytics settings
    collectResourceTiming: false,
    crossSourceCollisions: false,
    renderWorldCopies: false,
    // Responsive zoom limits
    minZoom: 0.5,
    maxZoom: 10,
    // Better interaction for touch devices
    cooperativeGestures: false
});

// Disable Mapbox telemetry completely
map.on('load', () => {
    // Disable all telemetry events
    if (map._requestManager) {
        map._requestManager._skuToken = null;
    }
});

// Add atmosphere and lighting to the globe
map.on('style.load', () => {
    map.setFog({
        color: 'rgb(24, 24, 36)', // Lower atmosphere
        'high-color': 'rgb(7, 7, 25)', // Upper atmosphere
        'horizon-blend': 0.02, // Blending
        'space-color': 'rgb(1, 1, 10)', // Space color
        'star-intensity': 0.6 // Star intensity
    });
});

// --- THREE.JS CUSTOM LAYER FOR THE ISS MODEL ---

// The custom layer we'll add to Mapbox to render the ISS
const issCustomLayer = {
    id: 'iss-layer',
    type: 'custom',
    renderingMode: '3d',

    // `onAdd` is called when the layer is added to the map.
    onAdd: function (map, gl) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();

        // Add lighting to the Three.js scene
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 3, 5);
        this.scene.add(directionalLight);
        
        // Add a simple test cube to verify Three.js is working
        const testGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const testMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFF00FF,
            transparent: false
        });
        this.testCube = new THREE.Mesh(testGeometry, testMaterial);
        this.scene.add(this.testCube);
        console.log('🧪 Added magenta test cube for verification');
        
        // Load the GLB ISS model with comprehensive debugging
        const loader = new GLTFLoader();
        console.log('🚀 Starting ISS GLB model loading from:', ISS_MODEL_PATH);
        
        loader.load(
            ISS_MODEL_PATH,
            (gltf) => {
                console.log('📦 GLB file loaded, processing model...');
                
                this.issModel = gltf.scene;
                
                // Count all objects in the model
                let meshCount = 0;
                this.issModel.traverse((child) => {
                    if (child.isMesh) meshCount++;
                });
                
                console.log('🔍 Model analysis:');
                console.log('   - Total children:', gltf.scene.children.length);
                console.log('   - Mesh objects:', meshCount);
                
                // Get original bounding box
                const box = new THREE.Box3().setFromObject(this.issModel);
                const size = box.getSize(new THREE.Vector3());
                console.log('   - Original size:', size);
                
                // Apply scale for visibility - try multiple scales to ensure visibility
                const targetScale = 0.1; // Start with smaller scale and increase if needed
                this.issModel.scale.setScalar(targetScale);
                console.log('   - Applied scale:', targetScale);
                
                // Also try creating a simple visible object if GLB is too complex
                const simpleGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
                const simpleMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
                const simpleISS = new THREE.Mesh(simpleGeometry, simpleMaterial);
                this.issModel.add(simpleISS);
                console.log('   - Added simple red cube for visibility');
                
                // Center the model properly
                box.setFromObject(this.issModel);
                const center = box.getCenter(new THREE.Vector3());
                this.issModel.position.sub(center);
                
                // Make ALL materials VERY visible
                this.issModel.traverse((child) => {
                    if (child.isMesh) {
                        if (child.material) {
                            // Convert to basic material for maximum visibility
                            if (Array.isArray(child.material)) {
                                child.material.forEach((mat, index) => {
                                    mat.color = new THREE.Color(0xFFFFFF);
                                    mat.emissive = new THREE.Color(0x444444);
                                    mat.emissiveIntensity = 0.5;
                                    mat.transparent = false;
                                    mat.opacity = 1.0;
                                });
                            } else {
                                child.material.color = new THREE.Color(0xFFFFFF);
                                child.material.emissive = new THREE.Color(0x444444);
                                child.material.emissiveIntensity = 0.5;
                                child.material.transparent = false;
                                child.material.opacity = 1.0;
                            }
                        }
                    }
                });
                
                // Add a bright wireframe for debugging
                const wireframeGeometry = new THREE.BoxGeometry(2, 2, 2);
                const wireframeMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x00FF00, 
                    wireframe: true 
                });
                const debugBox = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
                this.issModel.add(debugBox);
                
                // Add the model to the scene
                this.scene.add(this.issModel);
                
                console.log('✅ ISS GLB model added to scene successfully');
                console.log('🌟 All materials enhanced for maximum visibility');
                console.log('📦 Added debug wireframe box');
            },
            (progress) => {
                const percentage = Math.round((progress.loaded / progress.total) * 100);
                console.log(`📥 Loading ISS model: ${percentage}% (${progress.loaded}/${progress.total} bytes)`);
            },
            (error) => {
                console.error('❌ CRITICAL: Failed to load ISS GLB model:', error);
                console.log('🔄 Falling back to procedural model...');
                
                // Fallback to procedural model
                this.issModel = this.createISSModel();
                this.scene.add(this.issModel);
                console.log('✅ Fallback procedural model created and added');
            }
        );

        this.map = map;
        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true,
        });
        this.renderer.autoClear = false;
    },

    // Create a procedural ISS model using Three.js primitives
    createISSModel: function() {
        const issGroup = new THREE.Group();
        
        // Main body (central truss) - Made larger and brighter
        const bodyGeometry = new THREE.BoxGeometry(4, 0.6, 0.6);
        const bodyMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFFFF,
            emissive: 0x333333 // Add some glow
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        issGroup.add(body);
        
        // Solar panels (4 panels) - Made larger and more visible
        const panelGeometry = new THREE.BoxGeometry(3, 0.1, 1.6);
        const panelMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0066FF,
            emissive: 0x001133 // Blue glow for panels
        });
        
        // Left solar panels
        const leftPanel1 = new THREE.Mesh(panelGeometry, panelMaterial);
        leftPanel1.position.set(-3, 0.8, 0);
        issGroup.add(leftPanel1);
        
        const leftPanel2 = new THREE.Mesh(panelGeometry, panelMaterial);
        leftPanel2.position.set(-3, -0.8, 0);
        issGroup.add(leftPanel2);
        
        // Right solar panels
        const rightPanel1 = new THREE.Mesh(panelGeometry, panelMaterial);
        rightPanel1.position.set(3, 0.8, 0);
        issGroup.add(rightPanel1);
        
        const rightPanel2 = new THREE.Mesh(panelGeometry, panelMaterial);
        rightPanel2.position.set(3, -0.8, 0);
        issGroup.add(rightPanel2);
        
        // Modules (Destiny, Kibo, Columbus) - Made larger
        const moduleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.6);
        const moduleMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFFFF,
            emissive: 0x222222
        });
        
        const module1 = new THREE.Mesh(moduleGeometry, moduleMaterial);
        module1.rotation.z = Math.PI / 2;
        module1.position.set(1, 0, 0.6);
        issGroup.add(module1);
        
        const module2 = new THREE.Mesh(moduleGeometry, moduleMaterial);
        module2.rotation.z = Math.PI / 2;
        module2.position.set(-1, 0, 0.6);
        issGroup.add(module2);
        
        // Add a bright marker for visibility
        const markerGeometry = new THREE.SphereGeometry(0.2);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xFF0000,
            emissive: 0xFF0000 // Bright red marker
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(0, 0, 1);
        issGroup.add(marker);
        
        // Scale the entire model - Made much larger for visibility
        issGroup.scale.set(0.1, 0.1, 0.1);
        
        return issGroup;
    },
    
    // `render` is called on every frame
    render: function (gl, matrix) {
        if (!this.issModel) {
            // Only log this occasionally to avoid spam
            if (Math.random() < 0.01) {
                console.log('⏸️ Render skipped - ISS model not loaded yet');
            }
            return;
        }

        const position = this.issPosition || { lng: 0, lat: 0 };
        
        // Use higher altitude for better visibility
        const altitude = 800000; // 800km altitude for visibility
        const modelAsMercator = mapboxgl.MercatorCoordinate.fromLngLat(
            position,
            altitude
        );

        // Simplified transformation matrix
        const modelTransform = {
            translateX: modelAsMercator.x,
            translateY: modelAsMercator.y,
            translateZ: modelAsMercator.z || 0,
            scale: modelAsMercator.meterInMercatorCoordinateUnits()
        };

        // Log transformation details occasionally
        if (Math.random() < 0.001) { // Very occasionally
            console.log('🎯 Render transform:', {
                position: position,
                mercator: modelAsMercator,
                scale: modelTransform.scale
            });
        }

        // Create transformation matrix
        const modelMatrix = new THREE.Matrix4()
            .makeTranslation(
                modelTransform.translateX,
                modelTransform.translateY,
                modelTransform.translateZ
            )
            .scale(new THREE.Vector3(
                modelTransform.scale,
                -modelTransform.scale,
                modelTransform.scale
            ));

        // Apply the matrix transformation
        this.issModel.matrix = new THREE.Matrix4()
            .fromArray(matrix)
            .multiply(modelMatrix);
        
        this.issModel.matrixAutoUpdate = false;
        
        // Also position the test cube at the same location for comparison
        if (this.testCube) {
            this.testCube.matrix = new THREE.Matrix4()
                .fromArray(matrix)
                .multiply(modelMatrix);
            this.testCube.matrixAutoUpdate = false;
        }

        // Set camera projection
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
        
        // Render the scene
        this.renderer.state.reset();
        this.renderer.render(this.scene, this.camera);
        
        // Trigger repaint
        this.map.triggerRepaint();
    }
};

// Add the custom layer to the map once it's loaded
map.on('load', () => {
    map.addLayer(issCustomLayer);
    
    // Add a marker source for ISS ground track
    map.addSource('iss-marker', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [0, 0]
            }
        }
    });
    
    // Add a visual marker layer
    map.addLayer({
        id: 'iss-marker-layer',
        source: 'iss-marker',
        type: 'circle',
        paint: {
            'circle-radius': 8,
            'circle-color': '#FF0000',
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 2,
            'circle-opacity': 0.8
        }
    });
});


// --- FETCH REAL-TIME ISS DATA AND UPDATE POSITION ---

async function fetchIssPosition() {
    try {
        const response = await fetch(ISS_API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const data = await response.json();
        const issPosition = {
            lng: parseFloat(data.longitude),
            lat: parseFloat(data.latitude)
        };
        
        // Validate coordinates
        if (isNaN(issPosition.lng) || isNaN(issPosition.lat)) {
            throw new Error('Invalid coordinates received from API');
        }
        
        // Update the custom layer's issPosition property
        issCustomLayer.issPosition = issPosition;
        
        // Update ground marker
        if (map.getSource('iss-marker')) {
            map.getSource('iss-marker').setData({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [issPosition.lng, issPosition.lat]
                }
            });
        }
        
        // Follow ISS if enabled (otherwise don't auto-follow)
        if (typeof isFollowingISS !== 'undefined' && isFollowingISS) {
            map.easeTo({ 
                center: [issPosition.lng, issPosition.lat], 
                zoom: Math.max(map.getZoom(), 3),
                duration: 1000 
            });
        }
        
        // Update UI elements
        updateISSInfo(issPosition);
        
        // Update status indicator
        updateStatusIndicator('connected', 'ISS Connected');
        
        // Trigger a repaint to move the model
        map.triggerRepaint();

        console.log(`🛰️ ISS Position: ${issPosition.lat.toFixed(4)}°, ${issPosition.lng.toFixed(4)}° | Altitude: ~408km`);

    } catch (error) {
        console.error('❌ Error fetching ISS position:', error);
        updateStatusIndicator('error', 'Connection Error');
    }
}

// Fetch the position immediately and then every 2 seconds
fetchIssPosition();
setInterval(fetchIssPosition, 2000);

// --- RESPONSIVE UI CONTROLS ---

// UI Elements
const menuToggle = document.getElementById('menuToggle');
const infoPanel = document.getElementById('infoPanel');
const closePanel = document.getElementById('closePanel');
const followISSBtn = document.getElementById('followISS');
const resetViewBtn = document.getElementById('resetView');
const statusIndicator = document.getElementById('statusIndicator');
const loadingScreen = document.getElementById('loadingScreen');

// UI State
let isFollowingISS = false;
let panelOpen = false;

// Initialize UI
function initializeUI() {
    // Hide loading screen after map loads
    map.on('load', () => {
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
            updateStatusIndicator('connected', 'ISS Connected');
        }, 2000);
    });
    
    // Menu toggle functionality
    menuToggle.addEventListener('click', toggleInfoPanel);
    closePanel.addEventListener('click', toggleInfoPanel);
    
    // Control button functionality
    followISSBtn.addEventListener('click', toggleFollowISS);
    resetViewBtn.addEventListener('click', resetMapView);
    
    // Touch and keyboard support
    document.addEventListener('keydown', handleKeydown);
    
    // Update UI with initial status
    updateStatusIndicator('connecting', 'Connecting...');
    
    console.log('🎮 Responsive UI initialized');
}

// Toggle info panel
function toggleInfoPanel() {
    panelOpen = !panelOpen;
    infoPanel.classList.toggle('open', panelOpen);
    menuToggle.classList.toggle('active', panelOpen);
    
    // Update button text
    followISSBtn.textContent = isFollowingISS ? 'Stop Following' : 'Follow ISS';
}

// Toggle ISS following
function toggleFollowISS() {
    isFollowingISS = !isFollowingISS;
    followISSBtn.textContent = isFollowingISS ? 'Stop Following' : 'Follow ISS';
    
    if (isFollowingISS) {
        followISSBtn.style.background = '#ef4444';
        updateStatusIndicator('connected', 'Following ISS');
    } else {
        followISSBtn.style.background = '#3b82f6';
        updateStatusIndicator('connected', 'ISS Connected');
    }
    
    console.log(isFollowingISS ? '🎯 Started following ISS' : '⏹️ Stopped following ISS');
}

// Reset map view
function resetMapView() {
    map.flyTo({
        center: [0, 0],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        duration: 2000
    });
    
    isFollowingISS = false;
    followISSBtn.textContent = 'Follow ISS';
    followISSBtn.style.background = '#3b82f6';
    updateStatusIndicator('connected', 'ISS Connected');
    
    console.log('🌍 Map view reset');
}

// Update status indicator
function updateStatusIndicator(status, text) {
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');
    
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = text;
}

// Update ISS information in the panel
function updateISSInfo(issPosition) {
    if (!issPosition) return;
    
    // Update position
    const positionElement = document.getElementById('position');
    if (positionElement) {
        positionElement.textContent = `${issPosition.lat.toFixed(4)}°, ${issPosition.lng.toFixed(4)}°`;
    }
    
    // Update last update time
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        lastUpdateElement.textContent = new Date().toLocaleTimeString();
    }
}

// Keyboard controls
function handleKeydown(event) {
    switch(event.key) {
        case 'Escape':
            if (panelOpen) toggleInfoPanel();
            break;
        case 'f':
        case 'F':
            toggleFollowISS();
            break;
        case 'r':
        case 'R':
            resetMapView();
            break;
        case 'i':
        case 'I':
            toggleInfoPanel();
            break;
    }
}

// The UI update is now handled in the original fetchIssPosition function

// Handle responsive map resize
function handleResize() {
    map.resize();
}

// Add resize listener
window.addEventListener('resize', handleResize);

// Initialize responsive features
initializeUI();

console.log('📱 Responsive ISS Tracker initialized successfully!');
