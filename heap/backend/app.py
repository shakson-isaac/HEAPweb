from google.cloud import storage
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import psycopg2
import pandas as pd
from io import StringIO
import os
import logging
import io
from sqlalchemy import create_engine
import gc  # Import garbage collection module

# Define the Flask app
app = Flask(__name__)

# Enable CORS for the app, allowing requests from the frontend service
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# GCS bucket name
GCS_BUCKET = "heaptester135"

# PostgreSQL connection details
POSTGRES_HOST = "/cloudsql/focal-cache-455223-h5:us-central1:heapsql"  # Ensure this matches your Cloud SQL instance connection name
POSTGRES_DB = "heapdb"
POSTGRES_USER = "heap1"
POSTGRES_PASSWORD = "heapdb1"

# Function to connect to PostgreSQL
def get_postgres_connection():
    try:
        app.logger.debug("Attempting to connect to PostgreSQL...")
        conn = psycopg2.connect(
            host=POSTGRES_HOST,
            database=POSTGRES_DB,
            user=POSTGRES_USER,
            password=POSTGRES_PASSWORD,
            sslmode="disable"  # Change to "require" if SSL is needed
        )
        app.logger.info("Successfully connected to PostgreSQL.")
        return conn
    except psycopg2.OperationalError as e:
        app.logger.error(f"OperationalError: {e}")
        raise
    except Exception as e:
        app.logger.error(f"Error connecting to PostgreSQL: {e}")
        raise

# Function to get a SQLAlchemy engine
def get_sqlalchemy_engine():
    try:
        app.logger.debug("Creating SQLAlchemy engine...")
        # Update the connection string to use the Cloud SQL Unix socket
        connection_string = (
            f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@/{POSTGRES_DB}"
            f"?host={POSTGRES_HOST}"
        )
        engine = create_engine(connection_string)
        app.logger.info("SQLAlchemy engine created successfully.")
        return engine
    except Exception as e:
        app.logger.error(f"Error creating SQLAlchemy engine: {e}")
        raise

# Initialize the GCS client
storage_client = storage.Client()

# Function to fetch a file from GCS
def get_gcs_file(bucket_name, file_path):
    try:
        app.logger.debug(f"Fetching file from GCS: Bucket={bucket_name}, FilePath={file_path}")
        bucket = storage_client.get_bucket(bucket_name)
        blob = bucket.blob(file_path)
        if not blob.exists():
            app.logger.error(f"File does not exist in GCS: {file_path}")
            raise FileNotFoundError(f"File not found: {file_path}")
        return blob.download_as_bytes()
    except Exception as e:
        app.logger.error(f"Error fetching file from GCS: {e}")
        raise

# Function to fetch a CSV file from GCS
def fetch_csv_from_gcs(bucket_name, file_path):
    try:
        app.logger.debug(f"Fetching CSV file from GCS: Bucket={bucket_name}, FilePath={file_path}")
        bucket = storage_client.get_bucket(bucket_name)
        blob = bucket.blob(file_path)

        if not blob.exists():
            app.logger.error(f"CSV file does not exist in GCS: {file_path}")
            raise FileNotFoundError(f"File not found: {file_path}")

        # Download the CSV file content as text
        csv_data = blob.download_as_text()
        return csv_data
    except Exception as e:
        app.logger.error(f"Error fetching CSV file from GCS: {e}")
        raise

# Route for the root URL
@app.route('/')
def index():
    return "Welcome to the Flask app!"

# Route to serve files from the "interactive/A2/Type6" folder
@app.route('/data/<path:filename>', methods=['GET'])
def serve_file(filename):
    try:
        file_path = f"data/interactive/A2/Type6/{filename}"
        file_content = get_gcs_file(GCS_BUCKET, file_path)
        return send_file(
            io.BytesIO(file_content),
            mimetype='text/html',  # Assuming HTML files; adjust MIME type if needed
            as_attachment=False
        )
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error serving file: {e}")
        return jsonify({"error": str(e)}), 500

# Route to serve files from the "interactive/A1" folder
@app.route('/data/generic/<path:filename>', methods=['GET'])
def serve_fileA1(filename):
    try:
        file_path = f"data/interactive/A1/{filename}"
        file_content = get_gcs_file(GCS_BUCKET, file_path)
        return send_file(
            io.BytesIO(file_content),
            mimetype='text/html',  # Assuming HTML files; adjust MIME type if needed
            as_attachment=False
        )
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error serving file: {e}")
        return jsonify({"error": str(e)}), 500

# Route to serve files from the "interactive/A3" folder
@app.route('/data/intervention/<path:filename>', methods=['GET'])
def serve_fileA3(filename):
    try:
        file_path = f"data/interactive/A3/{filename}"
        file_content = get_gcs_file(GCS_BUCKET, file_path)
        return send_file(
            io.BytesIO(file_content),
            mimetype='text/html',  # Assuming HTML files; adjust MIME type if needed
            as_attachment=False
        )
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error serving file: {e}")
        return jsonify({"error": str(e)}), 500

