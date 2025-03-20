from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import logging

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

# Fetch data from any CSV file in the /data/table/ directory with pagination, search, and sorting
@app.route('/fetch_data/<filename>', methods=['GET'])
def fetch_data(filename):
    file_path = os.path.join(os.path.dirname(__file__), '../data/table/', filename)
    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    df = pd.read_csv(file_path)

    # Get pagination, search, and sorting params from the request
    page = int(request.args.get('page', 0))
    rows_per_page = int(request.args.get('rowsPerPage', 10))
    search_term = request.args.get('search', '')
    sort_column = request.args.get('sortColumn', '')
    sort_direction = request.args.get('sortDirection', 'asc')

    # Filter the data based on the search term
    if search_term:
        filtered_df = df[df.apply(lambda row: row.astype(str).str.contains(search_term, case=False).any(), axis=1)]
    else:
        filtered_df = df

    # Drop unnecessary columns (if they exist)
    filtered_df = filtered_df.dropna(axis=1, how='all')  # This removes columns where all values are NaN    

    # Sort the filtered data
    if sort_column:
        if sort_column in filtered_df.columns:
            if sort_direction == 'asc':
                filtered_df = filtered_df.sort_values(by=sort_column, ascending=True)
            else:
                filtered_df = filtered_df.sort_values(by=sort_column, ascending=False)

    # Paginate the sorted data
    paginated_df = filtered_df.iloc[page * rows_per_page:(page + 1) * rows_per_page]

    # Convert the DataFrame to a dictionary format that the frontend can consume
    data = paginated_df.to_dict(orient='records')
    columns = list(df.columns)
    
    response = {
        'data': data,
        'columns': columns,
        'recordsTotal': len(df),
        'recordsFiltered': len(filtered_df),
    }

    # Log the response data
    app.logger.debug('Response data: %s', response)

    return jsonify(response)

# Obtain HTML interactive files from data folder
HTMLfold = os.path.join(os.path.dirname(__file__), '../data/interactive/A2/')
@app.route('/data/<path:filename>')
def serve_file(filename):
    return send_from_directory(HTMLfold, filename)

# HTML file generic (A1) data folder:
HTMLfoldA1 = os.path.join(os.path.dirname(__file__), '../data/interactive/A1/')
@app.route('/data/generic/<path:filename>')
def serve_fileA1(filename):
    return send_from_directory(HTMLfoldA1, filename)

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

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    app.run(debug=True)

