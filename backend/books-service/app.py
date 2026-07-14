import os
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy.exc import OperationalError
from models import db, Book

app = Flask(__name__)
CORS(app)

# Configuration database
db_url = os.environ.get('DATABASE_URL', 'postgresql://postgres:postgres@db:5432/dit_books')
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Attente active de la base de données au démarrage (production-ready retry loop)
def init_db():
    retries = 10
    while retries > 0:
        try:
            with app.app_context():
                db.create_all()
                print("Base de données initialisée avec succès.")
                return
        except OperationalError as e:
            print(f"Erreur de connexion à la base de données. Essai restant: {retries}. Erreur: {e}")
            retries -= 1
            time.sleep(3)
    print("Impossible de se connecter à la base de données après plusieurs tentatives.")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'books-service'}), 200

@app.route('/books', methods=['GET'])
def get_books():
    q = request.args.get('q')
    title = request.args.get('title')
    author = request.args.get('author')
    isbn = request.args.get('isbn')
    
    query = Book.query
    
    if q:
        query = query.filter(
            (Book.title.ilike(f'%{q}%')) | 
            (Book.author.ilike(f'%{q}%')) | 
            (Book.isbn.ilike(f'%{q}%'))
        )
    else:
        if title:
            query = query.filter(Book.title.ilike(f'%{title}%'))
        if author:
            query = query.filter(Book.author.ilike(f'%{author}%'))
        if isbn:
            query = query.filter(Book.isbn.ilike(f'%{isbn}%'))
            
    books = query.all()
    return jsonify([book.to_dict() for book in books]), 200

@app.route('/books/<int:book_id>', methods=['GET'])
def get_book(book_id):
    book = Book.query.get_or_404(book_id)
    return jsonify(book.to_dict()), 200

@app.route('/books', methods=['POST'])
def create_book():
    data = request.get_json() or {}
    if not data.get('title') or not data.get('author') or not data.get('isbn'):
        return jsonify({'error': 'Title, author, and isbn are required'}), 400
        
    existing = Book.query.filter_by(isbn=data['isbn']).first()
    if existing:
        return jsonify({'error': f"A book with ISBN {data['isbn']} already exists"}), 409
        
    qty = int(data.get('quantity', 1))
    book = Book(
        title=data['title'],
        author=data['author'],
        isbn=data['isbn'],
        published_year=data.get('published_year'),
        quantity=qty,
        available_quantity=qty
    )
    
    db.session.add(book)
    db.session.commit()
    return jsonify(book.to_dict()), 201

@app.route('/books/<int:book_id>', methods=['PUT'])
def update_book(book_id):
    book = Book.query.get_or_404(book_id)
    data = request.get_json() or {}
    
    # Valider le nouvel ISBN si changé
    new_isbn = data.get('isbn')
    if new_isbn and new_isbn != book.isbn:
        existing = Book.query.filter_by(isbn=new_isbn).first()
        if existing:
            return jsonify({'error': f"A book with ISBN {new_isbn} already exists"}), 409
        book.isbn = new_isbn
        
    if 'title' in data:
        book.title = data['title']
    if 'author' in data:
        book.author = data['author']
    if 'published_year' in data:
        book.published_year = data['published_year']
        
    # Gérer la mise à jour des quantités de manière cohérente
    if 'quantity' in data:
        new_qty = int(data['quantity'])
        diff = new_qty - book.quantity
        book.quantity = new_qty
        # Adapter la quantité disponible
        book.available_quantity = max(0, book.available_quantity + diff)

    db.session.commit()
    return jsonify(book.to_dict()), 200

@app.route('/books/<int:book_id>', methods=['DELETE'])
def delete_book(book_id):
    book = Book.query.get_or_404(book_id)
    db.session.delete(book)
    db.session.commit()
    return jsonify({'message': 'Book deleted successfully'}), 200

@app.route('/books/<int:book_id>/borrow', methods=['POST'])
def borrow_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.available_quantity <= 0:
        return jsonify({'error': 'No available copies of this book'}), 400
        
    book.available_quantity -= 1
    db.session.commit()
    return jsonify(book.to_dict()), 200

@app.route('/books/<int:book_id>/return', methods=['POST'])
def return_book(book_id):
    book = Book.query.get_or_404(book_id)
    if book.available_quantity >= book.quantity:
        # Permettre le retour mais plafonner à quantity
        book.available_quantity = book.quantity
    else:
        book.available_quantity += 1
        
    db.session.commit()
    return jsonify(book.to_dict()), 200

# Initialiser la base de données lors de l'importation du module (requis pour Gunicorn)
init_db()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
