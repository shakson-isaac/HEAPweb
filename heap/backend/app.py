from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os
import logging

# Define the Flask app
app = Flask(__name__)

# Enable CORS for the app
CORS(app)

# Define the path to the CSV file inside the 'data' folder
data_path = os.path.join(os.path.dirname(__file__), '../data/example.csv')

# Load the large CSV data
df = pd.read_csv(data_path)

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

# Fetch data route with pagination, search, and sorting
@app.route('/fetch_data', methods=['GET'])
def fetch_data():
    # Get pagination, search, and sorting params from the request
    start = int(request.args.get('start', 0))  # The start index for pagination
    length = int(request.args.get('length', 10))  # Number of rows per page
    search_term = request.args.get('search[value]', '')  # Search term for filtering
    sort_column = request.args.get('order[0][column]', 'Gene')  # Column to sort by
    sort_direction = request.args.get('order[0][dir]', 'asc')  # Sort direction (asc or desc)

    # Ensure the sort_column is a valid column in the DataFrame
    if sort_column not in df.columns:
        sort_column = 'Gene'  # Default to 'Gene' if the column is not valid

    # Filter the data based on the search term
    filtered_df = df[df.apply(lambda row: row.astype(str).str.contains(search_term, case=False).any(), axis=1)]
    
    # Drop unnecessary columns (if they exist)
    filtered_df = filtered_df.dropna(axis=1, how='all')  # This removes columns where all values are NaN    

    # Sort the filtered data
    if sort_column == 'Score':
        filtered_df = filtered_df.sort_values(by=sort_column, ascending=(sort_direction == 'asc'), key=pd.to_numeric)
    else:
        filtered_df = filtered_df.sort_values(by=sort_column, ascending=(sort_direction == 'asc'))

    # Paginate the sorted data
    paginated_df = filtered_df.iloc[start:start + length]

    # Convert the DataFrame to a dictionary format that the frontend can consume
    data = paginated_df.to_dict(orient='records')
    columns = list(df.columns)
    
    response = {
        'draw': int(request.args.get('draw', 1)),
        'recordsTotal': len(df),
        'recordsFiltered': len(filtered_df),
        'data': data,
        'columns': columns
    }

    # Log the response data
    app.logger.debug('Response data: %s', response)

    return jsonify(response)

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    app.run(debug=True)

