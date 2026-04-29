; iBrowe modern wrapper installer for a Brave/Chromium Windows payload.
; Compile with Inno Setup 6 after placing your inner installer at:
;   scripts\windows-installer\payload\iBroweBrowserSetup.exe
; Optional beauty assets:
;   scripts\windows-installer\assets\ibrowe-setup.ico
;   scripts\windows-installer\assets\ibrowe-wizard.bmp
;   scripts\windows-installer\assets\ibrowe-wizard-small.bmp

#define MyAppName "iBrowe"
#define MyAppVersion "1.88.138"
#define MyAppPublisher "iBrowe Software"
#define MyAppURL "https://github.com/yuthstyle88/ibrowe-browser"
#define MyAppExeName "iBrowe.exe"

; Rename this if your packaged Brave/Chromium payload uses a different file name.
#define InnerSetupExeName "ibrowe_installer.exe"

; Adjust these paths if your installed browser ends up somewhere else.
#define UserInstallRoot "{localappdata}\Programs\iBrowe"
#define MachineInstallRoot "{autopf}\iBrowe"
#define InstalledExeRelativePath "Application\iBrowe.exe"

; Default silent switches for a Chrome/Chromium-style EXE installer.
; If your payload is a raw setup.exe or mini_installer.exe with different flags,
; update these two defines only.
#define InnerSetupUserArgs "/silent /install"
#define InnerSetupMachineArgs "/silent /install"

