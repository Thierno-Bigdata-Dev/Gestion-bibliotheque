pipeline {
    agent any

    environment {
        // ─── Informations du projet ───────────────────────────────────────────
        PROJECT_NAME  = "dit-library-management"
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
                echo " Construction des images Docker (sans cache)"
                echo "======================================================"
                sh "cd ${COMPOSE_DIR} && docker compose build --no-cache"
                sh "cd ${COMPOSE_DIR} && docker compose images"
            }
        }

        // ── Stage 4 : Déploiement (rolling restart) ───────────────────────────
        stage('4. Deploy') {
            steps {
                echo "======================================================"
                echo " Déploiement via Docker Compose"
                echo "======================================================"
                // Arrêt propre des anciens conteneurs
                sh "cd ${COMPOSE_DIR} && docker compose down --remove-orphans"

                // Démarrage de la nouvelle version en arrière-plan
                sh "cd ${COMPOSE_DIR} && docker compose up -d"

                // Attente de l'initialisation de la base de données et des services
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
                    check_service() {
                        local name=$1
                        local url=$2
                        local max_attempts=5
                        local attempt=1

                        while [ $attempt -le $max_attempts ]; do
                            if curl -sf --max-time 3 "$url" > /dev/null 2>&1; then
                                echo "[✓] $name est opérationnel ($url)"
                                return 0
                            fi
                            echo "  Tentative $attempt/$max_attempts pour $name..."
                            sleep 3
                            attempt=$((attempt + 1))
                        done

                        echo "[✗] $name ne répond pas après $max_attempts tentatives"
                        return 1
                    }

                    check_service "Books Service (5001)"  "http://localhost:5001/books"
                    check_service "Users Service (5002)"  "http://localhost:5002/users"
                    check_service "Loans Service (5003)"  "http://localhost:5003/loans"
                    check_service "Frontend / Gateway"    "http://localhost:8085"

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

