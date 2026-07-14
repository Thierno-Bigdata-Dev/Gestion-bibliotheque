import os
import time
import datetime
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy.exc import OperationalError
from models import db, Loan

app = Flask(__name__)
CORS(app)

# Configuration database et services tiers
db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/dit_loans')
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

BOOKS_SERVICE_URL = os.environ.get('BOOKS_SERVICE_URL', 'http://books-service:5001')
USERS_SERVICE_URL = os.environ.get('USERS_SERVICE_URL', 'http://users-service:5002')

db.init_app(app)

def init_db():
    retries = 10
    while retries > 0:
        try:
            with app.app_context():
                db.create_all()
                print("Base de données Loans initialisée avec succès.")
                return
        except OperationalError as e:
            print(f"Erreur de connexion à la base de données Loans. Essai restant: {retries}. Erreur: {e}")
            retries -= 1
            time.sleep(3)
    print("Impossible de se connecter à la base de données Loans après plusieurs tentatives.")

def enrich_loan_data(loan):
    loan_dict = loan.to_dict()
    
    # Récupérer les informations de l'utilisateur
    try:
        r = requests.get(f"{USERS_SERVICE_URL}/users/{loan.user_id}", timeout=2)
        if r.status_code == 200:
            u = r.json()
            loan_dict['user'] = {
                'first_name': u['first_name'],
                'last_name': u['last_name'],
                'email': u['email'],
                'role': u['role']
            }
        else:
            loan_dict['user'] = {'first_name': 'Inconnu', 'last_name': 'Utilisateur', 'email': '', 'role': ''}
    except Exception as e:
        print(f"Erreur lors de la récupération de l'utilisateur {loan.user_id}: {e}")
        loan_dict['user'] = {'first_name': 'Erreur', 'last_name': 'Réseau', 'email': '', 'role': ''}

    # Récupérer les informations du livre
    try:
        r = requests.get(f"{BOOKS_SERVICE_URL}/books/{loan.book_id}", timeout=2)
        if r.status_code == 200:
            b = r.json()
            loan_dict['book'] = {
                'title': b['title'],
                'author': b['author'],
                'isbn': b['isbn']
            }
        else:
            loan_dict['book'] = {'title': 'Livre Inconnu', 'author': '', 'isbn': ''}
    except Exception as e:
        print(f"Erreur lors de la récupération du livre {loan.book_id}: {e}")
        loan_dict['book'] = {'title': 'Erreur Réseau', 'author': '', 'isbn': ''}
        
    return loan_dict

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'loans-service'}), 200

@app.route('/loans', methods=['GET'])
def get_loans():
    loans = Loan.query.order_by(Loan.borrowed_at.desc()).all()
    # Enrichir les données pour le frontend
    enriched = [enrich_loan_data(loan) for loan in loans]
    return jsonify(enriched), 200

@app.route('/loans/user/<int:user_id>', methods=['GET'])
def get_user_loans(user_id):
    loans = Loan.query.filter_by(user_id=user_id).order_by(Loan.borrowed_at.desc()).all()
    enriched = [enrich_loan_data(loan) for loan in loans]
    return jsonify(enriched), 200