[Setup]
AppId={{B7A7A86A-1F2D-48E7-BE9B-24FB43A45C44}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
UsePreviousAppDir=no
UsePreviousGroup=no
WizardStyle=modern
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
SetupLogging=yes
OutputDir=output
OutputBaseFilename=iBroweInstaller
LicenseFile=..\..\LICENSE-IBROWE
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription=Beautiful iBrowe installer wrapper
Uninstallable=no

; Uncomment these once you add your custom artwork.
; SetupIconFile=assets\ibrowe-setup.ico
; WizardImageFile=assets\ibrowe-wizard.bmp
; WizardSmallImageFile=assets\ibrowe-wizard-small.bmp

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; Flags: unchecked
Name: "launchbrowser"; Description: "Launch iBrowe after setup"; Flags: unchecked

[Files]
Source: "payload\{#InnerSetupExeName}"; Flags: dontcopy ignoreversion

[Run]
Filename: "{code:GetInstalledExePath}"; Description: "Launch iBrowe"; Flags: nowait postinstall skipifsilent skipifdoesntexist; Tasks: launchbrowser

[Code]
var
  BrandingPage: TWizardPage;
  BrandingHeadlineLabel: TNewStaticText;
  BrandingBodyLabel: TNewStaticText;
  BrandingFooterLabel: TNewStaticText;

function GetInstallRoot: string;
begin
  if IsAdminInstallMode then
    Result := ExpandConstant('{#MachineInstallRoot}')
  else
    Result := ExpandConstant('{#UserInstallRoot}');
end;

function GetInstalledExePath(Param: string): string;
begin
  Result := AddBackslash(GetInstallRoot()) + '{#InstalledExeRelativePath}';
end;

function GetInnerInstallerArgs: string;
begin
  if IsAdminInstallMode then
    Result := '{#InnerSetupMachineArgs}'
  else
    Result := '{#InnerSetupUserArgs}';
end;

function InstallInnerBrowser: Boolean;
var
  ResultCode: Integer;
  InnerSetupPath: string;
begin
  Result := False;
  ExtractTemporaryFile('{#InnerSetupExeName}');
  InnerSetupPath := ExpandConstant('{tmp}\{#InnerSetupExeName}');

  Log('Launching embedded installer: ' + InnerSetupPath + ' ' + GetInnerInstallerArgs());

  if not Exec(InnerSetupPath, GetInnerInstallerArgs(), '', SW_SHOWNORMAL,
       ewWaitUntilTerminated, ResultCode) then begin
    MsgBox('iBrowe could not start the embedded browser installer.', mbCriticalError, MB_OK);
    Exit;
  end;

  if ResultCode <> 0 then begin
    MsgBox(
      'The embedded browser installer exited with code ' + IntToStr(ResultCode) + '.' + #13#10 + #13#10 +
      'If your Brave-based payload uses different silent switches, update ' +
      'InnerSetupUserArgs and InnerSetupMachineArgs at the top of this script.',
      mbCriticalError,
      MB_OK
    );
    Exit;
  end;

  Result := True;
end;

procedure CreateIBroweDesktopShortcut;
var
  BrowserPath: string;
begin
  BrowserPath := GetInstalledExePath('');
  if not FileExists(BrowserPath) then begin
    Log('Desktop shortcut skipped because ' + BrowserPath + ' was not found.');
    Exit;
  end;

  if not CreateShellLink(
       ExpandConstant('{autodesktop}\iBrowe.lnk'),
       'Launch iBrowe',
       BrowserPath,
       '',
       ExtractFileDir(BrowserPath),
       BrowserPath,
       0,
       SW_SHOWNORMAL) then begin
    Log('Desktop shortcut creation failed.');
  end;
end;

procedure InitializeWizard;
begin
  BrandingPage := CreateCustomPage(
    wpWelcome,
    'Private by default. Fast by design.',
    'This wrapper gives your Brave-based iBrowe installer a cleaner, more premium setup flow.'
  );

  BrandingHeadlineLabel := TNewStaticText.Create(BrandingPage);
  BrandingHeadlineLabel.Parent := BrandingPage.Surface;
  BrandingHeadlineLabel.Left := ScaleX(0);
  BrandingHeadlineLabel.Top := ScaleY(8);
  BrandingHeadlineLabel.Width := BrandingPage.SurfaceWidth;
  BrandingHeadlineLabel.Height := ScaleY(28);
  BrandingHeadlineLabel.Font.Style := [fsBold];
  BrandingHeadlineLabel.Font.Size := 14;
  BrandingHeadlineLabel.Caption := 'What this setup will do';

  BrandingBodyLabel := TNewStaticText.Create(BrandingPage);
  BrandingBodyLabel.Parent := BrandingPage.Surface;
  BrandingBodyLabel.Left := ScaleX(0);
  BrandingBodyLabel.Top := ScaleY(42);
  BrandingBodyLabel.Width := BrandingPage.SurfaceWidth;
  BrandingBodyLabel.Height := ScaleY(120);
  BrandingBodyLabel.WordWrap := True;
  BrandingBodyLabel.Caption :=
    '- Run your existing Brave/Chromium installer silently under the hood' + #13#10 +
    '- Offer a cleaner, branded wizard flow before the browser payload starts' + #13#10 +
    '- Support per-user or all-users install mode through the built-in privileges dialog' + #13#10 +
    '- Optionally create a desktop shortcut and launch iBrowe after installation';

  BrandingFooterLabel := TNewStaticText.Create(BrandingPage);
  BrandingFooterLabel.Parent := BrandingPage.Surface;
  BrandingFooterLabel.Left := ScaleX(0);
  BrandingFooterLabel.Top := ScaleY(176);
  BrandingFooterLabel.Width := BrandingPage.SurfaceWidth;
  BrandingFooterLabel.Height := ScaleY(48);
  BrandingFooterLabel.WordWrap := True;
  BrandingFooterLabel.Caption :=
    'Tip: if you want machine-wide installation, choose the all-users option on the privileges dialog when setup starts.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then begin
    WizardForm.StatusLabel.Caption := 'Installing iBrowe browser core...';

    if not InstallInnerBrowser then
      RaiseException('iBrowe installation did not complete.');

    if WizardIsTaskSelected('desktopicon') then
      CreateIBroweDesktopShortcut;
  end;
end;
