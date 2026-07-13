import pefile
import sys

if len(sys.argv) < 2:
    print("Usage: python analyze_imports.py <path_to_dll>")
    sys.exit(1)

pe = pefile.PE(sys.argv[1])
print(f"--- IMPORTS FOR {sys.argv[1]} ---")
for entry in pe.DIRECTORY_ENTRY_IMPORT:
    dll_name = entry.dll.decode('utf-8')
    print(f"\n{dll_name}:")
    for imp in entry.imports:
        if imp.name:
            print(f"  {imp.name.decode('utf-8')}")
        else:
            print(f"  ordinal {imp.ordinal}")
