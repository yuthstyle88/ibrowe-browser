# Windows Branding Files to Edit for iBrowe

## Files to Edit for Branding

### 1. `src\brave\app\brave_exe.rc`
The main Windows executable resource file.

Edit this when you want to change:
- The main `.exe` icon
- Taskbar / Start Menu icon resources
- Incognito icon
- App / file-type icons
- Dev, Beta, Canary icon variants

Currently points to:
```
theme\brave\win\brave.ico
theme\brave\win\brave_canary.ico
theme\brave\win\app_list.ico
theme\brave\win\brave_file.ico
```

This is the **first file to change** for Windows visual branding.

---

### 2. `src\brave\chromium_src\chrome\installer\setup\resources\setup_resources.grd`
Controls Windows installer text resources.

Edit this when you want to change:
- Installer messages
- Install failure text
- Wording shown by `setup.exe`
- Localized installer-visible strings

Example currently in the file:
```
Please download iBrowe again.
```

This is the correct place for **installer wording and branding text**.

---

### 3. `src\brave\chromium_src\chrome\installer\setup\brave_behaviors.cc`
Controls Brave-specific uninstall behavior.

Edit this when you want to change:
- Post-uninstall survey URL
- Uninstall follow-up behavior
- What happens after uninstall finishes

Currently uses:
```
https://brave.com/uninstall-survey/?p=brave_uninstall_survey
```

Change this to your own URL or remove the behavior entirely if not needed.

---

### 4. `src\brave\build\args\branding_defaults.gni`
A small but important branding config file.

Edit this when you want to change:
- Branding path component names
- Which branding asset path set is used internally

Currently contains:
```gni
branding_path_component = "brave"
branding_path_product = "brave"
```

If you are fully rebranding, this is one of the **core config files** to review.

---

### 5. `src\brave\chromium_src\chrome\install_static\install_modes.cc`
Affects Windows install and update registry branding.

Edit this when you want to change:
- Windows registry vendor/product key names for install/update state
- BraveSoftware update/client paths

Currently hardcodes:
```
Software\BraveSoftware\Update\Clients\...
Software\BraveSoftware\Update\ClientState\...
```

If you want a clean iBrowe vendor identity in Windows, this is a **key file**.

---

### 6. `src\brave\chromium_src\chrome\install_static\user_data_dir.cc`
Affects branded Windows policy/path naming behavior.

Edit this when you want to change:
- Policy-related branded path names
- Product name used in some Windows install/user-data path handling

Currently contains special handling for:
```
SOFTWARE\Policies\BraveSoftware\Brave
Brave-Browser
```

Important if you want **no leftover Brave naming** in Windows.

---

## Asset / Source Folders to Check

### 7. Windows icon asset files referenced by `brave_exe.rc`
The `.rc` file is the switchboard — you also need to replace the actual icon files it points to.

Look for icon assets under the Brave theme/resource tree:
```
theme\brave\win\brave.ico
theme\brave\win\brave_development.ico
theme\brave\win\brave_canary.ico
theme\brave\win\brave_file.ico
theme\brave\win\incognito.ico
```

In practice you edit:
- The resource map in `src\brave\app\brave_exe.rc`
- The actual `.ico` files in the matching theme/resource folder

---

## If You Are Using the iBrowe Overlay Workflow

The root project scripts suggest branding assets and translations may be maintained
in the overlay and copied into `src\brave`:
- `package.json`
- `lib\util.js`

Those scripts reference paths like:
```
src\ibrowe\src\images
src\ibrowe\src\translates
```

Depending on your workflow, the long-term place you may want to edit is:
- `src\ibrowe\src\images`
- `src\ibrowe\src\translates`

---

## Recommended Edit Order

| Step | File | Purpose |
|------|------|---------|
| 1 | `src\brave\app\brave_exe.rc` | Icons / resources |
| 2 | Windows `.ico` asset files it references | Actual icon images |
| 3 | `src\brave\chromium_src\chrome\installer\setup\resources\setup_resources.grd` | Installer text |
| 4 | `src\brave\chromium_src\chrome\installer\setup\brave_behaviors.cc` | Uninstall behavior |
| 5 | `src\brave\build\args\branding_defaults.gni` | Brand config path names |
| 6 | `src\brave\chromium_src\chrome\install_static\install_modes.cc` | Windows registry / update branding |
| 7 | `src\brave\chromium_src\chrome\install_static\user_data_dir.cc` | Policy / path naming cleanup |

---

## Quick Reference

| File | Controls |
|------|----------|
| `brave_exe.rc` | Icons / resources |
| `setup_resources.grd` | Installer text |
| `brave_behaviors.cc` | Uninstall behavior |
| `branding_defaults.gni` | Brand config path names |
| `install_modes.cc` | Windows registry / update branding |
| `user_data_dir.cc` | Policy / path naming cleanup |

---

> **Important:** If you only edit `setup_resources.grd` and icons, the installer will
> look more branded, but some internal Windows names may still contain "Brave" unless
> you also update the `install_static` files.
