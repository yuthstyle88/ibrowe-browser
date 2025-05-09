// Copyright (c) 2025 The iBrowe Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at http://mozilla.org/MPL/2.0/.

const fs = require('fs')
const Log = require('../lib/logging')
const path = require('path')
const { spawnSync } = require('child_process')
const util = require('../lib/util')
Log.progress('Performing initial checkout of brave-core')

const braveCoreDir = path.resolve(__dirname, '..', 'src', 'brave')
const ibroweCoreDir = path.resolve(__dirname, '..', 'src', 'ibrowe')
const braveCoreRef = util.getProjectVersion('brave-core')
const ibroweCoreRef = util.getProjectVersion('ibrowe-core')



if (!fs.existsSync(path.join(ibroweCoreDir, '.git'))) {
  Log.status(`Cloning brave-core [${ibroweCoreRef}] into ${ibroweCoreDir}...`)
  fs.mkdirSync(ibroweCoreDir)
  util.runGit(ibroweCoreDir, ['clone', util.getNPMConfig(['projects', 'ibrowe-core', 'repository', 'url']), '.'])
  util.runGit(ibroweCoreDir, ['checkout', ibroweCoreRef])
}

if (!fs.existsSync(path.join(braveCoreDir, '.git'))) {
  Log.status(`Cloning brave-core [${braveCoreRef}] into ${braveCoreDir}...`)
  fs.mkdirSync(braveCoreDir)
  util.runGit(braveCoreDir, ['clone', util.getNPMConfig(['projects', 'brave-core', 'repository', 'url']), '.'])
  util.runGit(braveCoreDir, ['checkout', braveCoreRef])
}

const braveCoreSha = util.runGit(braveCoreDir, ['rev-parse', 'HEAD'])
Log.progress(`brave-core repo at ${braveCoreDir} is at commit ID ${braveCoreSha}`)

const ibroweSha = util.runGit(ibroweCoreDir, ['rev-parse', 'HEAD'])
Log.progress(`ibrowe-core repo at ${ibroweCoreDir} is at commit ID ${ibroweSha}`)
console.log('Running npm install in ibrowe-core...')
let npmCommand = 'npm'
if (process.platform === 'win32') {
  npmCommand += '.cmd'
}
util.run(npmCommand, ['install'], { cwd: braveCoreDir })

const copyFileToBravePath = path.resolve(__dirname, '..', 'src', 'ibrowe', 'scripts', 'copyFileToBrave.js')
const { copyFileToBrave } = require(copyFileToBravePath)
console.log('Running copyFileToBrave')

copyFileToBrave()

//Load after clone brave core
const { applyIBrowePatches } = require('./applyIBrowePatches')
console.log('Running runApplyPatches')
Promise.all([
  applyIBrowePatches(),
]).then(() => {

  util.run(npmCommand, ['run', 'sync' ,'--', '--init'].concat(process.argv.slice(2)), {
    cwd: braveCoreDir,
    env: process.env,
    stdio: 'inherit',
    shell: true,
    git_cwd: '.', })
})
    .catch(err => {
      console.error('Error apply patch files:')
      console.error(err)})



