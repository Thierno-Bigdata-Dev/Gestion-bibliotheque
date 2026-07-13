from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Book(db.Model):
    __tablename__ = 'books'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    author = db.Column(db.String(255), nullable=False)
    isbn = db.Column(db.String(50), unique=True, nullable=False)
    published_year = db.Column(db.Integer, nullable=True)
    quantity = db.Column(db.Integer, default=1, nullable=False)
    available_quantity = db.Column(db.Integer, default=1, nullable=False)
    category = db.Column(db.String(100), default='Autre')
    image_url = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'author': self.author,
            'isbn': self.isbn,
            'published_year': self.published_year,
            'quantity': self.quantity,
            'available_quantity': self.available_quantity,
            'category': self.category,
            'image_url': self.image_url
        }
