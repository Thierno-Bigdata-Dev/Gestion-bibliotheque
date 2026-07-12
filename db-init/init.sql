-- Création des bases
CREATE DATABASE dit_books;

CREATE DATABASE dit_users;

CREATE DATABASE dit_loans;

\connect dit_books;

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    published_year INT,
    available BOOLEAN DEFAULT TRUE
);

INSERT INTO
    books (
        title,
        author,
        published_year,
        available
    )
VALUES (
        'Les Misérables',
        'Victor Hugo',
        1862,
        TRUE
    ),
    (
        'L\'Étranger',
        'Albert Camus',
        1942,
        TRUE
    ),
    (
        'Le Petit Prince',
        'Antoine de Saint-Exupéry',
        1943,
        TRUE
    );

\connect dit_users;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO
    users (name, email)
VALUES (
        'Alioune Fall',
        '[EMAIL_ADDRESS]'
    ),
    (
        'Bob Ndiaye',
        'bob@example.com'
    );

\connect dit_loans;

CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    loan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    return_date TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (book_id) REFERENCES books (id)
);

INSERT INTO
    loans (user_id, book_id, loan_date)
VALUES (1, 1, CURRENT_TIMESTAMP),
    (2, 2, CURRENT_TIMESTAMP);