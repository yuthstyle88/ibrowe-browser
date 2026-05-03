# macOS Build & Notarization Guide — iBrowe Browser

This document explains how to build, sign, notarize, and package iBrowe Browser for
macOS from scratch, and how to diagnose and fix every known error that can appear in
this pipeline. Written so a human or an AI can execute it without prior context.

---

## 1. Quick Reference

### Build command (from project root)
```
npm run build -- Release --target=brave/build/mac:package --notarize
```

### Output
```
src/out/Release_arm64/packaged/iBroweBrowser-<version>.dmg   ← install this
src/out/Release_arm64/packaged/iBroweBrowser-<version>.pkg   ← unsigned, ignore
src/out/Release_arm64/packaged/iBroweBrowser-<version>.zip   ← zip of the .app
```

### Key identifiers
| Item | Value |
|------|-------|
| Bundle ID | `com.ibrowe.Browser` |
| Team ID | see `.env` in project root |
| Signing cert | `Developer ID Application: 108 PLAZA COMPANY LIMITED (D8FP7GS222)` |
| Provisioning profile | `src/brave/build/mac/release.provisionprofile` (expires 2043-10-14) |
| macOS target | macOS 26 (Darwin 25.x) |

---

## 2. How the Build Pipeline Works

Understanding this prevents most errors.

### 2.1 Layer stack
```
Chromium (upstream)
  └─ Brave (patches on top of Chromium)
       └─ iBrowe (patches on top of Brave, in src/ibrowe/)
```

The build uses Brave's build system (`src/brave/`) as the orchestrator.

### 2.2 Build phases (in order)
1. **touch originals** — marks files overridden by `chromium_src/` as dirty
2. **update branding** — runs gitPatcher (see §3), copies GRD/GRDP files
3. **generate ninja files** — runs `gn gen`
4. **ninja build** — compiles all binaries into `src/out/Release_arm64/`
5. **packaging action** — ninja copies signing scripts to the packaging dir, then
   runs `sign_chrome.py` which signs, notarizes, and creates the DMG

### 2.3 Signing script locations
The signing Python scripts live in TWO places. **Both must be in sync.**

| Role | Path |
|------|------|
| Source (tracked, patched by gitPatcher) | `src/chrome/installer/mac/signing/` |
| Cached copy (used at build time) | `src/out/Release_arm64/iBrowe Browser Packaging/signing/` |

Ninja copies source → cached when the target file changes. If you edit source files
manually and don't rebuild, the cached copies go stale. Always copy manually after
a direct source edit (see §6).

---

## 3. The gitPatcher System

gitPatcher applies `.patch` files from `src/brave/patches/` to Chromium source files
before each build. Understanding it is critical for avoiding the "doubling" bug.

### 3.1 How it works
Each patch has a companion `.patchinfo` file:
```json
{
  "schemaVersion": 1,
  "patchChecksum": "<sha256 of the .patch file>",
  "appliesTo": [
    { "path": "relative/path/to/file.py", "checksum": "<sha256 of file AFTER patching>" }
  ]
}
```

Before each build, gitPatcher checks:
- Is `sha256(patch_file) == patchChecksum`? (patch file unchanged?)
- Is `sha256(source_file) == appliesTo.checksum`? (source file at post-patch state?)

If **both match** → already patched, skip.
If **either differs** → reset source to git HEAD (`git checkout <file>`) then re-apply.

### 3.2 The doubling bug
**Symptom:** A Python file has its content repeated twice; build fails with
`SyntaxError: invalid syntax` at the line where the second copy starts.

**Cause:** You directly edited a source file AND updated the patch file, but left the
`.patchinfo` stale. Next build:
1. gitPatcher sees `patchChecksum` mismatch → decides to re-apply
2. Resets file to git HEAD (original)
3. Applies patch → file now has correct patched content
4. But the `.patchinfo` checksum (from your manual edit) no longer matches the
   newly-patched file, so the cycle repeats next build

**Fix:** After changing a source file or its patch, always regenerate the patchinfo
(see §3.3).

