FROM python:3.11-slim

WORKDIR /app

# psycopg2-binary est une roue pré-compilée : aucun compilateur C requis
# Seul libpq5 est nécessaire à l'exécution (connexion PostgreSQL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

# Lancer avec Gunicorn en production
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "2", "app:app"]

