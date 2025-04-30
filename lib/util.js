const fs = require('fs')
const Log = require('./logging')
const { spawnSync } = require('child_process')
const path = require('path')

// ============================================================================
// NPM Configuration Helpers
// ============================================================================

/**
 * Get NPM configuration from environment variables (NPM <= 6)
 */
const getNPMConfig = (path) => {
  const key = path.join('_').replace('-', '_')
  return process.env[`npm_config_${key}`] || 
         process.env[`npm_package_config_${key}`] ||
         process.env[`npm_package_${key}`]
}

/**
 * Get project version from NPM config
 */
const getProjectVersion = (projectName) => {
  return getNPMConfig(['projects', projectName, 'tag']) || 
         getNPMConfig(['projects', projectName, 'branch'])
}

// ============================================================================
// Command Execution Helpers
// ============================================================================

/**
 * Execute a command with options
 */
const run = (cmd, args = [], options = {}) => {
  const { continueOnFail, ...cmdOptions } = options
  Log.command(cmdOptions.cwd, cmd, args)
  const prog = spawnSync(cmd, args, cmdOptions)
  if (prog.status !== 0 && !continueOnFail) {
    console.log(prog.stdout?.toString())
    console.error(prog.stderr?.toString())
    process.exit(1)
  }
  return prog
}

/**
 * Execute git command
 */
const runGit = (repoPath, gitArgs, continueOnFail = false) => {
  const prog = run('git', gitArgs, { cwd: repoPath, continueOnFail })
  return prog.status === 0 ? prog.stdout.toString().trim() : null
}

// ============================================================================
// File System Helpers
// ============================================================================

/**
 * Calculate file checksum
 */
const calculateFileChecksum = (filePath) => {
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath).toString()
}

/**
 * Recursively copy files from source to destination
 * @param {string} src - Source path
 * @param {string} dest - Destination path
 * @param {Object} options - Copy options
 * @param {boolean} options.createDest - Create destination if missing
 * @param {boolean} options.overwrite - Overwrite existing files
 * @param {boolean} options.verbose - Log operations
 */
const copyRecursiveSync = (src, dest, options = {}) => {
  const { createDest = true, overwrite = true, verbose = true } = options

  if (!fs.existsSync(src)) {
    Log.error(`Source not found: '${src}'`)
    return false
  }

  const stats = fs.statSync(src)

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      if (createDest) {
        fs.mkdirSync(dest, { recursive: true })
        if (verbose) Log.status(`Created directory: ${dest}`)
      } else {
        Log.error(`Destination not found: '${dest}'`)
        return false
      }
    }

    return fs.readdirSync(src).every(file => 
      copyRecursiveSync(
        path.join(src, file),
        path.join(dest, file),
        options
      )
    )
  }

  if (!fs.existsSync(path.dirname(dest))) {
    if (createDest) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
    } else {
      Log.error(`Destination directory not found: '${path.dirname(dest)}'`)
      return false
    }
  }

  if (overwrite || !fs.existsSync(dest)) {
    try {
      fs.copyFileSync(src, dest)
      if (verbose) Log.status(`Copied: ${src} -> ${dest}`)
      return true
    } catch (error) {
      Log.error(`Failed to copy ${src}: ${error.message}`)
      return false
    }
  }
  return true
}

/**
 * Copy files from ibrowe to brave directory
 * @param {string} srcDir - Source directory path
 */
const copyFileToBrave = (srcDir) => {
  const paths = {
    images: {
      src: path.resolve(srcDir, 'ibrowe', 'src', 'images'),
      dest: path.join(path.resolve(srcDir, 'brave'), 'images')
    },
    translates: {
      src: path.resolve(srcDir, 'ibrowe', 'src', 'translates'),
      dest: path.join(path.resolve(srcDir, 'brave'), 'translates')
    }
  }

  return Object.values(paths).every(({ src, dest }) => 
    copyRecursiveSync(src, dest, { createDest: true, overwrite: true, verbose: true })
  )
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // NPM Configuration
  getNPMConfig,
  getProjectVersion,
  
  // Command Execution
  run,
  runGit,
  
  // File System
  copyRecursiveSync,
  copyFileToBrave
}
