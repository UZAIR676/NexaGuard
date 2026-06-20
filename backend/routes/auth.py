from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import psycopg2
import hashlib
import os
import secrets
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD")


def get_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def init_db():
    con = get_connection()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id       SERIAL PRIMARY KEY,
            name     TEXT NOT NULL,
            email    TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            token    TEXT
        )
    """)
    con.commit()
    cur.close()
    con.close()


init_db()


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


# --- Schemas ---
class SignupIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


# --- Routes ---
@router.post("/signup")
def signup(body: SignupIn):
    con = get_connection()
    cur = con.cursor()
    try:
        token = secrets.token_hex(32)
        cur.execute(
            "INSERT INTO users (name, email, password, token) VALUES (%s, %s, %s, %s)",
            (body.name.strip(), body.email.lower().strip(), hash_pw(body.password), token)
        )
        con.commit()
        cur.execute("SELECT id, name, email FROM users WHERE email=%s", (body.email.lower(),))
        row = cur.fetchone()
        return {"token": token, "user": {"id": row[0], "name": row[1], "email": row[2]}}
    except psycopg2.errors.UniqueViolation:
        con.rollback()
        raise HTTPException(400, "Email already registered")
    finally:
        cur.close()
        con.close()


@router.post("/login")
def login(body: LoginIn):
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute(
            "SELECT id, name, email, password FROM users WHERE email=%s",
            (body.email.lower().strip(),)
        )
        row = cur.fetchone()
        if not row or row[3] != hash_pw(body.password):
            raise HTTPException(401, "Invalid email or password")
        token = secrets.token_hex(32)
        cur.execute("UPDATE users SET token=%s WHERE id=%s", (token, row[0]))
        con.commit()
        return {"token": token, "user": {"id": row[0], "name": row[1], "email": row[2]}}
    finally:
        cur.close()
        con.close()


@router.get("/me")
def me(token: str):
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute("SELECT id, name, email FROM users WHERE token=%s", (token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(401, "Invalid token")
        return {"id": row[0], "name": row[1], "email": row[2]}
    finally:
        cur.close()
        con.close()


class UpdateIn(BaseModel):
    token: str
    name: str


@router.post("/update")
def update_profile(body: UpdateIn):
    con = get_connection()
    cur = con.cursor()
    try:
        cur.execute("SELECT id FROM users WHERE token=%s", (body.token,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(401, "Invalid token")
        cur.execute("UPDATE users SET name=%s WHERE id=%s", (body.name.strip(), row[0]))
        con.commit()
        return {"success": True, "name": body.name.strip()}
    finally:
        cur.close()
        con.close()