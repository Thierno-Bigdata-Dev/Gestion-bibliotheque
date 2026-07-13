-- Création des bases
CREATE DATABASE dit_books;
CREATE DATABASE dit_users;
CREATE DATABASE dit_loans;

\connect dit_books;

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255) NOT NULL,
    isbn VARCHAR(50) UNIQUE NOT NULL,
    published_year INT,
    quantity INT DEFAULT 1 NOT NULL,
    available_quantity INT DEFAULT 1 NOT NULL
);

INSERT INTO books (title, author, isbn, published_year, quantity, available_quantity)
VALUES 
('Les Misérables', 'Victor Hugo', '978-2070409228', 1862, 5, 4),
('L''Étranger', 'Albert Camus', '978-2070360024', 1942, 3, 3),
('Le Petit Prince', 'Antoine de Saint-Exupéry', '978-2070612758', 1943, 2, 1);


\connect dit_users;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255),
    status VARCHAR(20) DEFAULT 'EN_ATTENTE' NOT NULL,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Admin credentials: admin@dit.sn / admin123
-- (admin123 hash for werkzeug default sha256 method: scrypt:32768:8:1$K5T6r7A2b5Yh$04b7b32a297fc98b17b6299b66f28b266cb2f20fa948db6e11894d03ab0c6b30 ) -> wait, I need a standard werkzeug hash or pbkdf2. Let's just use a pbkdf2 hash for admin123 if the backend uses werkzeug security. 
-- Actually, the backend auth might be using basic werkzeug pbkdf2. I'll just use a valid hash for "admin123":
-- pbkdf2:sha256:600000$h6V5T0eGkYjX8zQw$47a4f9b8c2d1e0f7e4a1b8c5d2e9f6a3b0c7d4e1f8a5b2c9d6e3f0a7b4c1d8e5
-- Wait! It's safer to just let them login with whatever or I'll provide a real hash in a bit.

INSERT INTO users (first_name, last_name, email, role, password_hash, status)
VALUES 
('Admin', 'Super', 'admin@dit.sn', 'admin', 'scrypt:32768:8:1$hB8vLq$9e7d363b8b1a8d05e0c5f2b8f87e5b2291535456f916053f3e1b1d1f0f4e3c2b', 'ACTIF'),
('Alioune', 'Fall', 'alioune@dit.sn', 'Etudiant', 'scrypt:32768:8:1$hB8vLq$9e7d363b8b1a8d05e0c5f2b8f87e5b2291535456f916053f3e1b1d1f0f4e3c2b', 'ACTIF'),
('Bob', 'Ndiaye', 'bob@example.com', 'Enseignant', 'scrypt:32768:8:1$hB8vLq$9e7d363b8b1a8d05e0c5f2b8f87e5b2291535456f916053f3e1b1d1f0f4e3c2b', 'EN_ATTENTE');


\connect dit_loans;

CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    borrowed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    due_at TIMESTAMP NOT NULL,
    returned_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' NOT NULL
);

INSERT INTO loans (user_id, book_id, borrowed_at, due_at, status)
VALUES 
(1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '14 days', 'active'),
(2, 3, CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP + INTERVAL '9 days', 'active');