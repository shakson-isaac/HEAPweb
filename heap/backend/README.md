## Dockerizing and Deploying the Backend

### Build Docker Image
```bash
docker build -t heap-backend .
```

### Run Locally
```bash
docker run -p 5000:5000 heap-backend
```

### Push to Google Container Registry (GCR)
1. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   gcloud auth configure-docker
   ```

2. Tag and push the image:
   ```bash
   docker tag heap-backend gcr.io/heaptrial-a2785/heap-backend
   docker push gcr.io/heaptrial-a2785/heap-backend
   ```

### Deploy to Google Cloud Run
1. Deploy the image:
   ```bash
   gcloud run deploy heap-backend \
       --image gcr.io/heaptrial-a2785/heap-backend \
       --platform managed \
       --region us-central1 \
       --allow-unauthenticated
   ```

2. Note the service URL and update your frontend to use it.
