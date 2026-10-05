import os
import hmac
from google.cloud import storage
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS
import psycopg2
import pandas as pd
import logging
import io
from sqlalchemy import create_engine, or_, Table, MetaData, inspect, func
from sqlalchemy.orm import registry
import gc  # Import garbage collection module
from flask_sqlalchemy import SQLAlchemy
from flask_marshmallow import Marshmallow
from flask_caching import Cache

# Define the Flask app
app = Flask(__name__)

# Enable CORS for the app, allowing requests from the frontend service
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Configure Flask-Caching
cache = Cache(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 300})

# Configuration for environment variables
CONFIG = {
    "GCS_BUCKET": os.getenv("GCS_BUCKET"),
    "POSTGRES": {
        "HOST": os.getenv("CLOUD_SQL_CONNECTION_NAME"),
        "DB": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
    }
}

# GCS bucket name
GCS_BUCKET = CONFIG["GCS_BUCKET"]

# PostgreSQL connection details
POSTGRES_HOST = CONFIG["POSTGRES"]["HOST"]
POSTGRES_DB = CONFIG["POSTGRES"]["DB"]
POSTGRES_USER = CONFIG["POSTGRES"]["USER"]
POSTGRES_PASSWORD = CONFIG["POSTGRES"]["PASSWORD"]

# Configure SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@/{POSTGRES_DB}"
    f"?host=/cloudsql/{POSTGRES_HOST}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
    'pool_size': 10,  # Maximum number of connections in the pool
    'max_overflow': 5,  # Maximum number of connections beyond the pool size
    'pool_timeout': 30,  # Timeout for getting a connection from the pool
    'pool_recycle': 1800,  # Recycle connections after 30 minutes
}

# Initialize SQLAlchemy and Marshmallow
db = SQLAlchemy(app)
ma = Marshmallow(app)

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

        # Stream the object rather than downloading it whole: download_as_text()
        # would hold the entire CSV in memory (62 MB for MediationResults) on a
        # container capped at 1 Gi. With blob.open() peak memory is one chunk.
        bucket = storage_client.get_bucket(GCS_BUCKET)
        blob = bucket.blob(csv_file_path)
        if not blob.exists():
            raise FileNotFoundError(f"File not found: {csv_file_path}")

        chunk_size = 10000  # Process 10,000 rows at a time
        first_chunk = True  # Track whether this is the first chunk
        rows_loaded = 0

        with blob.open("rt") as handle:
            reader = pd.read_csv(handle, chunksize=chunk_size)
            for chunk in reader:
                # 'replace' on the first chunk clears the table, then 'append'
                if first_chunk:
                    chunk.to_sql(table_name, engine, if_exists='replace', index=False)
                    first_chunk = False
                    app.logger.debug(f"Replaced table '{table_name}' with the first chunk of {len(chunk)} rows.")
                else:
                    chunk.to_sql(table_name, engine, if_exists='append', index=False)
                    app.logger.debug(f"Appended a chunk of {len(chunk)} rows to table '{table_name}'.")

                rows_loaded += len(chunk)
                del chunk
                gc.collect()

        app.logger.info(f"Table '{table_name}' refreshed with {rows_loaded} rows.")
        return rows_loaded
    except Exception as e:
        app.logger.error(f"Error creating or refreshing table with SQLAlchemy: {e}")
        raise

