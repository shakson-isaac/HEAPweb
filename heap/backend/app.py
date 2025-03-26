from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import pandas as pd
import os
import logging
import glob

# Define the Flask app
app = Flask(__name__)

# Enable CORS for the app
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Route for the root URL
@app.route('/')
def index():
    return "Welcome to the Flask app!"

# Route for the /favicon.ico request (optional, to prevent 404)
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico')

# Function to convert CSV to SQLite table
def csv_to_sqlite(csv_file, db_file, table_name):
    df = pd.read_csv(csv_file)
    conn = sqlite3.connect(db_file)
    df.to_sql(table_name, conn, if_exists='replace', index=False)
    conn.close()

# Fetch data from SQLite database with pagination, search, and sorting
@app.route('/fetch_data/<filename>', methods=['GET'])
def fetch_data(filename):
    db_file = os.path.join(os.path.dirname(__file__), '../data/table/', 'data.db')
    table_name = filename.split('.')[0]

    # Convert CSV to SQLite table if it doesn't exist
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
    if cursor.fetchone() is None:
        csv_file = os.path.join(os.path.dirname(__file__), '../data/table/', filename)
        if not os.path.exists(csv_file):
            conn.close()
            return jsonify({"error": "File not found"}), 404
        csv_to_sqlite(csv_file, db_file, table_name)

    # Get pagination, search, and sorting params from the request
    page = int(request.args.get('page', 0))
    rows_per_page = int(request.args.get('rowsPerPage', 10))
    search_term = request.args.get('search', '')
    sort_column = request.args.get('sortColumn', '')
    sort_direction = request.args.get('sortDirection', 'asc')
    search_trigger = request.args.get('searchTrigger', 'false').lower() == 'true'

    # Build the SQL query
    query = f"SELECT * FROM \"{table_name}\""
    params = []
    search_conditions = []

    # Add search condition if searchTrigger is true
    if search_term and search_trigger:
        search_term = f"%{search_term.lower()}%"
        columns_info = cursor.execute(f"PRAGMA table_info(\"{table_name}\")").fetchall()
        search_conditions = [f"LOWER(\"{col[1]}\") LIKE ?" for col in columns_info]
        query += " WHERE " + " OR ".join(search_conditions)
        params.extend([search_term] * len(search_conditions))

    # Get total records count after search filter
    count_query = f"SELECT COUNT(*) FROM \"{table_name}\""
    if search_conditions:
        count_query += " WHERE " + " OR ".join(search_conditions)
    cursor.execute(count_query, params[:len(search_conditions)])
    total_filtered_records = cursor.fetchone()[0]

    # Add sorting
    if sort_column:
        query += f" ORDER BY \"{sort_column}\" {sort_direction.upper()}"

    # Add pagination
    query += f" LIMIT ? OFFSET ?"
    params.extend([rows_per_page, page * rows_per_page])

    # Execute the query
    cursor.execute(query, params)
    rows = cursor.fetchall()

    # Get column names
    columns = [description[0] for description in cursor.description]

    # Get total records count
    cursor.execute(f"SELECT COUNT(*) FROM \"{table_name}\"")
    total_records = cursor.fetchone()[0]

    conn.close()

    # Prepare the response
    data = [dict(zip(columns, row)) for row in rows]
    response = {
        'data': data,
        'columns': columns,
        'recordsTotal': total_records,
        'recordsFiltered': total_filtered_records,
    }

    # Log the response data
    app.logger.debug('Response data: %s', response)

    return jsonify(response)

# Obtain HTML interactive files from data folder
HTMLfold = os.path.join(os.path.dirname(__file__), '../data/interactive/A2/Type6/')
@app.route('/data/<path:filename>')
def serve_file(filename):
    return send_from_directory(HTMLfold, filename)

# HTML file generic (A1) data folder:
HTMLfoldA1 = os.path.join(os.path.dirname(__file__), '../data/interactive/A1/')
@app.route('/data/generic/<path:filename>')
def serve_fileA1(filename):
    return send_from_directory(HTMLfoldA1, filename)

# HTML file intervention (A3) data folder:
HTMLfoldA3 = os.path.join(os.path.dirname(__file__), '../data/interactive/A3/')
@app.route('/data/intervention/<path:filename>')
def serve_fileA3(filename):
    return send_from_directory(HTMLfoldA3, filename)

# Path to serve interaction images
HTMLfoldP1 = os.path.join(os.path.dirname(__file__), '../data/interactive/P1/')
@app.route('/data/interactions/<path:filename>')
def serve_interaction_file(filename):
    try:
        return send_from_directory(HTMLfoldP1, filename)
    except FileNotFoundError:
        app.logger.error(f"File not found: {filename}")
        return jsonify({"error": "File not found"}), 404

### Protein ID dropdown ###
# Function to read prot from the txt file and return a list
def read_proteins_from_file(file_path):
    try:
        gene_list = []
        with open(file_path, 'r') as file:
            # Skip header and parse the rest of the lines
            for line in file.readlines()[1:]:  # Skip the header line
                line = line.strip()  # Remove leading/trailing whitespace
                if line:
                    # Split by tab to get coding and meaning columns
                    parts = line.split("\t")
                    if len(parts) == 2:  # Ensure there are exactly 2 columns
                        coding = parts[0].strip()  # Protein ID (coding column)
                        meaning = parts[1].strip()  # Protein Name (meaning column)
                        
                        # Split the meaning part by ";" to separate protein ID and name
                        gene_info = meaning.split(";")
                        if len(gene_info) == 2:
                            protein_id = gene_info[0].strip().replace("-", "_")  # Protein ID (replacing "-" with "_")
                            protein_name = gene_info[1].strip()  # Protein Name

                            # Append the processed gene info to the list
                            gene_list.append({'id': protein_id, 'name': protein_name})
        
        return gene_list
    except Exception as e:
        print(f"Error reading file: {e}")
        return []

# Obtain Gene List to display in the dropdown
@app.route('/api/proteins', methods=['GET'])
def get_protlist():
    # Specify the path to your gene list text file
    prot_list = read_proteins_from_file('../data/protIDs/protlist.txt')
    return jsonify(prot_list)

# Path to Download Data Files
@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    try:
        # Directly return the file from the download folder
        return send_from_directory('../data/download/', filename, as_attachment=True)
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404

# API to list .png files in the interactions folder
@app.route('/api/interactions', methods=['GET'])
def list_interactions():
    interactions_folder = os.path.join(os.path.dirname(__file__), '../data/interactive/P1/')
    try:
        if not os.path.exists(interactions_folder):
            raise FileNotFoundError("Interactions folder not found.")
        files = [os.path.basename(file) for file in glob.glob(os.path.join(interactions_folder, '*.png'))]
        if not files:
            raise FileNotFoundError("No .png files found in the interactions folder.")
        return jsonify(files)
    except Exception as e:
        app.logger.error(f"Error listing interaction files: {e}")
        return jsonify({"error": str(e)}), 500

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    app.run(debug=True)

