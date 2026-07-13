import pefile
import os
import sys

# Paths to DLLs
SOCKET_PATH = r"e:\bill_system\dist-backend\x86\backend\_internal\_socket.pyd"
KERNEL32_WIN7 = r"e:\bill_system\dist_electron\kernel32_win7_x86.dll"
WS2_32_WIN7 = r"e:\bill_system\dist_electron\ws2_32_win7_x86.dll"
IPHLPAPI_WIN7 = r"e:\bill_system\dist_electron\iphlpapi_win7_x86.dll"

def get_exports(dll_path):
    exports = set()
    try:
        pe = pefile.PE(dll_path)
        if hasattr(pe, 'DIRECTORY_ENTRY_EXPORT'):
            for exp in pe.DIRECTORY_ENTRY_EXPORT.symbols:
                if exp.name:
                    exports.add(exp.name.decode('utf-8'))
                else:
                    exports.add(exp.ordinal)
    except Exception as e:
        print(f"Error reading exports from {dll_path}: {e}")
    return exports

def check_imports():
    if not os.path.exists(SOCKET_PATH):
        print(f"Error: {SOCKET_PATH} does not exist.")
        return

    pe = pefile.PE(SOCKET_PATH)
    
    for entry in pe.DIRECTORY_ENTRY_IMPORT:
        dll_name = entry.dll.decode('utf-8')
        print(f"\nChecking imports from {dll_name}...")
        
        # Resolve import DLL path
        resolved_path = None
        if dll_name.lower() == "kernel32.dll":
            resolved_path = KERNEL32_WIN7
        elif dll_name.lower() == "ws2_32.dll":
            resolved_path = WS2_32_WIN7
        elif dll_name.lower() == "iphlpapi.dll":
            resolved_path = IPHLPAPI_WIN7
        
        if not resolved_path or not os.path.exists(resolved_path):
            print(f"  Skipping {dll_name} - not system library or not tracked.")
            continue
            
        print(f"  Using resolved DLL: {resolved_path}")
        exports = get_exports(resolved_path)
        
        missing = []
        for imp in entry.imports:
            imp_name = imp.name.decode('utf-8') if imp.name else imp.ordinal
            if imp_name not in exports:
                missing.append(imp_name)
                
        if missing:
            print(f"  >>> MISSING FUNCTIONS IN {dll_name}:")
            for m in missing:
                print(f"    - {m}")
        else:
            print(f"  All {len(entry.imports)} imports satisfied.")

if __name__ == "__main__":
    check_imports()
