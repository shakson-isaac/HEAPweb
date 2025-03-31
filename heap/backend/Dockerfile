# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the application home directory
ENV APP_HOME=/app
WORKDIR $APP_HOME

# Install system dependencies and Cloud SQL Proxy
RUN apt-get update && apt-get install -y \
    build-essential \
    libffi-dev \
    libssl-dev \
    libpq-dev \
    gcc \
    curl \
    lsb-release \
    && curl -o /cloud_sql_proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 \
    && chmod +x /cloud_sql_proxy \
    && mkdir /cloudsql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy local code to the container image
COPY . $APP_HOME

# Set the data folder environment variable
ENV DATA_FOLDER=$APP_HOME/data

# Install required Python packages
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port for Gunicorn
EXPOSE 8080

# Run Cloud SQL Proxy and Gunicorn
CMD ["/bin/sh", "-c", "/cloud_sql_proxy --unix-socket /cloudsql focal-cache-455223-h5:us-central1:heapsql & gunicorn --bind :8080 --workers 4 --threads 8 app:app"]
