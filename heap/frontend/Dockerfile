# Use a Node.js image to build the React app
FROM node:16 as build

WORKDIR /app

# Ensure these files exist in the build context
COPY package.json package-lock.json ./
RUN npm install

COPY . .
ENV REACT_APP_BACKEND_URL=http://backend:5050
RUN npm run build

# Use a lightweight web server to serve the built app
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
