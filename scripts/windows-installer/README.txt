iBrowe Inno Setup Wrapper

This folder contains a ready-made Inno Setup wrapper for your Brave-based
Windows installer.

Files
- iBroweInstaller.iss -> branded outer installer script
- payload\iBroweBrowserSetup.exe -> place your inner Brave/Chromium installer here
- assets\ibrowe-setup.ico -> optional setup EXE icon
- assets\ibrowe-wizard.bmp -> optional large wizard image
- assets\ibrowe-wizard-small.bmp -> optional small wizard image

Recommended folder layout before compiling

scripts\windows-installer\
  iBroweInstaller.iss
  README.txt
  payload\iBroweBrowserSetup.exe
  assets\ibrowe-setup.ico
  assets\ibrowe-wizard.bmp
  assets\ibrowe-wizard-small.bmp

How to use
1. Build or export your Windows Brave-based installer payload.
2. Rename that payload to iBroweBrowserSetup.exe or change InnerSetupExeName in
   iBroweInstaller.iss.
3. If your payload does not accept /silent /install, update:
   - InnerSetupUserArgs
   - InnerSetupMachineArgs
4. Drop your BMP/ICO branding assets into the assets folder.
5. Uncomment SetupIconFile, WizardImageFile, and WizardSmallImageFile in the
   [Setup] section.
6. Compile with Inno Setup 6.

Suggested asset sizes
- ibrowe-setup.ico -> a multi-size Windows icon
- ibrowe-wizard.bmp -> 164x314 BMP for the left wizard illustration
- ibrowe-wizard-small.bmp -> 55x55 BMP for the top-right small wizard badge

Important notes
- This wrapper gives you a beautiful outer installer wizard.
- The actual browser installation and uninstall registration still come from
  your Brave/Chromium payload.
- If you want a matching custom remove wizard too, create a second small Inno
  script that launches the installed Chromium setup.exe with:
  --uninstall --force-uninstall
  and, for machine-wide installs, add:
  --system-level