### 3.3 How to regenerate a patchinfo after editing a source file
```bash
# Step 1: Reset source to git original (if not already there)
cd src/
git checkout chrome/installer/mac/signing/parts.py   # adjust path as needed

# Step 2: Regenerate the patch from your working-tree changes
git diff chrome/installer/mac/signing/parts.py > \
  brave/patches/chrome-installer-mac-signing-parts.py.patch

# Step 3: Apply the new patch to the git original
git apply brave/patches/chrome-installer-mac-signing-parts.py.patch

# Step 4: Update patchinfo with correct checksums
python3 - <<'EOF'
import hashlib, json
src = 'chrome/installer/mac/signing/parts.py'
patch = 'brave/patches/chrome-installer-mac-signing-parts.py.patch'
pi = 'brave/patches/chrome-installer-mac-signing-parts.py.patchinfo'
sha = lambda p: hashlib.sha256(open(p,'rb').read()).hexdigest()
json.dump({'schemaVersion':1,'patchChecksum':sha(patch),'appliesTo':[{'path':src,'checksum':sha(src)}]}, open(pi,'w'))
print('Done')
EOF

# Step 5: Copy updated source to cached packaging dir
cp chrome/installer/mac/signing/parts.py \
   "out/Release_arm64/iBrowe Browser Packaging/signing/parts.py"
```

### 3.4 How to verify all patchinfos are consistent (run before rebuilding)
```bash
python3 - <<'EOF'
import hashlib, json, os
patch_dir = 'src/brave/patches'
repo_dir  = 'src'
ok = True
for name in ['chrome-installer-mac-signing-parts.py.patch',
             'chrome-installer-mac-signing-pipeline.py.patch']:
    pi = json.load(open(f'{patch_dir}/{name}info'))
    ph = hashlib.sha256(open(f'{patch_dir}/{name}','rb').read()).hexdigest()
    sh = hashlib.sha256(open(f"{repo_dir}/{pi['appliesTo'][0]['path']}","rb").read()).hexdigest()
    status = 'OK' if ph==pi['patchChecksum'] and sh==pi['appliesTo'][0]['checksum'] else 'STALE'
    if status != 'OK': ok = False
    print(f'[{status}] {name}')
print('All consistent:', ok)
EOF
```

---

## 4. Modified Files Reference

All of the following files have been modified from their upstream defaults to make
iBrowe build and notarize correctly. **Never revert these without understanding why.**

### 4.1 Source files (persist across rebuilds via gitPatcher)

#### `src/out/Release_arm64/args.gn`
```
enable_updater=false
```
**Why:** Disables BraveUpdater. Without this, `SMPrivilegedExecutables` is added to
`Info.plist`. The privileged helper's `SMAuthorizedClients` only lists `com.brave.Browser`
variants, not `com.ibrowe.Browser`. macOS performs a bidirectional trust check at spawn
time → POSIX 163 error, app cannot open.

#### `src/chrome/app/app-entitlements-chrome.plist`
Removed key:
```xml
<key>com.apple.developer.associated-domains.applinks.read-write</key>
<true/>
```
**Why:** This entitlement is NOT in `release.provisionprofile`. On macOS 26, AMFI
kills the process (exit 137 = SIGKILL) when a binary claims an entitlement that isn't
authorized by its embedded provisioning profile.

#### `src/chrome/installer/mac/signing/parts.py`
Three changes:
1. **Existence check in signing loop** — skips any dylib that doesn't exist in the
   app bundle instead of crashing codesign. Fixes `liboptimization_guide_internal.dylib`
   which is in the signing list because `is_chrome_branded()` returns `True` in Brave,
   but the file is not compiled for iBrowe.
2. **Privileged helper skip** — if helper binary is absent, warns and removes any
   misnamed stray binary from `LaunchServices/` (prevents notarization rejection of
   unsigned binaries).
3. **validate_app try/except** — wraps the codesign validation in a try/except so a
   failed display doesn't abort the signing run before notarization.

Patch: `src/brave/patches/chrome-installer-mac-signing-parts.py.patch`
Patchinfo: `src/brave/patches/chrome-installer-mac-signing-parts.py.patchinfo`

#### `src/chrome/installer/mac/signing/pipeline.py`
Four changes:
1. `import subprocess` added at top
2. `_identity_in_keychain(identity)` helper — uses `security find-certificate` to
   check if a cert exists in the keychain before trying to use it
3. `productbuild --sign` made conditional on cert being in keychain — we don't have
   a "Developer ID Installer" cert, so PKG signing is skipped automatically
4. PKG notarization gated on `pkg_is_signed` — avoids submitting an unsigned PKG to
   Apple's notarization service (which would fail)
5. Removed `assert dist_config.installer_identity` — assertion that always fires when
   installer cert is absent

Patch: `src/brave/patches/chrome-installer-mac-signing-pipeline.py.patch`
Patchinfo: `src/brave/patches/chrome-installer-mac-signing-pipeline.py.patchinfo`

