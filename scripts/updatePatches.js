const path = require('path');
const updatePatches = require('../src/brave/build/commands/lib/updatePatches');

async function generateFilteredPatches() {
    const braveDir = path.join(__dirname, '../src/brave');
    const patchesDir = path.join(__dirname, '../src/ibrowe/src/patches');

    const excludeConfig = {
        // File extensions to filter
        extensions: [
            // Localization files
            '.grd', '.grdp', '.xtb', '.pak', '.strings',
            // Images
            '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp',
            '.svg', '.bmp', '.tiff', '.avif', '.icns' // Includes .icns
        ],

        // File name patterns to filter
        patterns: [
            '_resources_',
            'strings.grd',
            'generated_resources',
            'components_strings',
            'brave_strings',
            'icon',
            'image',
            'assets',
            'patchinfo' // Matches patchinfo in file names
        ],

        // Exact file names to filter (without extension)
        exactNames: [
            'patchinfo' // Matches exact file named 'patchinfo'
        ],

        // Directories to filter
        directories: [
            '/resources/',
            '/translations/',
            '/locale/',
            '/lang/',
            '/i18n/',
            '/strings/',
            '/images/',
            '/img/',
            '/icons/',
            '/assets/',
            '/media/'
        ]
    };

    const repoPathFilter = (filePath) => {
        const normalizedPath = filePath.replace(/\\/g, '/');
        const fileName = path.basename(normalizedPath).toLowerCase();
        const fileNameWithoutExt = path.basename(normalizedPath, path.extname(normalizedPath)).toLowerCase();

        // 1. Check extensions
        const ext = path.extname(normalizedPath).toLowerCase();
        if (excludeConfig.extensions.includes(ext)) {
            return false;
        }

        // 2. Check patterns
        if (excludeConfig.patterns.some(pattern => normalizedPath.toLowerCase().includes(pattern))) {
            return false;
        }

        // 3. Check exact file names
        if (excludeConfig.exactNames.includes(fileNameWithoutExt)) {
            return false;
        }

        // 4. Check directories
        if (excludeConfig.directories.some(dir => normalizedPath.includes(dir))) {
            return false;
        }

        // 5. Check .patch files
        if (normalizedPath.endsWith('.patch')) {
            const originalPath = normalizedPath.slice(0, -6);
            const originalFileNameWithoutExt = path.basename(originalPath, path.extname(originalPath)).toLowerCase();
            if (excludeConfig.extensions.some(ext => originalPath.endsWith(ext)) ||
                excludeConfig.patterns.some(pattern => originalPath.toLowerCase().includes(pattern)) ||
                excludeConfig.exactNames.includes(originalFileNameWithoutExt) ||
                excludeConfig.directories.some(dir => originalPath.includes(dir))) {
                return false;
            }
        }

        console.log(`Including file: ${filePath}`); // Debug log for included files
        return true;
    };

    try {
        console.log('Starting patch generation with filters...');
        await updatePatches(braveDir, patchesDir, [], repoPathFilter);
        console.log('Successfully generated filtered patches');
    } catch (err) {
        console.error('Error generating patches:', err);
        process.exit(1);
    }
}

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
    process.exit(1);
});

generateFilteredPatches();