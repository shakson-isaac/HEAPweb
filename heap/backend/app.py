from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import pandas as pd
import os

# Define the Flaks app
app = Flask(__name__)

# Enable CORS for the app
CORS(app)

# Define the path to the CSV file inside the 'data' folder
data_path = os.path.join(os.path.dirname(__file__), '../data/example.csv')

# Load the large CSV data
df = pd.read_csv(data_path)

# Route for the root URL
@app.route('/')
def index():
    return "Welcome to the Flask app!"

# Route for the /favicon.ico request (optional, to prevent 404)
@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico')

# Fetch data route with pagination and search
@app.route('/fetch_data', methods=['GET'])
def fetch_data():
    # Get pagination and search params from the request
    start = int(request.args.get('start', 0))  # The start index for pagination
    length = int(request.args.get('length', 10))  # Number of rows per page
    search_term = request.args.get('search[value]', '')  # Search term for filtering

    # Filter the data based on the search term
    filtered_df = df[df.apply(lambda row: row.astype(str).str.contains(search_term, case=False).any(), axis=1)]
    
    # Drop unnecessary columns (if they exist)
    filtered_df = filtered_df.dropna(axis=1, how='all')  # This removes columns where all values are NaN    

    # Paginate the filtered data
    paginated_df = filtered_df.iloc[start:start + length]

    # Convert the DataFrame to a dictionary format that the frontend can consume
    data = paginated_df.to_dict(orient='records')
    
    response = {
        'draw': int(request.args.get('draw', 1)),
        'recordsTotal': len(df),
        'recordsFiltered': len(filtered_df),
        'data': data
    }

    return jsonify(response)

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    app.run(debug=True)

