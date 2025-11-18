#!/bin/bash
# Extract MIDI file from database using sqlite3 command-line tool

DB_PATH="./data/midimind.db"

if [ "$1" = "list" ]; then
  echo ""
  echo "📂 MIDI Files in database:"
  echo ""
  sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT id, filename, size, tracks, uploaded_at FROM midi_files ORDER BY id;
EOF
  echo ""
  exit 0
fi

if [ -z "$1" ]; then
  echo "Usage: ./extract-midi.sh <file-id-or-name>"
  echo ""
  echo "Examples:"
  echo "  ./extract-midi.sh list"
  echo "  ./extract-midi.sh 19"
  echo "  ./extract-midi.sh \"Under The Sea.midi\""
  echo ""
  exit 1
fi

FILE_ID="$1"

# Check if it's a number (ID) or a filename
if [[ "$FILE_ID" =~ ^[0-9]+$ ]]; then
  QUERY="SELECT filename, data FROM midi_files WHERE id = $FILE_ID;"
else
  QUERY="SELECT filename, data FROM midi_files WHERE filename = '$FILE_ID';"
fi

# Extract file
echo "Extracting file..."
OUTPUT=$(sqlite3 "$DB_PATH" "$QUERY")

if [ -z "$OUTPUT" ]; then
  echo "❌ File not found: $FILE_ID"
  echo ""
  echo "Available files:"
  sqlite3 "$DB_PATH" "SELECT id, filename FROM midi_files;"
  exit 1
fi

# Parse output (filename|base64data)
FILENAME=$(echo "$OUTPUT" | cut -d'|' -f1)
BASE64_DATA=$(echo "$OUTPUT" | cut -d'|' -f2)

# Decode base64 and save
echo "$BASE64_DATA" | base64 -d > "$FILENAME"

echo ""
echo "✅ File extracted successfully!"
echo "   Name: $FILENAME"
echo "   Size: $(stat -f%z "$FILENAME" 2>/dev/null || stat -c%s "$FILENAME") bytes"
echo ""
echo "Now you can test it with:"
echo "   node compare-parsers.js \"$FILENAME\""
echo ""
