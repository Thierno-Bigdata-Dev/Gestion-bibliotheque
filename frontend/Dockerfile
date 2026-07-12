FROM nginx:alpine

# Supprimer la configuration par défaut de nginx
RUN rm /etc/nginx/nginx.conf

# Copier la configuration personnalisée
COPY nginx.conf /etc/nginx/nginx.conf

# Copier les fichiers statiques de l'application
COPY index.html /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
