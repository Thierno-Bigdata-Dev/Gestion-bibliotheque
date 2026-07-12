pipeline {
    agent any

    environment {
        PROJECT_NAME  = "CI-CD-Gestion-bibliotheque"
        APP_PORT      = "8090"
        JENKINS_PORT  = "8080"
        COMPOSE_DIR   = "${WORKSPACE}"
        NGROK_URL     = "https://threefold-sculpture-chest.ngrok-free.dev"
    }

    stages {
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

        stage('2. Lint & Analyse Statique') {
            parallel {
                stage('Books Service') {
                    steps {
                        sh 'python3 -m py_compile backend/books-service/app.py backend/books-service/models.py'
                    }
                }
                stage('Users Service') {
                    steps {
                        sh 'python3 -m py_compile backend/users-service/app.py backend/users-service/models.py'
                    }
                }
                stage('Loans Service') {
                    steps {
                        sh 'python3 -m py_compile backend/loans-service/app.py backend/loans-service/models.py'
                    }
                }
            }
        }

        stage('3. Docker Build') {
            steps {
                echo "======================================================"
                echo " Construction des images Docker"
                echo "======================================================"
                sh "cd ${COMPOSE_DIR} && docker compose build --pull"
                // Liste explicitement les services au lieu de laisser Jenkins chercher les container_name
                // On ajoute || true pour eviter de bloquer le build en cas de conteneur orphelin/stale
                sh "cd ${COMPOSE_DIR} && docker compose images frontend books-service users-service loans-service db || true"
            }
        }


        stage('4. Deploy') {
            steps {
                echo "======================================================"
                echo " Déploiement via Docker Compose"
                echo "======================================================"
                sh "cd ${COMPOSE_DIR} && docker compose down --remove-orphans || true"
                sh "cd ${COMPOSE_DIR} && docker compose up -d"
                sh 'sleep 15'
                sh "cd ${COMPOSE_DIR} && docker compose ps"
            }
        }

        stage('5. Health Checks') {
            steps {
                sh '''
                    HOST_ADDR="host.docker.internal"
                    if ! ping -c1 -W1 "$HOST_ADDR" > /dev/null 2>&1; then
                        HOST_ADDR=$(ip route show default | awk "/default/ {print \\$3}" | head -1)
                    fi
                    echo "Adresse hôte détectée : $HOST_ADDR"

                    curl -sf "http://${HOST_ADDR}:5006/books"  && echo "[✓] Books Service OK"  || echo "[✗] Books Service KO"
                    curl -sf "http://${HOST_ADDR}:5005/users"  && echo "[✓] Users Service OK"  || echo "[✗] Users Service KO"
                    curl -sf "http://${HOST_ADDR}:5007/loans"  && echo "[✓] Loans Service OK"  || echo "[✗] Loans Service KO"
                    curl -sf "http://${HOST_ADDR}:8090"        && echo "[✓] Frontend OK"       || echo "[✗] Frontend KO"
                '''
            }
        }
    }

    post {
        success {
            echo "✅ BUILD #${BUILD_NUMBER} RÉUSSI - Application sur http://localhost:${APP_PORT}"
        }
        failure {
            echo "❌ BUILD #${BUILD_NUMBER} ÉCHOUÉ - Consultez les logs"
        }
        always {
            echo "--- Pipeline terminé : ${currentBuild.currentResult} ---"
        }
    }
}
