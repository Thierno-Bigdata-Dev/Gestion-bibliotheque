FROM postgres:15-alpine
COPY db-init/init.sql /docker-entrypoint-initdb.d/init.sql
