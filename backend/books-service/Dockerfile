FROM python:3.11-slim

WORKDIR /app

# Installer les dépendances système pour psycopg2 si nécessaire
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

# Lancer avec Gunicorn en production
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "2", "app:app"]
