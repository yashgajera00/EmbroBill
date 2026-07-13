import os
import sys
import shutil
from pathlib import Path
import django
from django.core.management import call_command

def sync_database_company_settings(src_db, dest_db):
    """Synchronize the first row of billing_company from src_db to dest_db to migrate settings changes."""
    if not src_db.exists() or not dest_db.exists():
        return
    print("[Launcher] Checking for company settings updates in database...")
    try:
        import sqlite3
        s_conn = sqlite3.connect(src_db)
        s_cur = s_conn.cursor()
        s_cur.execute(
            "SELECT address, phone, state_code, bank_name, account_number, ifsc_code, terms_conditions "
            "FROM billing_company LIMIT 1"
        )
        row = s_cur.fetchone()
        s_conn.close()

        if row:
            d_conn = sqlite3.connect(dest_db)
            d_cur = d_conn.cursor()
            d_cur.execute("SELECT id FROM billing_company LIMIT 1")
            dest_row = d_cur.fetchone()

            if dest_row:
                d_cur.execute(
                    "UPDATE billing_company "
                    "SET address=?, phone=?, state_code=?, bank_name=?, account_number=?, ifsc_code=?, terms_conditions=? "
                    "WHERE id=?",
                    (*row, dest_row[0])
                )
            else:
                d_cur.execute(
                    "INSERT INTO billing_company (address, phone, state_code, bank_name, account_number, ifsc_code, terms_conditions) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    row
                )
            d_conn.commit()
            d_conn.close()
            print("[Launcher] Database company settings successfully updated from bundled template.")
    except Exception as e:
        print(f"[Launcher] Error updating database company settings: {e}")


def setup_database_file():
    """Ensure db.sqlite3, config.json, and .system_data are copied to persistent AppData location before starting Django."""
    app_data = os.environ.get('APPDATA') or os.environ.get('LOCALAPPDATA')
    if not app_data:
        print("[Launcher] AppData directory not found. Starting with default DB path.")
        return

    dest_dir = Path(app_data) / 'SuratTextileBilling'
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_db = dest_dir / 'db.sqlite3'
    dest_config = dest_dir / 'config.json'

    # Search for template files to copy
    # If running from compiled exe, sys.executable is the exe file
    exe_dir = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).resolve().parent

    if not dest_db.exists():
        print(f"[Launcher] Database not found at persistent path: {dest_db}")
        src_db = exe_dir / 'db.sqlite3'
        
        if src_db.exists():
            print(f"[Launcher] Copying existing database from {src_db} to {dest_db}...")
            try:
                shutil.copy2(src_db, dest_db)
                print("[Launcher] Database copied successfully.")
            except Exception as e:
                print(f"[Launcher] Error copying database: {e}")
        else:
            print("[Launcher] No template database found to copy. A new database will be created.")

    # Copy config.json to persistent path if not exists, or if bundled config is newer
    src_config = exe_dir / 'config.json'
    if src_config.exists():
        if not dest_config.exists() or src_config.stat().st_mtime > dest_config.stat().st_mtime:
            print(f"[Launcher] Copying/updating config.json from {src_config} to {dest_config}...")
            try:
                shutil.copy2(src_config, dest_config)
                print("[Launcher] config.json copied/updated successfully.")
            except Exception as e:
                print(f"[Launcher] Error copying config.json: {e}")
    else:
        print("[Launcher] No template config.json found to copy.")

    # Copy .system_data to persistent path if not exists, or if bundled config is newer
    src_system_data = exe_dir / '.system_data'
    dest_system_data = dest_dir / '.system_data'
    system_data_updated = False

    if src_system_data.exists():
        if not dest_system_data.exists() or src_system_data.stat().st_mtime > dest_system_data.stat().st_mtime:
            print(f"[Launcher] Copying/updating .system_data from {src_system_data} to {dest_system_data}...")
            try:
                shutil.copy2(src_system_data, dest_system_data)
                print("[Launcher] .system_data copied/updated successfully.")
                system_data_updated = True
            except Exception as e:
                print(f"[Launcher] Error copying .system_data: {e}")
    else:
        print("[Launcher] No template .system_data found to copy.")

    # If the system_data config was updated, also update the database settings fields
    if system_data_updated:
        src_db = exe_dir / 'db.sqlite3'
        sync_database_company_settings(src_db, dest_db)



def main():
    # Force use of desktop settings overrides
    os.environ['DJANGO_SETTINGS_MODULE'] = 'bill_system.desktop_settings'
    
    # Copy DB to AppData if not present
    setup_database_file()
    
    # Initialize Django
    django.setup()
    
    # Run migrations and seed data using existing init_db script
    print("[Launcher] Initializing database (migrations, superuser, and company defaults)...")
    try:
        from init_db import initialize
        initialize()
    except Exception as e:
        print(f"[Launcher] Error initializing database: {e}")
        print("[Launcher] Proceeding to start server anyway...")

    # Start Django server programmatically on localhost port 8000
    print("[Launcher] Launching Django backend server on 127.0.0.1:8000...")
    try:
        call_command('runserver', '127.0.0.1:8000', use_reloader=False)
    except Exception as e:
        print(f"[Launcher] Django server crashed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
