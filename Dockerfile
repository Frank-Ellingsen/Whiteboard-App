# Production Container using minimal Alpine NGINX
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy web application assets
COPY index.html /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY manifest.json /usr/share/nginx/html/
COPY sw.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/
COPY samples/ /usr/share/nginx/html/samples/
COPY templates/ /usr/share/nginx/html/templates/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
