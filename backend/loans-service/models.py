import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class Loan(db.Model):
    __tablename__ = 'loans'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    book_id = db.Column(db.Integer, nullable=False)
    borrowed_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)
    due_at = db.Column(db.DateTime, nullable=False)
    returned_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='active', nullable=False) # 'active', 'returned'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'book_id': self.book_id,
            'borrowed_at': self.borrowed_at.isoformat() if self.borrowed_at else None,
            'due_at': self.due_at.isoformat() if self.due_at else None,
            'returned_at': self.returned_at.isoformat() if self.returned_at else None,
            'status': self.status
        }