#### `src/chrome/installer/mac/signing/signing.py`
Added `import subprocess` — the `validate_app()` function uses `subprocess.CalledProcessError`
but the import was missing, causing `NameError` at runtime.

#### `src/brave/script/signing_helper.py`
Fixed regex in `BraveModifyPartsForSigning()`:
```python
# Before (only matched com.brave.Browser)
channel_re = 'com.brave.Browser(.*).UpdaterPrivilegedHelper'

# After (matches both com.brave.Browser and com.ibrowe.Browser)
channel_re = r'com\.(brave|ibrowe)\.Browser(.*)?\.UpdaterPrivilegedHelper'
replacement = r'com.brave.Browser.UpdaterPrivilegedHelper'
```

### 4.2 Cached packaging files (must be kept in sync with source)

Located in `src/out/Release_arm64/iBrowe Browser Packaging/signing/`

| Cached file | Source it mirrors |
|-------------|-------------------|
| `signing/parts.py` | `src/chrome/installer/mac/signing/parts.py` |
| `signing/pipeline.py` | `src/chrome/installer/mac/signing/pipeline.py` |
| `signing/signing.py` | `src/chrome/installer/mac/signing/signing.py` |
| `app-entitlements.plist` | Derived from `src/chrome/app/app-entitlements-chrome.plist` |

If you edit a source file, immediately copy it to the cached location and rebuild.
The build system will also re-copy on the next full ninja run.

---

## 5. Error Diagnosis & Fix Playbook

### Error A — SyntaxError in cached parts.py

```
File ".../iBrowe Browser Packaging/signing/parts.py", line 170
    The parts module defines the various binary pieces...
SyntaxError: invalid syntax
```

**Root cause:** gitPatcher doubled the file (see §3.2). The file content was appended
to itself; line 170 is where the second copy's docstring begins.

**Fix:**
```bash
cd src/
# Check line count — 264 = original, 288 = patched, 550+ = doubled
wc -l chrome/installer/mac/signing/parts.py

# Reset source to git original
git checkout chrome/installer/mac/signing/parts.py

# Verify patch applies cleanly
git apply --check brave/patches/chrome-installer-mac-signing-parts.py.patch

# Apply it
git apply brave/patches/chrome-installer-mac-signing-parts.py.patch

# Update patchinfo and copy to cached dir (see §3.3)
```

---

### Error B — codesign exit 1 on a dylib

```
subprocess.CalledProcessError: Command '['codesign', '--force', '--sign', ...,
  '.../Libraries/liboptimization_guide_internal.dylib']' returned non-zero exit status 1.
```

**Root cause:** The signing script (via `is_chrome_branded()=True`) includes this
Google-internal library in the signing list, but it is not present in the iBrowe build.
codesign exits 1 when the target file doesn't exist.

**Fix:** Already patched in `parts.py` (existence check in the signing loop, see §4.1).
If this error reappears, check that the patched `parts.py` is in both the source and
cached locations, and that the patchinfo is consistent (§3.4).

---

### Error C — "The application can't be opened." (POSIX 163 / exit 137)

POSIX 163 means the OS killed the process before it started. Three separate root causes
produce this same error code.

#### C1 — SMPrivilegedExecutables bidirectional trust failure

**How to identify:** Check `Info.plist` in the built app:
```bash
/usr/libexec/PlistBuddy -c "Print :SMPrivilegedExecutables" \
  "src/out/Release_arm64/iBrowe Browser.app/Contents/Info.plist" 2>/dev/null \
  && echo "updater is enabled — it must be disabled"
```
If the key exists, `enable_updater` is not set to false.

**Root cause:** `SMPrivilegedExecutables` is present in `Info.plist`. At launch, macOS
checks bidirectional trust: the app must be in the helper's `SMAuthorizedClients`. The
helper only lists `com.brave.Browser` variants, not `com.ibrowe.Browser`.

**Fix:** Ensure `src/out/Release_arm64/args.gn` contains `enable_updater=false`, then
rebuild from scratch.

#### C2 — BraveUpdater.app team ID mismatch (library-validation)

**How to identify:**
```bash
codesign -dv "src/out/Release_arm64/iBrowe Browser.app/Contents/Frameworks/\
iBrowe Browser Framework.framework/Helpers/BraveUpdater.app" 2>&1 | grep TeamIdentifier
# If output shows KL8N8XSYF4 (Brave's team), that's the problem
```

