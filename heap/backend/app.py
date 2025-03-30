from google.cloud import storage
from flask import Flask, jsonify, send_file
from flask_cors import CORS
import os
import logging
import io

# Define the Flask app
app = Flask(__name__)

# Enable CORS for the app, allowing requests from the frontend service
CORS(app, resources={r"/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# GCS bucket name
GCS_BUCKET = "heaptester135"

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

# Custom 404 error handler
@app.errorhandler(404)
def page_not_found(e):
    return jsonify(error="Page not found"), 404

if __name__ == '__main__':
    app.run(debug=True)