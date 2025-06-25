// Copyright (c) 2025 The iBrowe Authors.
// Licensed under the Mozilla Public License v2.0

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const Log = require('../lib/logging')
const util = require('../lib/util')

Log.progress('Performing initial checkout of brave-core')

const braveCoreDir = path.resolve(__dirname, '..', 'src', 'brave')
const ibroweCoreDir = path.resolve(__dirname, '..', 'src', 'ibrowe')
const braveCoreRef = util.getProjectVersion('brave-core')
const ibroweCoreRef = util.getProjectVersion('ibrowe-core')

// Clone ibrowe-core if needed
if (!fs.existsSync(path.join(ibroweCoreDir, '.git'))) {
  Log.status(`Cloning ibrowe-core [${ibroweCoreRef}] into ${ibroweCoreDir}...`)
  fs.mkdirSync(ibroweCoreDir, { recursive: true })
  util.runGit(ibroweCoreDir, [
    'clone',
    util.getNPMConfig(['projects', 'ibrowe-core', 'repository', 'url']),
    '.',
  ])
  util.runGit(ibroweCoreDir, ['checkout', ibroweCoreRef])
}

// Clone brave-core if needed
if (!fs.existsSync(path.join(braveCoreDir, '.git'))) {
  Log.status(`Cloning brave-core [${braveCoreRef}] into ${braveCoreDir}...`)
  fs.mkdirSync(braveCoreDir, { recursive: true })
  util.runGit(braveCoreDir, [
    'clone',
    util.getNPMConfig(['projects', 'brave-core', 'repository', 'url']),
    '.',
  ])
  util.runGit(braveCoreDir, ['checkout', braveCoreRef])
}

// Log current commit SHAs
const braveCoreSha = util.runGit(braveCoreDir, ['rev-parse', 'HEAD'])
Log.progress(`brave-core repo at ${braveCoreDir} is at commit ID ${braveCoreSha}`)

const ibroweSha = util.runGit(ibroweCoreDir, ['rev-parse', 'HEAD'])
Log.progress(`ibrowe-core repo at ${ibroweCoreDir} is at commit ID ${ibroweSha}`)

// Run npm install
console.log('Running npm install in brave-core...')
let npmCommand = 'npm'
if (process.platform === 'win32') {
  npmCommand += '.cmd'
}

const result = spawnSync(npmCommand, ['install'], {
  cwd: braveCoreDir,
  stdio: 'inherit',
  shell: true
})

if (result.error) {
  console.error('Failed to run npm install:', result.error)
  process.exit(1)
}
if (result.status !== 0) {
  console.error(`npm install exited with code ${result.status}`)
  process.exit(result.status)
}

// Load and run custom file copy
console.log('Running copyFileToBrave...')
const copyFileToBravePath = path.resolve(
    __dirname,
    '..',
    'src',
    'ibrowe',
    'scripts',
    'copyFileToBrave.js'
)
const { copyFileToBrave } = require(copyFileToBravePath)
copyFileToBrave()

// Apply patches
console.log('Running runApplyPatches...')
const { applyIBrowePatches } = require('./applyIBrowePatches')

applyIBrowePatches()
    .then(() => {
      // Final sync step
      console.log('Running npm run sync -- --init')
      const syncResult = spawnSync(npmCommand, ['run', 'sync', '--', '--init', ...process.argv.slice(2)], {
        cwd: braveCoreDir,
        env: process.env,
        stdio: 'inherit',
        shell: true
      })

      if (syncResult.error) {
        console.error('Failed to run npm run sync:', syncResult.error)
        process.exit(1)
      }
      if (syncResult.status !== 0) {
        console.error(`npm run sync exited with code ${syncResult.status}`)
        process.exit(syncResult.status)
      }
    })
    .catch((err) => {
      console.error('Error applying patch files:')
      console.error(err)
      process.exit(1)
    })