**Root cause:** `BraveUpdater.app` is signed by Brave Software (team `KL8N8XSYF4`).
The main app has `library-validation` enabled, which requires all loaded code to be
signed by the same team (`D8FP7GS222`) or Apple. The mismatch causes SIGKILL.

**Fix:** Delete the stray `BraveUpdater.app` from the compiled bundle:
```bash
rm -rf "src/out/Release_arm64/iBrowe Browser.app/Contents/Frameworks/\
iBrowe Browser Framework.framework/Helpers/BraveUpdater.app"
```
With `enable_updater=false` this file will not be present in future builds.

#### C3 — Entitlement not in provisioning profile (AMFI / exit 137)

**How to identify:**
```bash
# Check what entitlements the binary claims
codesign -d --entitlements - \
  "src/out/Release_arm64/iBrowe Browser.app" 2>/dev/null

# Check what the provisioning profile authorizes
security cms -D -i src/brave/build/mac/release.provisionprofile | \
  grep -A2 "Entitlements" | head -40
```
Any entitlement in the binary but NOT in the provisioning profile will cause AMFI to
kill the process on macOS 26.

**Root cause (already fixed):** `com.apple.developer.associated-domains.applinks.read-write`
was in `app-entitlements-chrome.plist` but not in `release.provisionprofile`.

**Fix:** Remove the offending key from `src/chrome/app/app-entitlements-chrome.plist`
and from the cached `src/out/Release_arm64/iBrowe Browser Packaging/app-entitlements.plist`.

---

### Error D — `assert dist_config.installer_identity` / PKG signing failure

```
AssertionError
  File ".../pipeline.py", line ...
    assert dist_config.installer_identity
```

**Root cause:** No "Developer ID Installer" certificate in the keychain. The original
pipeline code asserts the installer identity must be set.

**Fix:** Already patched in `pipeline.py` (assertion removed, `productbuild --sign`
conditional on cert presence, PKG notarization conditional on PKG being signed).

---

### Error E — `NameError: name 'subprocess' is not defined`

```
NameError: name 'subprocess' is not defined
  File ".../signing.py", line ...  validate_app
```

**Fix:** Already patched — `import subprocess` added to `signing.py`.

---

### Error F — Notarization rejected: "The binary is not signed"

**How to identify:** Notarization log from Apple contains "The binary is not signed"
for a helper or framework file.

**Root cause:** A binary file is physically present in the app bundle but was not
signed (e.g., a leftover binary from a previous build after `enable_updater` was
changed). Apple's notarization scanner rejects unsigned binaries.

**Fix:**
```bash
# Find unsigned files in the bundle
find "src/out/Release_arm64/iBrowe Browser.app" -type f \
  \( -name "*.dylib" -o -perm +111 \) | while read f; do
  codesign -v "$f" 2>/dev/null || echo "UNSIGNED: $f"
done

# Delete the unsigned file(s) and rebuild
```

---

## 6. Safe Workflow for Editing Signing Scripts

If you need to change `parts.py`, `pipeline.py`, or `signing.py`:

```bash
# 1. Make sure source is at git original before editing
cd src/
git checkout chrome/installer/mac/signing/parts.py

# 2. Edit the source file
#    (make your changes)

# 3. Regenerate the patch
git diff chrome/installer/mac/signing/parts.py > \
  brave/patches/chrome-installer-mac-signing-parts.py.patch

# 4. Reset back to original, then apply the new patch cleanly
git checkout chrome/installer/mac/signing/parts.py
git apply brave/patches/chrome-installer-mac-signing-parts.py.patch

# 5. Update patchinfo
python3 - <<'EOF'
import hashlib, json
src   = 'chrome/installer/mac/signing/parts.py'
patch = 'brave/patches/chrome-installer-mac-signing-parts.py.patch'
pi    = 'brave/patches/chrome-installer-mac-signing-parts.py.patchinfo'
sha = lambda p: hashlib.sha256(open(p,'rb').read()).hexdigest()
json.dump({'schemaVersion':1,'patchChecksum':sha(patch),
           'appliesTo':[{'path':src,'checksum':sha(src)}]}, open(pi,'w'))
print('patchinfo updated')
EOF

# 6. Copy to cached packaging dir
cp chrome/installer/mac/signing/parts.py \
   "out/Release_arm64/iBrowe Browser Packaging/signing/parts.py"

# 7. Rebuild
cd ..
npm run build -- Release --target=brave/build/mac:package --notarize
```

---

