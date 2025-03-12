const path = require('path');
const config = require('../src/brave/build/commands/lib/config');
const updatePatches  = require('../src/brave/build/commands/lib/updatePatches');

const braveDir = path.join(config.srcDir, 'brave');
const patchesDir = path.join(config.srcDir, 'ibrowe', 'src', 'patches');

    Promise.all([
        updatePatches(braveDir, patchesDir)
    ])
        .then(() => {
            console.log('Done.');
        })
        .catch(err => {
            console.error('Error updating patch files:');
            console.error(err);
        });