# Route to serve interaction images from the "interactive/P1" folder
@app.route('/data/interactions/<path:filename>', methods=['GET'])
def serve_interaction_file(filename):
    try:
        file_path = f"data/interactive/P1/{filename}"
        file_content = get_gcs_file(GCS_BUCKET, file_path)
        return send_file(
            io.BytesIO(file_content),
            mimetype='image/png',  # Assuming PNG images; adjust MIME type if needed
            as_attachment=False
        )
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error serving file: {e}")
        return jsonify({"error": str(e)}), 500

# Route to list files in the "download" folder
@app.route('/api/downloads', methods=['GET'])
def list_downloads():
    try:
        bucket = storage_client.get_bucket(GCS_BUCKET)
        blobs = bucket.list_blobs(prefix="data/download/")
        files = [blob.name.replace("data/download/", "") for blob in blobs if not blob.name.endswith("/")]
        return jsonify(files)
    except Exception as e:
        app.logger.error(f"Error listing download files: {e}")
        return jsonify({"error": str(e)}), 500

# Route to download a file from the "download" folder
@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    try:
        file_path = f"data/download/{filename}"
        app.logger.debug(f"Attempting to download file from GCS: {file_path}")

        # Get the GCS bucket and blob
        bucket = storage_client.get_bucket(GCS_BUCKET)
        blob = bucket.blob(file_path)

        if not blob.exists():
            app.logger.error(f"File not found in GCS: {file_path}")
            return jsonify({"error": "File not found"}), 404

        # Stream the file content directly to the client
        file_stream = blob.open("rb")  # Open the blob in read-binary mode
        return send_file(
            file_stream,
            mimetype='application/octet-stream',
            as_attachment=True,
            download_name=filename
        )
    except FileNotFoundError:
        return jsonify({"error": "File not found"}), 404
    except Exception as e:
        app.logger.error(f"Error downloading file: {e}")
        return jsonify({"error": str(e)}), 500

###### API ROUTE of Protein Names and Dropdown Menus #####
# Function to read prot from the txt file in GCS and return a list
def read_proteins_from_gcs(bucket_name, file_path):
    try:
        app.logger.debug(f"Fetching protein list from GCS: Bucket={bucket_name}, FilePath={file_path}")
        bucket = storage_client.get_bucket(bucket_name)
        blob = bucket.blob(file_path)

        if not blob.exists():
            app.logger.error(f"Protein list file does not exist in GCS: {file_path}")
            raise FileNotFoundError(f"File not found: {file_path}")

        # Download the file content as a string
        file_content = blob.download_as_text()
        gene_list = []

        # Process the content of the file
        for line in file_content.splitlines()[1:]:  # Skip the header line
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
        app.logger.error(f"Error reading protein list from GCS: {e}")
        return []

# Obtain Gene List to display in the dropdown
@app.route('/api/proteins', methods=['GET'])
def get_protlist():
    try:
        # Specify the path to your gene list text file in GCS
        file_path = "data/protIDs/protlist.txt"  # Correct GCS path
        prot_list = read_proteins_from_gcs(GCS_BUCKET, file_path)
        return jsonify(prot_list)
    except FileNotFoundError:
        return jsonify({"error": "Protein list file not found"}), 404
    except Exception as e:
        app.logger.error(f"Error retrieving protein list: {e}")
        return jsonify({"error": str(e)}), 500

# API to list .png files in the interactions folder
@app.route('/api/interactions', methods=['GET'])
def list_interactions():
    try:
        interactions_folder = "data/interactive/P1/"  # Correct GCS path
        app.logger.debug(f"Listing interaction files in GCS folder: {interactions_folder}")

        # Get the GCS bucket
        bucket = storage_client.get_bucket(GCS_BUCKET)

        # List all .png files in the interactions folder
        blobs = bucket.list_blobs(prefix=interactions_folder)
        files = [blob.name.replace(interactions_folder, "") for blob in blobs if blob.name.endswith(".png")]

        if not files:
            raise FileNotFoundError("No .png files found in the interactions folder.")

        return jsonify(files)
    except FileNotFoundError:
        return jsonify({"error": "No interaction files found"}), 404
    except Exception as e:
        app.logger.error(f"Error listing interaction files: {e}")
        return jsonify({"error": str(e)}), 500

