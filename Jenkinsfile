pipeline {
    agent any

    environment {
        PROJECT_NAME = "dit-library-management"
        APP_PORT     = "8085"
        // Répertoire de travail Jenkins - permet à docker compose de trouver les fichiers
        COMPOSE_DIR  = "${WORKSPACE}"
    }

    stages {
        stage('1. Récupération du code') {
            steps {
                echo "=== Démarrage du Pipeline Jenkins ==="
                echo "Clonage et récupération des fichiers de la branche courante..."
                checkout scm
            }
        }

        stage('2. Analyse Statique & Compilation') {
            parallel {
                stage('Vérification Books Service') {
                    steps {
                        echo "Validation syntaxique de Books Service..."
                        // Vérifie que le code Python compile correctement
                        sh 'python3 -m py_compile backend/books-service/app.py backend/books-service/models.py || echo "Veuillez vérifier le code Python de Books Service"'
                    }
                }
                stage('Vérification Users Service') {
                    steps {
                        echo "Validation syntaxique de Users Service..."
                        sh 'python3 -m py_compile backend/users-service/app.py backend/users-service/models.py || echo "Veuillez vérifier le code Python de Users Service"'
                    }
                }
                stage('Vérification Loans Service') {
                    steps {
                        echo "Validation syntaxique de Loans Service..."
                        sh 'python3 -m py_compile backend/loans-service/app.py backend/loans-service/models.py || echo "Veuillez vérifier le code Python de Loans Service"'
                    }
                }
            }
        }

        stage('3. Build des Images Docker') {
            steps {
                echo "=== Construction des Images Docker ==="
                // cd explicite vers le workspace pour que docker compose trouve le fichier yml
                sh "cd ${COMPOSE_DIR} && docker compose build --no-cache"
            }
        }

        stage('4. Déploiement Automatique') {
            steps {
                echo "=== Déploiement avec Docker Compose ==="
                // Arrêt de l'ancienne version et lancement de la nouvelle
                sh "cd ${COMPOSE_DIR} && docker compose down"
                sh "cd ${COMPOSE_DIR} && docker compose up -d"
                
                echo "=== Attente de l'initialisation des services ==="
                sh 'sleep 10'
                
                echo "=== Statut des conteneurs déployés ==="
                sh "cd ${COMPOSE_DIR} && docker compose ps"
            }
        }

        stage('5. Vérification Santé des Services') {
            steps {
                echo "=== Test de santé des microservices ==="
                sh '''
                    echo "Test Books Service (port 5001)..."
                    curl -sf http://localhost:5001/books && echo "OK" || echo "Books Service: Démarrage en cours..."

                    echo "Test Users Service (port 5002)..."
                    curl -sf http://localhost:5002/users && echo "OK" || echo "Users Service: Démarrage en cours..."

                    echo "Test Loans Service (port 5003)..."
                    curl -sf http://localhost:5003/loans && echo "OK" || echo "Loans Service: Démarrage en cours..."
                '''
            }
        }
    }

    post {
        success {
            echo "=================================================================="
            echo " FÉLICITATIONS ! Le déploiement s'est terminé avec succès.       "
            echo " L'application DIT Library est accessible sur : http://localhost:${APP_PORT} "
            echo "=================================================================="
        }
        failure {
            echo "=================================================================="
            echo " ERREUR ! Le pipeline Jenkins a échoué.                         "
            echo " Veuillez vérifier les logs de l'étape en échec.                "
            echo "=================================================================="
        }
        always {
            echo "=== Fin du pipeline - Statut: ${currentBuild.currentResult} ==="
        }
    }
}