@app.route('/loans', methods=['POST'])
def create_loan():
    data = request.get_json() or {}
    user_id = data.get('user_id')
    book_id = data.get('book_id')
    
    if not user_id or not book_id:
        return jsonify({'error': 'user_id and book_id are required'}), 400
        
    # 1. Vérifier si l'utilisateur existe
    try:
        user_resp = requests.get(f"{USERS_SERVICE_URL}/users/{user_id}", timeout=2)
        if user_resp.status_code != 200:
            return jsonify({'error': f"User with ID {user_id} not found"}), 404
        user_data = user_resp.json()
        user_role = user_data.get('role', '')
    except requests.exceptions.RequestException:
        return jsonify({'error': 'Users service is currently unavailable'}), 503
        
    # 2. Vérifier si le livre existe et est disponible
    try:
        book_resp = requests.get(f"{BOOKS_SERVICE_URL}/books/{book_id}", timeout=2)
        if book_resp.status_code != 200:
            return jsonify({'error': f"Book with ID {book_id} not found"}), 404
            
        book_data = book_resp.json()
        if book_data.get('available_quantity', 0) <= 0:
            return jsonify({'error': 'This book is currently out of stock and cannot be borrowed'}), 400
    except requests.exceptions.RequestException:
        return jsonify({'error': 'Books service is currently unavailable'}), 503
        
    # 3. Réserver le livre (décrémenter la quantité)
    try:
        borrow_resp = requests.post(f"{BOOKS_SERVICE_URL}/books/{book_id}/borrow", timeout=2)
        if borrow_resp.status_code != 200:
            return jsonify({'error': 'Failed to reserve the book'}), 500
    except requests.exceptions.RequestException:
        return jsonify({'error': 'Failed to communicate with Books service to reserve'}), 503
        
    # 4. Enregistrer l'emprunt
    borrow_date = datetime.datetime.utcnow()
    due_date = borrow_date + datetime.timedelta(days=15) # Durée standard d'emprunt : 15 jours
    
    initial_status = 'active' if user_role == 'Admin' else 'pending'
    
    loan = Loan(
        user_id=user_id,
        book_id=book_id,
        borrowed_at=borrow_date,
        due_at=due_date,
        status=initial_status
    )
    
    db.session.add(loan)
    db.session.commit()
    
    return jsonify(enrich_loan_data(loan)), 201

@app.route('/loans/<int:loan_id>/approve', methods=['POST'])
def approve_loan(loan_id):
    loan = Loan.query.get_or_404(loan_id)
    if loan.status != 'pending':
        return jsonify({'error': 'Only pending loans can be approved'}), 400
    
    loan.status = 'active'
    db.session.commit()
    return jsonify(enrich_loan_data(loan)), 200

@app.route('/loans/<int:loan_id>/reject', methods=['POST'])
def reject_loan(loan_id):
    loan = Loan.query.get_or_404(loan_id)
    if loan.status != 'pending':
        return jsonify({'error': 'Only pending loans can be rejected'}), 400
        
    try:
        # Restituer la quantité disponible du livre
        return_resp = requests.post(f"{BOOKS_SERVICE_URL}/books/{loan.book_id}/return", timeout=2)
        if return_resp.status_code != 200:
            print(f"Warning: Failed to restock book {loan.book_id} upon rejection")
    except requests.exceptions.RequestException:
        print(f"Warning: Books service unavailable for restock book {loan.book_id} upon rejection")
        
    loan.status = 'rejected'
    db.session.commit()
    return jsonify(enrich_loan_data(loan)), 200

@app.route('/loans/<int:loan_id>/return', methods=['POST'])
def return_loan(loan_id):
    loan = Loan.query.get_or_404(loan_id)
    
    if loan.status == 'returned':
        return jsonify({'error': 'This loan has already been returned'}), 400
        
    # 1. Retourner le livre (incrémenter la quantité)
    try:
        return_resp = requests.post(f"{BOOKS_SERVICE_URL}/books/{loan.book_id}/return", timeout=2)
        if return_resp.status_code != 200:
            return jsonify({'error': 'Failed to return the book in the inventory'}), 500
    except requests.exceptions.RequestException:
        return jsonify({'error': 'Failed to communicate with Books service to return'}), 503
        
    # 2. Mettre à jour l'emprunt
    loan.status = 'returned'
    loan.returned_at = datetime.datetime.utcnow()
    db.session.commit()
    
    return jsonify(enrich_loan_data(loan)), 200

@app.route('/loans/<int:loan_id>/renew', methods=['POST'])
def renew_loan(loan_id):
    loan = Loan.query.get_or_404(loan_id)
    
    if loan.status == 'returned':
        return jsonify({'error': 'Cannot renew a returned loan'}), 400
        
    # Ajouter 15 jours à la date limite actuelle
    if loan.due_at:
        loan.due_at = loan.due_at + datetime.timedelta(days=15)
    else:
        loan.due_at = datetime.datetime.utcnow() + datetime.timedelta(days=15)
        
    db.session.commit()
    
    return jsonify(enrich_loan_data(loan)), 200

# Initialiser la base de données lors de l'importation du module (requis pour Gunicorn)
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5003))
    app.run(host='0.0.0.0', port=port)
