const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'package.json');
const iconPath = path.join(__dirname, 'build', 'icon.ico');

// Determine architecture (default to x64)
const isIa32 = process.argv.includes('--ia32');
const arch = isIa32 ? 'ia32' : 'x64';
const backendArchDir = isIa32 ? 'x86' : 'x64';
console.log(`Preparing build configurations for architecture: ${arch}`);

// Read existing package.json
if (!fs.existsSync(packageJsonPath)) {
  console.error('package.json not found!');
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Update extraResources based on architecture
if (packageJson.build && packageJson.build.extraResources) {
  packageJson.build.extraResources[0].from = `dist-backend/${backendArchDir}/backend`;
  console.log(`Updated backend resource source path to: ${packageJson.build.extraResources[0].from}`);
}

// Update installer artifact name
if (packageJson.build && packageJson.build.nsis) {
  packageJson.build.nsis.artifactName = `EmbroBill Setup ${backendArchDir}.exe`;
  console.log(`Updated installer artifact name to: ${packageJson.build.nsis.artifactName}`);
}

const hasIcon = fs.existsSync(iconPath);

if (!hasIcon) {
  console.log('build/icon.ico is missing. Automatically removing icon references from electron-builder configuration.');
  if (packageJson.build) {
    if (packageJson.build.win) {
      delete packageJson.build.win.icon;
    }
    if (packageJson.build.nsis) {
      delete packageJson.build.nsis.installerIcon;
      delete packageJson.build.nsis.uninstallerIcon;
    }
  }
} else {
  console.log('build/icon.ico is present. Ensuring icon references in electron-builder configuration.');
  if (packageJson.build) {
    if (!packageJson.build.win) {
      packageJson.build.win = {};
    }
    packageJson.build.win.icon = 'build/icon.ico';
    if (!packageJson.build.nsis) {
      packageJson.build.nsis = {};
    }
    packageJson.build.nsis.installerIcon = 'build/icon.ico';
    packageJson.build.nsis.uninstallerIcon = 'build/icon.ico';
  }
}

// Write the modified package.json back to disk
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log('package.json updated successfully.');

// Copy Windows 7 compatibility DLL for the compiled Python backend
const compatDllSrc = path.join(__dirname, 'build', 'win7-compat', backendArchDir, 'api-ms-win-core-path-l1-1-0.dll');
const backendDestDir = path.join(__dirname, 'dist-backend', backendArchDir, 'backend');
const backendInternalDestDir = path.join(__dirname, 'dist-backend', backendArchDir, 'backend', '_internal');

if (fs.existsSync(compatDllSrc)) {
  console.log(`Copying Windows 7 compatibility DLL (${backendArchDir} api-ms-win-core-path-l1-1-0.dll)...`);
  if (fs.existsSync(backendDestDir)) {
    fs.copyFileSync(compatDllSrc, path.join(backendDestDir, 'api-ms-win-core-path-l1-1-0.dll'));
    console.log(`Copied DLL to dist-backend/${backendArchDir}/backend/`);
  }
  if (fs.existsSync(backendInternalDestDir)) {
    fs.copyFileSync(compatDllSrc, path.join(backendInternalDestDir, 'api-ms-win-core-path-l1-1-0.dll'));
    console.log(`Copied DLL to dist-backend/${backendArchDir}/backend/_internal/`);
  }
  console.log('Windows 7 compatibility DLL copied successfully.');
} else {
  console.warn('Windows 7 compatibility DLL not found at: ' + compatDllSrc);
}

// Copy UCRT DLLs from host downlevel folder to backend directories
const hostDownlevelDir = isIa32 ? 'C:\\Windows\\SysWOW64\\downlevel' : 'C:\\Windows\\System32\\downlevel';
if (fs.existsSync(hostDownlevelDir)) {
  console.log(`Copying UCRT DLLs from host downlevel folder (${hostDownlevelDir})...`);
  const files = fs.readdirSync(hostDownlevelDir);
  let ucrtCopiedCount = 0;
  for (const file of files) {
    const lowerFile = file.toLowerCase();
    if (lowerFile.startsWith('api-ms-win-') || lowerFile === 'ucrtbase.dll') {
      const srcFile = path.join(hostDownlevelDir, file);
      
      // Copy to backendDestDir
      if (fs.existsSync(backendDestDir)) {
        fs.copyFileSync(srcFile, path.join(backendDestDir, file));
      }
      
      // Copy to backendInternalDestDir
      if (fs.existsSync(backendInternalDestDir)) {
        fs.copyFileSync(srcFile, path.join(backendInternalDestDir, file));
      }
      ucrtCopiedCount++;
    }
  }
  console.log(`Successfully copied ${ucrtCopiedCount} UCRT DLLs.`);
} else {
  console.warn(`Host downlevel directory not found: ${hostDownlevelDir}`);
}

// Run binary patching script to patch python39.dll and _ctypes.pyd in the dist directories
const { execSync } = require('child_process');
const patchScript = 'C:\\Users\\Yash\\.gemini\\antigravity-ide\\scratch\\patch_dll.py';
if (fs.existsSync(patchScript)) {
  try {
    console.log('Applying python39.dll and _ctypes.pyd binary patches...');
    execSync(`.venv\\Scripts\\python.exe "${patchScript}"`, { stdio: 'inherit' });
    console.log('Binary patches applied successfully.');
  } catch (err) {
    console.error('Failed to run binary patch script:', err.message);
  }
} else {
  console.warn('Binary patch script not found at: ' + patchScript);
}

