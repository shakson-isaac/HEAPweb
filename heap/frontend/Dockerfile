# Use a Node.js image with version 22 or higher to build the React app
FROM node:22 as build

WORKDIR /app

# Accept the REACT_APP_BACKEND_URL build argument
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Ensure these files exist in the build context
COPY package.json package-lock.json ./
RUN npm install

# Copy the source code
COPY . .

# Build the React app
RUN npm run build

# Use a lightweight web server to serve the built app
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built app from the build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose the port and start the server
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