# Function to fetch data with pagination, sorting, and searching using SQLAlchemy Table
@app.route('/fetch_data/<table_name>', methods=['GET'])
@cache.cached(timeout=300, query_string=True)  # Cache the response for 5 minutes
def fetch_data(table_name):
    try:
        # Strip .csv extension from the table name if present
        if table_name.endswith(".csv"):
            table_name = table_name[:-4]

        # Reflect the table from the database
        metadata = MetaData()  # Initialize MetaData without bind
        table = Table(table_name, metadata, autoload_with=db.engine)  # Explicitly pass the engine

        # Get pagination, search, and sorting params from the request
        page = int(request.args.get('page', 0)) + 1  # Flask-SQLAlchemy uses 1-based indexing
        rows_per_page = int(request.args.get('rowsPerPage', 10))
        search_term = request.args.get('search', '').strip().lower()  # Convert search term to lowercase
        sort_column = request.args.get('sortColumn', None)
        sort_direction = request.args.get('sortDirection', 'asc')

        # Build the query
        query = db.session.query(table)

        # Apply search filter
        if search_term:
            search_filters = []
            for col in table.columns.keys():
                column = table.c[col]
                # Check if the column is of a text-compatible type
                if str(column.type).lower() in ['text', 'varchar', 'char']:
                    search_filters.append(func.lower(column).like(f"%{search_term}%"))
                else:
                    # Optionally cast non-text columns to TEXT for searching
                    search_filters.append(func.cast(column, db.Text).like(f"%{search_term}%"))
            query = query.filter(or_(*search_filters))

        # Apply sorting
        if sort_column and sort_column in table.columns.keys():
            sort_attr = table.c[sort_column]
            query = query.order_by(sort_attr.desc() if sort_direction == 'desc' else sort_attr.asc())

        # Apply pagination
        total_records = query.count()  # Get total records count
        rows = query.offset((page - 1) * rows_per_page).limit(rows_per_page).all()

        # Serialize the results using row._mapping
        data = [dict(row._mapping) for row in rows]

        # Prepare the response
        response = {
            'data': data,
            'columns': list(table.columns.keys()),
            'recordsTotal': total_records,
            'recordsFiltered': total_records,
        }

        return jsonify(response)
    except Exception as e:
        app.logger.error(f"Error fetching data: {e}")
        return jsonify({"error": str(e)}), 500

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

# Tables the refresh endpoint is allowed to (re)build, mapped to their source
# CSV in GCS. An allowlist, so a caller cannot name an arbitrary table or path.
REFRESHABLE_TABLES = {
    "GxE_R2table": "data/download/GxE_R2table.csv",
    "GxE_Cat_R2table": "data/download/GxE_Cat_R2table.csv",
    "MediationResults": "data/download/MediationResults.csv",
    "GEMdownload": "data/download/GEMdownload.csv",
}


@app.route('/healthz', methods=['GET'])
def healthz():
    return jsonify({"status": "ok"}), 200


@app.route('/admin/refresh-table', methods=['POST'])
def refresh_table():
    """Rebuild one Postgres table from its CSV in GCS.

    This is the one part of the data pipeline that has to run inside GCP: Cloud
    SQL is reached over the /cloudsql socket that Cloud Run mounts, which does
    not exist on O2. Everything else (packing and publishing the sharded
    payloads) happens on O2, where the source data lives.

    The service is deployed --allow-unauthenticated, so this endpoint is inert
    unless REFRESH_TOKEN is set in the environment, and requires that token on
    every call. It fails closed: no token configured means no refresh.
    """
    expected = os.getenv("REFRESH_TOKEN")
    if not expected:
        app.logger.warning("refresh-table called but REFRESH_TOKEN is not configured")
        return jsonify({"error": "refresh endpoint is not enabled"}), 503

    presented = request.headers.get("X-Refresh-Token", "")
    if not hmac.compare_digest(presented, expected):
        return jsonify({"error": "forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    table = payload.get("table")
    if table not in REFRESHABLE_TABLES:
        return jsonify({
            "error": "unknown table",
            "allowed": sorted(REFRESHABLE_TABLES),
        }), 400

    try:
        rows = create_or_refresh_table_with_sqlalchemy(table, REFRESHABLE_TABLES[table])
        cache.clear()  # paginated reads of this table are cached for 5 minutes
        return jsonify({"table": table, "rows": rows, "status": "refreshed"}), 200
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        app.logger.error(f"refresh of '{table}' failed: {e}")
        return jsonify({"error": str(e)}), 500


# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port, debug=True)