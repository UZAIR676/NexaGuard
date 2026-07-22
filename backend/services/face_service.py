"""
NexaGuard Face Recognition + Liveness Detection Service
Fully local — no external API. Embeddings stored in Supabase PostgreSQL.
"""
import cv2
import numpy as np
import os
import json
import base64
from deepface import DeepFace
from datetime import datetime
from routes.auth import get_db

DETECTOR_BACKEND = "mtcnn"

# ── DB setup ──────────────────────────────────────────────────────────────
def _init_face_table():
    con = get_db()
    cur = con.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS face_embeddings (
            user_id       INTEGER PRIMARY KEY REFERENCES users(id),
            email         TEXT,
            embedding     TEXT NOT NULL,
            confidence    REAL,
            registered_at TIMESTAMP DEFAULT NOW()
        )
    """)
    con.commit()
    cur.close()
    con.close()

_init_face_table()

# ── Base64 image → numpy array ────────────────────────────────────────────
def b64_to_img(b64_str: str) -> np.ndarray:
    if "," in b64_str:
        b64_str = b64_str.split(",")[1]
    img_bytes = base64.b64decode(b64_str)
    arr       = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def img_to_b64(img: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img)
    return base64.b64encode(buf).decode("utf-8")

# ── Face extract + embedding ──────────────────────────────────────────────
def get_embedding(img: np.ndarray) -> dict:
    try:
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # enforce_detection=False — low light ya angle mein bhi kaam kare
        faces = DeepFace.extract_faces(
            rgb_img,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False,   # ← FIX: pehle True tha
            anti_spoofing=False
        )

        if not faces:
            return {"error": "No face detected. Please face the camera directly."}

        face_conf = float(faces[0].get("confidence", 0.9))

        # mtcnn ke saath 0 confidence bhi aa sakta hai — agar face area hai toh allow karo
        facial_area = faces[0].get("facial_area", {})
        if face_conf < 0.3 and not facial_area:
            return {"error": f"Face confidence too low ({face_conf:.2f}). Improve lighting and try again."}

        emb = DeepFace.represent(
            rgb_img,
            model_name="Facenet",
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=False
        )

        if not emb:
            return {"error": "Could not generate face embedding. Try again."}

        return {
            "embedding":   emb[0]["embedding"],
            "confidence":  max(face_conf, 0.9) if face_conf == 0 else face_conf,
            "facial_area": facial_area
        }
    except Exception as e:
        print("FACE ERROR:", repr(e))
        return {"error": str(e)}

# ── Register face ─────────────────────────────────────────────────────────
def register_face(user_id: int, email: str, img_b64: str) -> dict:
    img = b64_to_img(img_b64)
    if img is None:
        return {"error": "Invalid image — could not decode"}

    result = get_embedding(img)
    if "error" in result:
        return result

    confidence     = float(result.get("confidence", 0))
    embedding_json = json.dumps(result["embedding"])

    con = get_db()
    cur = con.cursor()
    try:
        cur.execute("""
            INSERT INTO face_embeddings (user_id, email, embedding, confidence, registered_at)
            VALUES (%s, %s, %s, %s, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                email         = EXCLUDED.email,
                embedding     = EXCLUDED.embedding,
                confidence    = EXCLUDED.confidence,
                registered_at = NOW()
        """, (user_id, email, embedding_json, confidence))
        con.commit()
    finally:
        cur.close()
        con.close()

    print(f"✅ Face registered — user_id: {user_id} | confidence: {confidence:.2f}")

    return {
        "success":    True,
        "confidence": confidence,
        "message":    "Face registered successfully"
    }

# ── Verify face ───────────────────────────────────────────────────────────
def verify_face(user_id: int, img_b64: str) -> dict:
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT embedding FROM face_embeddings WHERE user_id=%s", (user_id,))
    row = cur.fetchone()
    cur.close()
    con.close()

    if not row:
        return {"error": "Face not registered", "registered": False, "verified": False}

    img = b64_to_img(img_b64)
    if img is None:
        return {"error": "Invalid image", "verified": False}

    result = get_embedding(img)
    if "error" in result:
        return {"error": result["error"], "verified": False}

    stored_emb = np.array(json.loads(row["embedding"]))
    live_emb   = np.array(result["embedding"])

    # Cosine similarity
    similarity = float(np.dot(stored_emb, live_emb) / (
        np.linalg.norm(stored_emb) * np.linalg.norm(live_emb)
    ))

    verified   = similarity >= 0.70
    risk_score = round((1 - similarity) * 100, 2)

    return {
        "verified":   verified,
        "similarity": round(similarity, 4),
        "risk_score": risk_score,
        "confidence": result["confidence"],
        "message":    "Face verified successfully!" if verified else "Face does not match."
    }

# ── Liveness Detection ────────────────────────────────────────────────────
def check_liveness(frames_b64: list) -> dict:
    if len(frames_b64) < 3:
        return {"error": "At least 3 frames required", "live": False}

    imgs           = []
    face_positions = []

    for b64 in frames_b64:
        img = b64_to_img(b64)
        if img is None:
            continue
        try:
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            faces = DeepFace.extract_faces(
                rgb_img,
                detector_backend=DETECTOR_BACKEND,
                enforce_detection=False,
                anti_spoofing=False
            )
            if faces and faces[0].get("confidence", 0) > 0.3:
                area = faces[0]["facial_area"]
                face_positions.append((area["x"], area["y"], area["w"], area["h"]))
                imgs.append(img)
        except Exception as e:
            print("LIVENESS FRAME ERROR:", repr(e))

    if len(imgs) < 2:
        return {"live": False, "reason": "Face not visible in enough frames"}

    # Check 1: Brightness variation
    brightnesses = [np.mean(cv2.cvtColor(i, cv2.COLOR_BGR2GRAY)) for i in imgs]
    bright_var   = np.std(brightnesses)

    # Check 2: Face position variation
    pos_var = np.std([p[0] for p in face_positions]) if len(face_positions) >= 2 else 0

    # Check 3: Eye region variation (blink proxy)
    eye_vars = []
    for img in imgs:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        eye_region = gray[int(h*0.2):int(h*0.5), int(w*0.2):int(w*0.8)]
        eye_vars.append(np.std(eye_region))
    eye_variation = np.std(eye_vars)

    score = 0
    if bright_var > 1.0:    score += 30
    if pos_var > 1.0:       score += 40
    if eye_variation > 2.0: score += 30

    is_live = score >= 40

    return {
        "live":           is_live,
        "liveness_score": score,
        "bright_var":     round(bright_var, 2),
        "pos_var":        round(pos_var, 2),
        "eye_variation":  round(eye_variation, 2),
        "reason":         "Live person detected" if is_live else "Possible spoof attempt — photo or screen detected"
    }

# ── Face registered check ─────────────────────────────────────────────────
def is_face_registered(user_id: int) -> bool:
    con = get_db()
    cur = con.cursor()
    cur.execute("SELECT 1 FROM face_embeddings WHERE user_id=%s", (user_id,))
    row = cur.fetchone()
    cur.close()
    con.close()
    return row is not None

# ── Delete face ───────────────────────────────────────────────────────────
def delete_face(user_id: int) -> bool:
    con = get_db()
    cur = con.cursor()
    cur.execute("DELETE FROM face_embeddings WHERE user_id=%s", (user_id,))
    con.commit()
    deleted = cur.rowcount > 0
    cur.close()
    con.close()
    return deleted