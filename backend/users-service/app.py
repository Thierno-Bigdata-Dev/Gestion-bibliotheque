import os
import time
import datetime
import jwt
import bcrypt
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy.exc import OperationalError
from models import db, User
from functools import wraps

app = Flask(__name__)
CORS(app)

# Configuration
db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/dit_users')
JWT_SECRET = os.environ.get('JWT_SECRET', 'dit-library-secret-key-2026')
JWT_EXPIRY_HOURS = 8

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

VALID_ROLES = {'Etudiant', 'Enseignant', 'Admin'}

# ─────────────────────────────────────────────
# JWT HELPERS
# ─────────────────────────────────────────────

def generate_token(user):
    payload = {
        'user_id': user.id,
        'email': user.email,
        'role': user.role,
        'status': user.status,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRY_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token manquant'}), 401
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Session expirée. Veuillez vous reconnecter.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token invalide'}), 401
        return f(payload, *args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token manquant'}), 401
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Session expirée'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token invalide'}), 401
        if payload.get('role') != 'Admin':
            return jsonify({'error': 'Accès réservé aux administrateurs'}), 403
        return f(payload, *args, **kwargs)
    return decorated

# ─────────────────────────────────────────────
# DB INIT + ADMIN SEED
# ─────────────────────────────────────────────

def seed_admin():
    """Crée le compte admin par défaut s'il n'existe pas."""
    try:
        db.session.rollback()  # Assure un état propre de la session
        admin = User.query.filter_by(email='admin@dit.sn').first()
        if not admin:
            pw_hash = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            admin = User(
                first_name='Super',
                last_name='Admin',
                email='admin@dit.sn',
                role='Admin',
                password_hash=pw_hash,
                status='ACTIF'
            )
            db.session.add(admin)
            db.session.commit()
            print("Compte admin par défaut créé : admin@dit.sn / admin123")
        else:
            print("Compte admin déjà existant.")
    except Exception as e:
        db.session.rollback()
        print(f"Seed admin ignoré (probable doublon ou erreur): {e}")

def init_db():
    retries = 10
    while retries > 0:
        try:
            with app.app_context():
                db.create_all()
                seed_admin()
                print("Base de données Users initialisée avec succès.")
                return
        except OperationalError as e:
            print(f"Erreur de connexion à la base de données Users. Essai restant: {retries}. Erreur: {e}")
            retries -= 1
            time.sleep(3)
    print("Impossible de se connecter à la base de données Users après plusieurs tentatives.")

# ─────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'users-service'}), 200

@app.route('/auth/register', methods=['POST'])
def register():
    """Inscription publique. Compte créé avec statut EN_ATTENTE."""
    data = request.get_json() or {}
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role = data.get('role', 'Etudiant')

    if not first_name or not last_name or not email or not password:
        return jsonify({'error': 'Tous les champs sont obligatoires.'}), 400

    if role not in {'Etudiant', 'Enseignant'}:
        return jsonify({'error': 'Le rôle doit être Etudiant ou Enseignant.'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Le mot de passe doit contenir au moins 6 caractères.'}), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': 'Un compte avec cet email existe déjà.'}), 409

    pw_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role,
        password_hash=pw_hash,
        status='EN_ATTENTE'
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message': 'Votre compte a été créé. En attente de validation par un administrateur.',
        'user': user.to_dict()
    }), 201

@app.route('/auth/login', methods=['POST'])
def login():
    """Connexion. Retourne un JWT si les identifiants sont corrects et le compte est ACTIF."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email et mot de passe requis.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash:
        return jsonify({'error': 'Email ou mot de passe incorrect.'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return jsonify({'error': 'Email ou mot de passe incorrect.'}), 401

    if user.status == 'EN_ATTENTE':
        return jsonify({'error': 'Votre compte est en attente de validation par un administrateur.'}), 403

    if user.status == 'REJETÉ':
        return jsonify({'error': 'Votre compte a été rejeté. Contactez l\'administration.'}), 403

    if user.status == 'SUSPENDU':
        return jsonify({'error': 'Votre compte a été suspendu. Contactez l\'administration.'}), 403

    # Mise à jour last_login
    user.last_login = datetime.datetime.utcnow()
    db.session.commit()

    token = generate_token(user)
    return jsonify({
        'token': token,
        'user': user.to_dict()
    }), 200

@app.route('/auth/me', methods=['GET'])
@token_required
def get_me(payload):
    """Retourne le profil de l'utilisateur connecté depuis le token."""
    user = User.query.get(payload['user_id'])
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    return jsonify(user.to_dict()), 200

