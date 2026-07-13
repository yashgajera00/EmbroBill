# -*- mode: python ; coding: utf-8 -*-

import sys
import os
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Set Django settings module env var for the compilation process
os.environ['DJANGO_SETTINGS_MODULE'] = 'bill_system.settings'

# In modern PyInstaller v6.0+, bytecode encryption (block_cipher) is deprecated/removed.
# Python code is compiled to bytecode (.pyc) and stored in the PYZ archive.
block_cipher = None

# Custom helper to safely collect submodules for local packages without spawning python subprocesses
def get_local_submodules(package):
    submodules = [package]
    for root, _, files in os.walk(package):
        for file in files:
            if file.endswith('.py') and file != '__init__.py':
                rel_path = os.path.relpath(os.path.join(root, file), os.path.dirname(package))
                mod = os.path.splitext(rel_path)[0].replace(os.sep, '.')
                submodules.append(mod)
            elif file == '__init__.py' and root != package:
                rel_path = os.path.relpath(root, os.path.dirname(package))
                mod = rel_path.replace(os.sep, '.')
                submodules.append(mod)
    return list(set(submodules))

# Collect submodules for ReportLab (standard library package) and local project packages
reportlab_imports = collect_submodules('reportlab')
billing_imports = get_local_submodules('billing')
bill_system_imports = get_local_submodules('bill_system')

hidden_imports = (
    reportlab_imports +
    billing_imports +
    bill_system_imports +
    [
        'django.db.backends.sqlite3.base',
        'django.contrib.admin.apps',
        'django.contrib.auth.apps',
        'django.contrib.contenttypes.apps',
        'django.contrib.sessions.apps',
        'django.contrib.messages.apps',
        'django.contrib.staticfiles.apps',
        'billing.apps',
        'init_db',
    ]
)

# Collect data files for Django and ReportLab (do NOT add billing/bill_system folders to prevent source leakage)
# Note: Dynamic configuration and template files (like db.sqlite3, config.json, and .system_data)
# are bundled directly by Electron builder extraResources, not PyInstaller.
django_data = collect_data_files('django')
reportlab_data = collect_data_files('reportlab')
certifi_data = collect_data_files('certifi')

datas = django_data + reportlab_data + certifi_data

a = Analysis(
    ['desktop_launcher.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["pythoncom","pywintypes","win32api","win32con","win32evtlog","win32evtlogutil","win32process","win32service","win32serviceutil","win32timezone","win32com",],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Programmatically filter out any .py, .pyc, or .pyo files from data collection to guarantee no source exposure
a.datas = [
    (dest, src, type) for (dest, src, type) in a.datas
    if not (dest.endswith('.py') or dest.endswith('.pyc') or dest.endswith('.pyo'))
]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)
