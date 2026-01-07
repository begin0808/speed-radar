const fs = require('fs');
const path = require('path');

// File Paths
const CAMERAS_FILE = 'cameras.json';
const FIXES_FILE = 'camera_fixes.json';
const OUTPUT_FILE = 'cameras_updated.json';

// Main Logic
try {
    console.log("Loading files...");

    if (!fs.existsSync(CAMERAS_FILE)) {
        console.error(`Error: ${CAMERAS_FILE} not found.`);
        process.exit(1);
    }
    if (!fs.existsSync(FIXES_FILE)) {
        console.error(`Error: ${FIXES_FILE} not found.`);
        process.exit(1);
    }

    const cameras = JSON.parse(fs.readFileSync(CAMERAS_FILE, 'utf8'));
    const fixes = JSON.parse(fs.readFileSync(FIXES_FILE, 'utf8'));

    console.log(`Original Cameras: ${cameras.length}`);
    console.log(`Fixes found: ${Object.keys(fixes).length}`);

    let updateCount = 0;

    // Apply fixes
    // Fixes format: { "ID": { direction: 123 }, ... }
    // Cameras format: [ { id: "...", ... }, ... ] or [ { ... }, ... ]
    
    // Note: cameras.json might not have IDs in the source. 
    // The App generates IDs on the fly: C_lat_lng.
    // We need to match by ID if it exists, OR by approximate Lat/Lng if strictly needed.
    // However, if the user exported the fixes from the App, the keys ARE the generated IDs.
    // But the original cameras.json DOES NOT HAVE these generated IDs permanently stored usually.
    
    // Strategy:
    // 1. If cameras.json items HAVE 'id', match directly.
    // 2. If not, generate the SAME ID logic as the App to find the match.
    
    const updatedCameras = cameras.map(cam => {
        // App Logic for ID: item.id || \`C_\${lat.toFixed(5)}_\${lng.toFixed(5)}\`
        const lat = parseFloat(cam.lat || cam.Latitude); // Handle different naming if needed
        const lng = parseFloat(cam.lng || cam.Longitude); // Handle different naming if needed
        
        let camId = cam.id;
        if (!camId && !isNaN(lat) && !isNaN(lng)) {
             camId = `C_${lat.toFixed(5)}_${lng.toFixed(5)}`;
        }

        if (camId && fixes[camId]) {
            const fix = fixes[camId];
            if (fix.direction !== undefined) {
                cam.direction = fix.direction; // Apply new direction
                // Optional: cam.direct = "..."; // Update text description if you want
                updateCount++;
            }
        }
        return cam;
    });

    console.log(`Updated ${updateCount} cameras.`);

    // Write output
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(updatedCameras, null, 2), 'utf8');
    
    console.log(`Success! Saved to ${OUTPUT_FILE}`);
    console.log(`Please rename ${OUTPUT_FILE} to ${CAMERAS_FILE} to apply changes permanently.`);

} catch (err) {
    console.error("An error occurred:", err);
}