# ─────────────────────────────────────────────
# USERS ENDPOINTS (admin)
# ─────────────────────────────────────────────

@app.route('/users', methods=['GET'])
def get_users():
    """Liste tous les utilisateurs actifs (pour les selects, etc.)"""
    users = User.query.filter_by(status='ACTIF').all()
    return jsonify([u.to_dict() for u in users]), 200

@app.route('/users/all', methods=['GET'])
@admin_required
def get_all_users(payload):
    """Admin : tous les utilisateurs tous statuts confondus."""
    users = User.query.all()
    return jsonify([u.to_dict() for u in users]), 200

@app.route('/users/pending', methods=['GET'])
@admin_required
def get_pending_users(payload):
    """Admin : liste les comptes en attente de validation."""
    users = User.query.filter_by(status='EN_ATTENTE').all()
    return jsonify([u.to_dict() for u in users]), 200

@app.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200

@app.route('/users/<int:user_id>/validate', methods=['PUT'])
@admin_required
def validate_user(payload, user_id):
    """Admin : valide un compte EN_ATTENTE → ACTIF."""
    user = User.query.get_or_404(user_id)
    user.status = 'ACTIF'
    db.session.commit()
    return jsonify({'message': f'Compte de {user.first_name} {user.last_name} validé.', 'user': user.to_dict()}), 200

@app.route('/users/<int:user_id>/reject', methods=['PUT'])
@admin_required
def reject_user(payload, user_id):
    """Admin : rejette un compte."""
    user = User.query.get_or_404(user_id)
    user.status = 'REJETÉ'
    db.session.commit()
    return jsonify({'message': f'Compte de {user.first_name} {user.last_name} rejeté.', 'user': user.to_dict()}), 200

@app.route('/users/<int:user_id>/suspend', methods=['PUT'])
@admin_required
def suspend_user(payload, user_id):
    """Admin : suspend un compte actif."""
    user = User.query.get_or_404(user_id)
    user.status = 'SUSPENDU'
    db.session.commit()
    return jsonify({'message': f'Compte suspendu.', 'user': user.to_dict()}), 200

@app.route('/users', methods=['POST'])
@admin_required
def create_user(payload):
    """Admin : création directe d'un utilisateur (déjà actif)."""
    data = request.get_json() or {}
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    email = data.get('email', '').strip().lower()
    role = data.get('role', 'Etudiant')

    if not first_name or not last_name or not email or not role:
        return jsonify({'error': 'Prénom, nom, email et rôle sont requis.'}), 400

    if role not in VALID_ROLES:
        return jsonify({'error': f"Rôle invalide. Choisissez parmi : {', '.join(VALID_ROLES)}"}), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({'error': f"Un utilisateur avec l'email {email} existe déjà."}), 409

    # Si l'admin crée le compte directement, il est ACTIF
    # Mot de passe temporaire = prénom en minuscule + "123"
    temp_password = f"{first_name.lower()}123"
    pw_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role,
        password_hash=pw_hash,
        status='ACTIF'
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201

@app.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(payload, user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    new_email = data.get('email')
    if new_email and new_email != user.email:
        existing = User.query.filter_by(email=new_email).first()
        if existing:
            return jsonify({'error': f"Un utilisateur avec l'email {new_email} existe déjà."}), 409
        user.email = new_email

    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    if 'role' in data:
        role = data['role']
        if role not in VALID_ROLES:
            return jsonify({'error': f"Rôle invalide."}), 400
        user.role = role

    db.session.commit()
    return jsonify(user.to_dict()), 200

@app.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(payload, user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Profil supprimé.'}), 200

# ─────────────────────────────────────────────
# START
# ─────────────────────────────────────────────

init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    app.run(host='0.0.0.0', port=port)
