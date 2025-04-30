const fs = require('fs')
const Log = require('./logging')
const { spawnSync } = require('child_process')
const path = require('path')

// ============================================================================
// NPM Configuration Helpers
// ============================================================================

// This is the valid way of retrieving configuration values for NPM <= 6, with
// npm_package_config_* still working up to NPM 7, but no longer for NPM >= 8.
// See https://github.com/npm/rfcs/blob/main/implemented/0021-reduce-lifecycle-script-environment.md
const getNPMConfigFromEnv = (path) => {
  const key = path.join('_')
  // Npm <= 6 did not preserve dashes in package.json keys
  const keyNoDashes = key.replace('-', '_')
  const npm_prefix = 'npm_config_'
  const package_config_prefix = 'npm_package_config_'
  const package_prefix = 'npm_package_'
  return process.env[npm_prefix + keyNoDashes] ||
    process.env[package_config_prefix + keyNoDashes] ||
    process.env[package_config_prefix + key] ||
    process.env[package_prefix + keyNoDashes] ||
    process.env[package_prefix + key]
}

// From NPM >= 8, we need to inspect the package.json file, which should
// be available via the 'npm_package_json' environment variable.
const getNPMConfigFromPackageJson = (path) => {
  let packages = { config: {} }
  if (fs.existsSync(process.env['npm_package_json'])) {
    packages = require(process.env['npm_package_json'])
  }

  let obj = packages.config
  for (var i = 0, len = path.length; i < len; i++) {
    if (!obj) {
      return obj
    }
    obj = obj[path[i]]
  }
  return obj
}

const getNPMConfig = (path) => {
  return getNPMConfigFromEnv(path) || getNPMConfigFromPackageJson(path)
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
  if (prog.status !== 0) {
    if (!continueOnFail) {
      console.log(prog.stdout && prog.stdout.toString())
      console.error(prog.stderr && prog.stderr.toString())
      process.exit(1)
    }
  }
  return prog
}

/**
 * Execute git command
 */
const runGit = (repoPath, gitArgs, continueOnFail = false) => {
  let prog = run('git', gitArgs, { cwd: repoPath, continueOnFail })

  if (prog.status !== 0) {
    return null
  } else {
    return prog.stdout.toString().trim()
  }
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
 * Recursively copies files from source to destination directory
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 * @param {Object} options - Copy options
 * @param {boolean} options.createDest - Whether to create destination directory if it doesn't exist
 * @param {boolean} options.overwrite - Whether to overwrite existing files
 * @param {boolean} options.verbose - Whether to log operations
 */
const copyRecursiveSync = (src, dest, options = {}) => {
  const {
    createDest = false,
    overwrite = false,
    verbose = true
  } = options;

  if (!fs.existsSync(src)) {
    Log.error(`Source not found: '${src}'`);
    return false;
  }

  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      if (createDest) {
        fs.mkdirSync(dest, { recursive: true });
        if (verbose) Log.status(`Created directory: ${dest}`);
      } else {
        Log.error(`Destination directory not found: '${dest}'`);
        return false;
      }
    }

    const files = fs.readdirSync(src);
    let success = true;
    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      success = copyRecursiveSync(srcPath, destPath, options) && success;
    }
    return success;
  } else {
    if (!fs.existsSync(path.dirname(dest))) {
      if (createDest) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
      } else {
        Log.error(`Destination directory not found: '${path.dirname(dest)}'`);
        return false;
      }
    }

    const shouldCopy = overwrite || !fs.existsSync(dest) || 
      calculateFileChecksum(src) !== calculateFileChecksum(dest);

    if (shouldCopy) {
      try {
        fs.copyFileSync(src, dest);
        if (verbose) Log.status(`Copied: ${src} -> ${dest}`);
        return true;
      } catch (error) {
        Log.error(`Failed to copy ${src}: ${error.message}`);
        return false;
      }
    }
    return true;
  }
}

/**
 * Copies all necessary files from ibrowe to brave directory
 * @param {string} srcDir - Source directory path
 * @returns {boolean} Whether all files were copied successfully
 */
const copyFileToBrave = (srcDir) => {
  const ibroweImages = path.resolve(srcDir, 'ibrowe', 'src', 'images');
  const ibroweTranslates = path.resolve(srcDir, 'ibrowe', 'src', 'translates');
  const braveCoreDir = path.resolve(srcDir, 'brave');

  const options = {
    createDest: true,
    overwrite: true,
    verbose: true
  };

  // Copy contents of images directory
  const imagesSuccess = copyRecursiveSync(ibroweImages, braveCoreDir, options);
  
  // Copy contents of translates directory
  const translatesSuccess = copyRecursiveSync(ibroweTranslates, braveCoreDir, options);

  if (imagesSuccess && translatesSuccess) {
    Log.status('Successfully copied all files from ibrowe to brave directory');
  } else {
    Log.error('Failed to copy some files from ibrowe to brave directory');
  }

  return imagesSuccess && translatesSuccess;
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