# Function to dynamically create or refresh a table using SQLAlchemy and Pandas
def create_or_refresh_table_with_sqlalchemy(table_name, csv_file_path):
    try:
        app.logger.debug(f"Creating or refreshing table '{table_name}' from CSV file: {csv_file_path}")
        engine = get_sqlalchemy_engine()

        # Read the CSV file in chunks to avoid loading the entire file into memory
        csv_data = fetch_csv_from_gcs(GCS_BUCKET, csv_file_path)
        chunk_size = 10000  # Process 10,000 rows at a time
        first_chunk = True  # Track whether this is the first chunk

        for chunk in pd.read_csv(StringIO(csv_data), chunksize=chunk_size):
            # Use 'replace' for the first chunk to clear the table, then 'append' for subsequent chunks
            if first_chunk:
                chunk.to_sql(table_name, engine, if_exists='replace', index=False)
                first_chunk = False
                app.logger.debug(f"Replaced table '{table_name}' with the first chunk of {len(chunk)} rows.")
            else:
                chunk.to_sql(table_name, engine, if_exists='append', index=False)
                app.logger.debug(f"Appended a chunk of {len(chunk)} rows to table '{table_name}'.")

            # Explicitly delete the chunk and invoke garbage collection after processing each chunk
            del chunk
            gc.collect()

        app.logger.info(f"Table '{table_name}' created or refreshed successfully.")
    except Exception as e:
        app.logger.error(f"Error creating or refreshing table with SQLAlchemy: {e}")
        raise

# Route to fetch data from PostgreSQL with pagination, search, and sorting
@app.route('/fetch_data/<table_name>', methods=['GET'])
def fetch_data_from_postgres(table_name):
    try:
        # Strip .csv extension from the table name if present
        if table_name.endswith(".csv"):
            table_name = table_name[:-4]

        app.logger.debug(f"Fetching data from table: {table_name}")
        conn = get_postgres_connection()
        cursor = conn.cursor()

        # Check if the table exists in PostgreSQL
        cursor.execute(f"SELECT to_regclass('{table_name}')")
        table_exists = cursor.fetchone()[0]

        # Only create or refresh the table if it does not exist
        if not table_exists:
            app.logger.warning(f"Table '{table_name}' does not exist in PostgreSQL. Attempting to create or refresh it from CSV...")
            csv_file_path = f"data/table/{table_name}.csv"
            try:
                create_or_refresh_table_with_sqlalchemy(table_name, csv_file_path)
            except FileNotFoundError:
                app.logger.error(f"CSV file '{csv_file_path}' does not exist in Google Cloud Storage.")
                return jsonify({"error": f"Table '{table_name}' does not exist in PostgreSQL or Google Cloud Storage."}), 404

        # Get pagination, search, and sorting params from the request
        page = int(request.args.get('page', 0))
        rows_per_page = int(request.args.get('rowsPerPage', 10))
        search_term = request.args.get('search', '')
        sort_column = request.args.get('sortColumn', '')
        sort_direction = request.args.get('sortDirection', 'asc')
        search_trigger = request.args.get('searchTrigger', 'false').lower() == 'true'

        # Fetch valid columns for the table
        cursor.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}'")
        valid_columns = [row[0] for row in cursor.fetchall()]

        # Validate the sort column
        if sort_column and sort_column not in valid_columns:
            app.logger.error(f"Invalid sort column: {sort_column}. Valid columns are: {valid_columns}")
            return jsonify({"error": f"Invalid sort column: {sort_column}. Valid columns are: {valid_columns}"}), 400

        # Use a default sort column if none is provided
        if not sort_column and valid_columns:
            sort_column = valid_columns[0]
            app.logger.info(f"No sort column provided. Using default sort column: {sort_column}")

        # Build the SQL query
        query = f"SELECT * FROM \"{table_name}\""
        params = []
        search_conditions = []

        # Add search condition if searchTrigger is true
        if search_term and search_trigger:
            search_term = f"%{search_term.lower()}%"  # Add wildcards for partial matching
            search_conditions = [f"LOWER(\"{col}\") LIKE %s" for col in valid_columns]
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
        query += f" LIMIT %s OFFSET %s"
        params.extend([rows_per_page, page * rows_per_page])

        # Execute the query
        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Get column names
        columns = [desc[0] for desc in cursor.description]

        conn.close()

        # Prepare the response
        data = [dict(zip(columns, row)) for row in rows]
        response = {
            'data': data,
            'columns': columns,
            'recordsTotal': total_filtered_records,
            'recordsFiltered': total_filtered_records,
        }

        return jsonify(response)
    except psycopg2.Error as e:
        app.logger.error(f"Database error: {e.pgerror}")
        return jsonify({"error": "Database error occurred.", "details": e.pgerror}), 500
    except Exception as e:
        app.logger.error(f"Error fetching data: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

# Route to test PostgreSQL connection
@app.route('/test-db-connection', methods=['GET'])
def test_db_connection():
    try:
        conn = get_postgres_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")  # Simple query to test the connection
        result = cursor.fetchone()
        conn.close()
        return jsonify({"message": "Database connection successful", "result": result}), 200
    except Exception as e:
        app.logger.error(f"Database connection test failed: {e}")
        return jsonify({"error": str(e)}), 500

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    app.run(debug=True)