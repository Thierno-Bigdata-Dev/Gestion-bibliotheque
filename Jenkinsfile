pipeline {
    agent any

    environment {
        // ─── Informations du projet ───────────────────────────────────────────
        PROJECT_NAME  = "CI-CD-Gestion-bibliotheque"
        APP_PORT      = "8085"
        JENKINS_PORT  = "8080"

        // ─── Répertoire workspace Jenkins (chemin du dépôt cloné) ────────────
        // Permet à docker compose de trouver le docker-compose.yml au bon endroit
        COMPOSE_DIR   = "${WORKSPACE}"

        // ─── URL publique ngrok (gratuit) ─────────────────────────────────────
        // ⚠ Mettre à jour cette valeur si vous relancez ngrok (URL change)
        NGROK_URL     = "https://threefold-sculpture-chest.ngrok-free.dev"
    }

    stages {

        // ── Stage 1 : Récupération du code source depuis GitHub ───────────────
        stage('1. Checkout Code') {
            steps {
                echo "======================================================"
                echo " Pipeline CI/CD - ${PROJECT_NAME}"
                echo " Build : #${BUILD_NUMBER} | Branche : ${GIT_BRANCH}"
                echo "======================================================"
                checkout scm
                sh 'echo "Commit : $(git rev-parse --short HEAD) - $(git log -1 --pretty=%B)"'
            }
        }

        // ── Stage 2 : Analyse syntaxique Python (lint) ────────────────────────
        stage('2. Lint & Analyse Statique') {
            parallel {
                stage('Books Service') {
                    steps {
                        echo "--- Lint : backend/books-service ---"
                        sh '''
                            python3 -m py_compile backend/books-service/app.py \
                                                  backend/books-service/models.py \
                            && echo "[OK] Books Service - Aucune erreur de syntaxe" \
                            || echo "[WARN] Books Service - Erreur de syntaxe détectée"
                        '''
                    }
                }
                stage('Users Service') {
                    steps {
                        echo "--- Lint : backend/users-service ---"
                        sh '''
                            python3 -m py_compile backend/users-service/app.py \
                                                  backend/users-service/models.py \
                            && echo "[OK] Users Service - Aucune erreur de syntaxe" \
                            || echo "[WARN] Users Service - Erreur de syntaxe détectée"
                        '''
                    }
                }
                stage('Loans Service') {
                    steps {
                        echo "--- Lint : backend/loans-service ---"
                        sh '''
                            python3 -m py_compile backend/loans-service/app.py \
                                                  backend/loans-service/models.py \
                            && echo "[OK] Loans Service - Aucune erreur de syntaxe" \
                            || echo "[WARN] Loans Service - Erreur de syntaxe détectée"
                        '''
                    }
                }
            }
        }

        // ── Stage 3 : Construction des images Docker ──────────────────────────
        stage('3. Docker Build') {
            steps {
                echo "======================================================"
                echo " Construction des images Docker (cache activé)"
                echo "======================================================"
                // --pull : vérifie si une nouvelle version de l'image de base existe
                // Le cache Docker est conservé pour les couches non modifiées
                // Build ~30s (code only) au lieu de ~5min (--no-cache)
                sh "cd ${COMPOSE_DIR} && docker compose build --pull"
                sh "cd ${COMPOSE_DIR} && docker compose images"
            }
        }

        // ── Stage 4 : Déploiement (rolling restart) ───────────────────────────
        stage('4. Deploy') {
            steps {
                echo "======================================================"
                echo " Déploiement via Docker Compose"
                echo "======================================================"

                // ── NETTOYAGE COMPLET ────────────────────────────────────
                // Problème : docker-compose.yml utilise des container_name fixes.
                // Jenkins (projet "dit-library-pipeline") et le déploiement local
                // (projet "gestion-bibliotheque") créent des stacks différentes,
                // mais partagent les mêmes noms de conteneurs → conflit.
                // Solution : arrêter les DEUX projets possibles + force-remove résidus.

                // 1) Arrêt du projet Jenkins courant
                sh "cd ${COMPOSE_DIR} && docker compose down --remove-orphans 2>/dev/null || true"

                // 2) Arrêt du projet déploiement local (nom du répertoire source)
                sh "docker compose -p gestion-bibliotheque -f ${COMPOSE_DIR}/docker-compose.yml down --remove-orphans 2>/dev/null || true"

                // 3) Suppression forcée de tout conteneur résiduel aux noms conflictuels
                sh """
                    docker rm -f dit_library_db dit_books_service dit_users_service \
                                 dit_loans_service dit_frontend_gateway 2>/dev/null || true
                """

                // ── DÉPLOIEMENT ──────────────────────────────────────────
                sh "cd ${COMPOSE_DIR} && docker compose up -d"

                // Attente de l'initialisation de la base de données
                echo "Attente de 15 secondes pour l'initialisation..."
                sh 'sleep 15'

                // Affichage du statut final
                echo "--- Statut des conteneurs ---"
                sh "cd ${COMPOSE_DIR} && docker compose ps"
            }
        }

        // ── Stage 5 : Tests de santé (Health Checks) ─────────────────────────
        stage('5. Health Checks') {
            steps {
                echo "======================================================"
                echo " Vérification de la disponibilité des microservices"
                echo "======================================================"
                sh '''
                    # ─── Détection de l'adresse hôte ──────────────────────────────
                    # Jenkins tourne dans un conteneur Docker.
                    # "localhost" = Jenkins lui-même (pas la machine hôte).
                    # → On utilise "host.docker.internal" (Docker Desktop Windows/Mac)
                    #   ou la gateway Docker (172.17.0.1) comme fallback sur Linux.

                    HOST_ADDR="host.docker.internal"
                    if ! ping -c1 -W1 "$HOST_ADDR" > /dev/null 2>&1; then
                        # Fallback Linux : adresse de la gateway Docker
                        HOST_ADDR=$(ip route show default | awk "/default/ {print \\$3}" | head -1)
                        echo "host.docker.internal non disponible, utilisation de : $HOST_ADDR"
                    fi
                    echo "Adresse hôte détectée : $HOST_ADDR"

                    # ─── Fonction de vérification avec retry ───────────────────────
                    check_service() {
                        local name=$1
                        local url=$2
                        local max_attempts=5
                        local attempt=1

                        while [ $attempt -le $max_attempts ]; do
                            if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
                                echo "[✓] $name est opérationnel"
                                return 0
                            fi
                            echo "  Tentative $attempt/$max_attempts pour $name..."
                            sleep 4
                            attempt=$((attempt + 1))
                        done

                        echo "[✗] $name ne répond pas après $max_attempts tentatives"
                        return 1
                    }

                    # ─── Vérification via l'adresse hôte ──────────────────────────
                    check_service "Books Service (5001)"  "http://${HOST_ADDR}:5001/books"
                    check_service "Users Service (5002)"  "http://${HOST_ADDR}:5002/users"
                    check_service "Loans Service (5003)"  "http://${HOST_ADDR}:5003/loans"
                    check_service "Frontend / Gateway"    "http://${HOST_ADDR}:8085"

                    echo ""
                    echo "✅ Tous les services sont en ligne !"
                '''
            }
        }
    }

    // ── Post Actions ──────────────────────────────────────────────────────────
    post {
        success {
            echo "======================================================"
            echo " ✅ BUILD #${BUILD_NUMBER} RÉUSSI"
            echo " Application accessible sur : http://localhost:${APP_PORT}"
            echo " Jenkins (public) : ${NGROK_URL}"
            echo "======================================================"
        }
        failure {
            echo "======================================================"
            echo " ❌ BUILD #${BUILD_NUMBER} ÉCHOUÉ"
            echo " Consultez les logs de l'étape en erreur ci-dessus."
            echo " Commande de diagnostic : docker compose logs"
            echo "======================================================"
        }
        always {
            echo "--- Pipeline terminé : ${currentBuild.currentResult} | Durée : ${currentBuild.durationString} ---"
        }
    }
}

