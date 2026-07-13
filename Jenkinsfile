pipeline {
    agent any

    triggers {
        // Polls GitHub every minute to see if there are changes. 
        // If webhooks are configured, you can also use githubPush()
        pollSCM('* * * * *')
        githubPush()
    }

    environment {
        PROJECT_NAME  = "CI-CD-Gestion-bibliotheque"
        DB_PORT       = "5445"
        BOOKS_PORT    = "5116"
        USERS_PORT    = "5115"
        LOANS_PORT    = "5117"
        FRONTEND_PORT = "8190"
        
        APP_PORT      = "8190"
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
                    # Detection de l'adresse de l'hote (Docker Desktop Windows/Mac vs Linux)
                    # On utilise host.docker.internal par defaut
                    HOST_ADDR="host.docker.internal"
                    
                    # On ne fait plus de 'ping' ni de 'ip route' car ces outils 
                    # ne sont pas installes dans le conteneur Jenkins.
                    # host.docker.internal fonctionne tres bien avec curl.

                    curl -sf "http://${HOST_ADDR}:${BOOKS_PORT}/books"  && echo "[✓] Books Service OK"  || (echo "[✗] Books Service KO"; exit 1)
                    curl -sf "http://${HOST_ADDR}:${USERS_PORT}/users"  && echo "[✓] Users Service OK"  || (echo "[✗] Users Service KO"; exit 1)
                    curl -sf "http://${HOST_ADDR}:${LOANS_PORT}/loans"  && echo "[✓] Loans Service OK"  || (echo "[✗] Loans Service KO"; exit 1)
                    curl -sf "http://${HOST_ADDR}:${FRONTEND_PORT}"        && echo "[✓] Frontend OK"       || (echo "[✗] Frontend KO"; exit 1)
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
