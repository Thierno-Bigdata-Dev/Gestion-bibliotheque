# Plateforme Microservices de Gestion de Bibliothèque Académique - DIT

Ce projet est un MVP (Minimum Viable Product) de niveau production conçu pour moderniser la gestion de la bibliothèque académique du **Dakar Institute of Technology (DIT)**. Il résout les problèmes de suivi manuel des livres et des emprunts, fournit des statistiques consolidées et offre une interface moderne et réactive aux administrateurs.

L'application repose sur une **architecture microservices** robuste, entièrement conteneurisée avec **Docker** et **Docker Compose**, et intègre un pipeline CI/CD automatisé via **Jenkins**.

---

## 🏗️ Architecture du Système

Le système est découpé en services autonomes et hautement scalables :

1. **Frontend & API Gateway (Nginx)** : 
   * Distribue l'interface utilisateur SPA (HTML5, CSS3, Vanilla JS).
   * Centralise et route les requêtes API (ex: `/api/books/*` vers le service Livres) pour éviter les blocages CORS et masquer les ports internes des microservices.
2. **Books Service (Flask, port 5001)** : 
   * Gère le catalogue physique des livres, l'inventaire total et le stock disponible.
3. **Users Service (Flask, port 5002)** : 
   * Gère la liste des étudiants, professeurs et personnels administratifs de la L2 DIT.
4. **Loans Service (Flask, port 5003)** : 
   * Gère le cycle de vie des emprunts et des retours. Il communique par requêtes HTTP REST avec les services Livres et Utilisateurs pour valider les actions de prêt.
5. **Database (PostgreSQL, port 5432)** : 
   * Serveur SQL mutualisé contenant trois bases de données physiquement isolées (`dit_books`, `dit_users`, `dit_loans`) pour respecter l'isolation des données microservices.

```
                  ┌───────────────────────────────┐
                  │ Navigateur Client (Web App)   │
                  └──────────────┬────────────────┘
                                 │ HTTP (Port 8085)
                                 ▼
                  ┌───────────────────────────────┐
                  │   Nginx (Frontend & Gateway)  │
                  └────┬──────────┬──────────┬────┘
        /api/books     │          │          │ /api/loans
                       │          │          │
         ┌─────────────┘          │          └─────────────┐
         ▼                        ▼ /api/users             ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Books Service   │    │  Users Service   │    │  Loans Service   │
│   (Flask:5001)   │    │   (Flask:5002)   │    │   (Flask:5003)   │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                       │                       │
         │  ┌────────────────────┼───────────────────────┘ Communication HTTP Internes
         │  │                    │
         ▼  ▼                    ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                 PostgreSQL Multi-Database (5432)                 │
│    [dit_books]            [dit_users]             [dit_loans]    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📂 Structure du Projet

```
Gestion-bibliotheque/
├── backend/                # Conteneur regroupant tout le code backend
│   ├── books-service/      # Microservice de gestion des livres
│   │   ├── app.py          # Logique API Flask
│   │   ├── models.py       # Modèle SQLAlchemy (Livre)
│   │   ├── Dockerfile      # Configuration conteneur de production
│   │   └── requirements.txt # Dépendances Python
│   ├── users-service/      # Microservice de gestion des utilisateurs
│   │   ├── app.py          # Logique API Flask
│   │   ├── models.py       # Modèle SQLAlchemy (Utilisateur)
│   │   ├── Dockerfile      # Configuration conteneur de production
│   │   └── requirements.txt # Dépendances Python
│   └── loans-service/      # Microservice de gestion des emprunts
│       ├── app.py          # Orchestration & appels inter-services HTTP
│       ├── models.py       # Modèle SQLAlchemy (Emprunt)
│       ├── Dockerfile      # Configuration conteneur de production
│       └── requirements.txt # Dépendances Python
├── frontend/               # Conteneur Frontend & API Gateway
│   ├── index.html          # Structure de l'application Single Page Application
│   ├── style.css           # Design System Premium (Dark theme, Animations)
│   ├── app.js              # Logique dynamique & requêtes API
│   ├── nginx.conf          # Configuration proxy Nginx
│   └── Dockerfile          # Conteneur Nginx
├── db-init/
│   └── init.sql            # Script SQL de création des bases de données
├── docker-compose.yml      # Orchestration et liens réseau des conteneurs
├── Jenkinsfile             # Script de construction Jenkins
├── generate_report.py      # Script de génération de rapport PDF
└── README.md               # Présente documentation
```

---

## 🚀 Installation et Lancement

### Prérequis
* [Docker](https://www.docker.com/) et [Docker Compose](https://docs.docker.com/compose/) installés et démarrés sur votre machine.
* Python 3.x installé (uniquement si vous souhaitez exécuter le script de génération du rapport PDF hors conteneur).

### Lancement de l'application
Démarrez tous les services à l'aide d'une seule commande à la racine du projet :

```bash
docker compose up --build -d
```

Cette commande va :
1. Télécharger l'image de base PostgreSQL.
2. Construire les images Docker pour chaque microservice et pour le frontend.
3. Exécuter le script `db-init/init.sql` pour créer les bases de données.
4. Lancer tous les conteneurs en arrière-plan.

### Accès à l'application
Une fois les conteneurs démarrés, ouvrez votre navigateur et accédez à :
👉 **`http://localhost:8085`**

### Vérification du statut des services
Vous pouvez inspecter l'état des conteneurs avec :
```bash
docker compose ps
```

Pour consulter les logs d'un service spécifique (ex: le service emprunts) :
```bash
docker compose logs loans-service
```

---

## ⚙️ Fonctionnement du Pipeline CI/CD (Jenkins)

Le fichier [Jenkinsfile](file:///c:/Users/HP%20ELITEBOOK/Downloads/Gestion-bibliotheque/Jenkinsfile) définit un pipeline de déploiement automatisé :

1. **Checkout** : Jenkins récupère les dernières modifications de code depuis le dépôt GitHub.
2. **Analyse Statique / Compilation** : Validation syntaxique parallèle des fichiers Python pour s'assurer que le code est exempt d'erreurs avant la mise en production.
3. **Build des Images Docker** : Reconstruction des images de conteneurs avec la commande `docker compose build` pour compiler les nouveaux commits.
4. **Déploiement Automatique** : Relance les conteneurs avec `docker compose down && docker compose up -d` pour appliquer les modifications instantanément avec un temps d'arrêt minimal.

---

## 📄 Génération du Rapport PDF requis

Un script Python automatisé [generate_report.py](file:///c:/Users/HP%20ELITEBOOK/Downloads/Gestion-bibliotheque/generate_report.py) est fourni pour compiler instantanément le rapport académique officiel du projet au format PDF.

Pour générer le rapport :
1. Assurez-vous d'avoir Python installé sur votre machine.
2. Exécutez le script dans votre terminal :
   ```bash
   python generate_report.py
   ```
Le script installera automatiquement la dépendance nécessaire (`reportlab`) si elle est absente, et générera un fichier nommé **`Rapport_Projet_Bibliotheque.pdf`** dans le dossier racine du projet.

> **Astuce DevOps** : Prenez des captures d'écran de l'application web et placez-les sous un dossier `screenshots/` (noms de fichiers : `dashboard.png`, `books.png`, `users.png`, `loans.png`) avant d'exécuter le script. Celui-ci les intégrera automatiquement dans le PDF de manière professionnelle.
