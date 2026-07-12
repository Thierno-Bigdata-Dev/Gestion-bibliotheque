import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy.exc import OperationalError
from models import db, User

app = Flask(__name__)
CORS(app)

# Configuration database
db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/dit_users')
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

VALID_ROLES = {'Etudiant', 'Professeur', 'Personnel administratif'}

def init_db():
    retries = 10
    while retries > 0:
        try:
            with app.app_context():
                db.create_all()
                print("Base de données Users initialisée avec succès.")
                return
        except OperationalError as e:
            print(f"Erreur de connexion à la base de données Users. Essai restant: {retries}. Erreur: {e}")
            retries -= 1
            time.sleep(3)
    print("Impossible de se connecter à la base de données Users après plusieurs tentatives.")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'users-service'}), 200

@app.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users]), 200

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200

@app.route('/users', methods=['POST'])
def create_user():
    data = request.get_json() or {}
    first_name = data.get('first_name')
    last_name = data.get('last_name')
    email = data.get('email')
    role = data.get('role')
    
    if not first_name or not last_name or not email or not role:
        return jsonify({'error': 'First name, last name, email, and role are required'}), 400
        
    if role not in VALID_ROLES:
        return jsonify({'error': f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}"}), 400
        
    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': f"User with email {email} already exists"}), 409
        
    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role
    )
    
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@app.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}
    
    # Valider le nouvel email si changé
    new_email = data.get('email')
    if new_email and new_email != user.email:
        existing = User.query.filter_by(email=new_email).first()
        if existing:
            return jsonify({'error': f"User with email {new_email} already exists"}), 409
        user.email = new_email
        
    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
        
    if 'role' in data:
        role = data['role']
        if role not in VALID_ROLES:
            return jsonify({'error': f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}"}), 400
        user.role = role
        
    db.session.commit()
    return jsonify(user.to_dict()), 200

@app.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'User profile deleted successfully'}), 200

# Initialiser la base de données lors de l'importation du module (requis pour Gunicorn)
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(host='0.0.0.0', port=port)
