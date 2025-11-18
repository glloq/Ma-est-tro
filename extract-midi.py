#!/usr/bin/env python3
"""Extract MIDI file from database for testing"""

import sqlite3
import base64
import sys
import os

DB_PATH = './data/midimind.db'

def list_files():
    """List all MIDI files in database"""
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT id, filename, size, tracks, uploaded_at FROM midi_files ORDER BY id")
    files = cursor.fetchall()

    if not files:
        print("\n  No files found in database.\n")
    else:
        print("\n📂 MIDI Files in database:\n")
        for file_id, filename, size, tracks, uploaded_at in files:
            print(f"  [{file_id}] {filename}")
            print(f"      Size: {size} bytes, Tracks: {tracks}, Uploaded: {uploaded_at}")
        print()

    conn.close()

def extract_file(file_id_or_name):
    """Extract MIDI file from database"""
    if not os.path.exists(DB_PATH):
        print(f"❌ Database not found: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Try as ID first
    if file_id_or_name.isdigit():
        cursor.execute("SELECT id, filename, data, size, tracks FROM midi_files WHERE id = ?", (int(file_id_or_name),))
    else:
        cursor.execute("SELECT id, filename, data, size, tracks FROM midi_files WHERE filename = ?", (file_id_or_name,))

    result = cursor.fetchone()

    if not result:
        print(f"❌ File not found: {file_id_or_name}")
        print("\nAvailable files:")
        cursor.execute("SELECT id, filename FROM midi_files")
        for fid, fname in cursor.fetchall():
            print(f"  [{fid}] {fname}")
        conn.close()
        return

    file_id, filename, data, size, tracks = result

    # Decode base64 and save
    midi_data = base64.b64decode(data)

    with open(filename, 'wb') as f:
        f.write(midi_data)

    print(f"\n✅ File extracted successfully!")
    print(f"   ID: {file_id}")
    print(f"   Name: {filename}")
    print(f"   Size: {size} bytes")
    print(f"   Tracks: {tracks}")
    print(f"   Output: ./{filename}")
    print()
    print("Now you can test it with:")
    print(f"   node compare-parsers.js \"{filename}\"")
    print()

    conn.close()

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 extract-midi.py <file-id-or-name>")
        print()
        print("Examples:")
        print("  python3 extract-midi.py list")
        print("  python3 extract-midi.py 19")
        print("  python3 extract-midi.py \"Under The Sea.midi\"")
        print()
        sys.exit(1)

    arg = sys.argv[1]

    if arg == 'list':
        list_files()
    else:
        extract_file(arg)
