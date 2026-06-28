import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.face_service import register_face, verify_face, check_liveness, is_face_registered
from routes.auth import get_user_by_token, get_db
from routes.alerts import create_alert
from datetime import datetime

router = APIRouter(prefix="/api/face", tags=["face"])

class FaceRegisterIn(BaseModel):
    token:   str
    image:   str  # base64

class FaceVerifyIn(BaseModel):
    token:   str
    image:   str  # base64

class LivenessIn(BaseModel):
    token:  str
    frames: list  # list of base64 images

class FaceDeleteIn(BaseModel):
    token: str

# ── Register ───────────────────────────────────────────────────────────────
@router.post("/register")
def register(body: FaceRegisterIn):
    user = get_user_by_token(body.token)
    result = register_face(user["id"], user["email"], body.image)

    if "error" in result:
        raise HTTPException(400, result["error"])

    create_alert(user["id"], user["email"], "info", "security",
        f"Face ID registered successfully — confidence {result['confidence']:.2f}",
        {"confidence": result["confidence"]})

    return result

# ── Verify ─────────────────────────────────────────────────────────────────
@router.post("/verify")
def verify(body: FaceVerifyIn):
    user = get_user_by_token(body.token)

    if not is_face_registered(user["id"]):
        return {"registered": False, "verified": False, "message": "Face not registered yet"}

    result = verify_face(user["id"], body.image)

    if not result.get("verified"):
        create_alert(user["id"], user["email"], "high", "security",
            f"Face verification failed — similarity {result.get('similarity', 0):.2f}",
            {"similarity": result.get("similarity"), "risk_score": result.get("risk_score")})

    return result

# ── Liveness ───────────────────────────────────────────────────────────────
@router.post("/liveness")
def liveness(body: LivenessIn):
    user = get_user_by_token(body.token)

    if len(body.frames) < 3:
        raise HTTPException(400, "At least 3 frames required")

    result = check_liveness(body.frames)

    if not result.get("live"):
        create_alert(user["id"], user["email"], "high", "security",
            "Liveness check failed — possible spoof attempt",
            {"liveness_score": result.get("liveness_score")})

    return result

# ── Status ─────────────────────────────────────────────────────────────────
@router.get("/status")
def status(token: str):
    user = get_user_by_token(token)
    return {
        "registered": is_face_registered(user["id"]),
        "user_id":    user["id"],
        "email":      user["email"]
    }

# ── Delete ─────────────────────────────────────────────────────────────────
@router.delete("/delete")
def delete_face(body: FaceDeleteIn):
    user = get_user_by_token(body.token)
    face_file = os.path.join(
        os.path.dirname(__file__), '..', 'face_data', f"user_{user['id']}.json"
    )
    if os.path.exists(face_file):
        os.remove(face_file)
        return {"success": True, "message": "Face ID removed"}
    return {"success": False, "message": "Face not registered"}