## 7. Pre-Build Checklist

Run these checks before every build to catch problems early:

```bash
cd /Users/koeyl/CLionProjects/ibrowe-browser

# 1. Verify args.gn has enable_updater=false
grep "enable_updater" src/out/Release_arm64/args.gn

# 2. Verify the entitlement was removed from plist
grep "associated-domains.applinks.read-write" \
  src/chrome/app/app-entitlements-chrome.plist && echo "ERROR: entitlement still present"

# 3. Verify patchinfos are consistent
python3 - <<'EOF'
import hashlib, json, os
patch_dir = 'src/brave/patches'
repo_dir  = 'src'
ok = True
for name in ['chrome-installer-mac-signing-parts.py.patch',
             'chrome-installer-mac-signing-pipeline.py.patch']:
    pi = json.load(open(f'{patch_dir}/{name}info'))
    ph = hashlib.sha256(open(f'{patch_dir}/{name}','rb').read()).hexdigest()
    sh = hashlib.sha256(open(f"{repo_dir}/{pi['appliesTo'][0]['path']}","rb").read()).hexdigest()
    status = 'OK' if ph==pi['patchChecksum'] and sh==pi['appliesTo'][0]['checksum'] else 'STALE'
    if status != 'OK': ok = False
    print(f'[{status}] {name}')
print('All patchinfos consistent:', ok)
EOF

# 4. Verify source and cached signing scripts are identical
diff src/chrome/installer/mac/signing/parts.py \
     "src/out/Release_arm64/iBrowe Browser Packaging/signing/parts.py" \
  && echo "parts.py in sync" || echo "WARNING: parts.py out of sync"

diff src/chrome/installer/mac/signing/pipeline.py \
     "src/out/Release_arm64/iBrowe Browser Packaging/signing/pipeline.py" \
  && echo "pipeline.py in sync" || echo "WARNING: pipeline.py out of sync"
```

---

## 8. Signing & Notarization Flow (What Happens Inside the Build)

1. **Copy app to temp dir** — signing works on a copy in `/var/folders/.../T/chromesign_*/`
2. **sign_chrome(sign_framework=True)**
   - Signs every part in `get_parts()` (dylibs, helpers, crashpad, etc.)
   - Skips parts whose file doesn't exist (existence check)
   - Signs the framework bundle
   - Embeds `release.provisionprofile` as `Contents/embedded.provisionprofile`
   - Signs the outer `.app` bundle
3. **validate_app** — runs `codesign --verify --deep --strict` (wrapped in try/except)
4. **DMG creation** — `hdiutil` creates the disk image
5. **Notarization** — `xcrun notarytool submit` sends the DMG to Apple's servers
   - Credentials read from `.env` (or environment variables `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`)
   - Apple scans for unsigned binaries, entitlement mismatches, and other issues
   - Returns a submission UUID; build waits for `Accepted` status
6. **Stapling** — `xcrun stapler staple` attaches the notarization ticket to the DMG
   - After stapling, the DMG can be distributed and verified offline (no Apple server needed)

**Success indicators in build log:**
```
The staple and validate action worked!
Success
...build brave/build/mac:package ... done
```

---

## 9. Reference: Key Files and Their Roles

| File | Role |
|------|------|
| `src/out/Release_arm64/args.gn` | GN build arguments; must have `enable_updater=false` |
| `src/chrome/app/app-entitlements-chrome.plist` | Source entitlements for the app bundle |
| `src/brave/build/mac/release.provisionprofile` | Provisioning profile embedded in app |
| `src/chrome/installer/mac/signing/parts.py` | Lists all parts to sign; has existence check |
| `src/chrome/installer/mac/signing/pipeline.py` | Orchestrates signing + PKG + notarization |
| `src/chrome/installer/mac/signing/signing.py` | Low-level codesign wrapper |
| `src/brave/script/signing_helper.py` | Brave-specific signing helpers (Widevine, etc.) |
| `src/brave/patches/chrome-installer-mac-signing-parts.py.patch` | Patch for parts.py |
| `src/brave/patches/chrome-installer-mac-signing-parts.py.patchinfo` | Checksums for patch integrity |
| `src/brave/patches/chrome-installer-mac-signing-pipeline.py.patch` | Patch for pipeline.py |
| `src/brave/patches/chrome-installer-mac-signing-pipeline.py.patchinfo` | Checksums for patch integrity |
| `src/out/Release_arm64/iBrowe Browser Packaging/signing/` | Cached copies used at build time |
