import os
import uuid
import random
import re
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import User, Transaction
from .schemas import (
    UserSignupRequest,
    UserLoginRequest,
    UserResponse,
    TransactionInitRequest,
    VerifyOTPRequest,
    TransactionResponse
)
from .verification import verify_signatures, verify_face_with_deepface_or_cv

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ChequeMates - Digital Cheque Processing System API",
    description="Secure Digital Cheque Deposit, Signature Matching, Live Biometric Face & OTP Clearing Platform",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static files to serve uploaded images if needed
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# -------------------------------------------------------------
# 1. USER AUTHENTICATION & REGISTRATION
# -------------------------------------------------------------
@app.post("/api/auth/signup", status_code=status.HTTP_201_CREATED)
def signup(data: UserSignupRequest, db: Session = Depends(get_db)):
    # Validate inputs
    if not data.name or len(data.name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Please enter a valid full name.")
    
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing_user = db.query(User).filter(User.email == data.email.lower()).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    new_user = User(
        name=data.name.strip(),
        email=data.email.lower().strip(),
        password=data.password  # In production, use bcrypt hash
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "success": True,
        "message": "Registration successful. You can now log in.",
        "user": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email
        }
    }


@app.post("/api/auth/login")
def login(data: UserLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user or user.password != data.password:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {
        "success": True,
        "message": "Login successful.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "has_registered_face": bool(user.face_image_path)
        }
    }


# Optional: Register User Profile Face for reference
@app.post("/api/auth/register-face")
async def register_face(
    user_id: int = Form(...),
    face_image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    ext = face_image.filename.split(".")[-1] if "." in face_image.filename else "jpg"
    filename = f"user_{user_id}_face_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await face_image.read()
    with open(filepath, "wb") as f:
        f.write(content)

    user.face_image_path = filepath
    db.commit()

    return {"success": True, "message": "Reference face registered successfully."}


# -------------------------------------------------------------
# 2. BANK TRANSACTION DETAILS
# -------------------------------------------------------------
@app.post("/api/transactions/init")
def init_transaction(
    data: TransactionInitRequest,
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Validation
    if not re.match(r"^\d{9,18}$", data.depositor_account):
        raise HTTPException(status_code=400, detail="Depositor account must be 9-18 digits.")

    if not re.match(r"^\d{9,18}$", data.receiver_account):
        raise HTTPException(status_code=400, detail="Receiver account must be 9-18 digits.")

    if data.receiver_account != data.confirm_receiver_account:
        raise HTTPException(status_code=400, detail="Receiver account numbers do not match.")

    if data.depositor_account == data.receiver_account:
        raise HTTPException(status_code=400, detail="Depositor and receiver account numbers cannot be identical.")

    ifsc_cleaned = data.ifsc_code.strip().upper()
    if not re.match(r"^[A-Z]{4}0[A-Z0-9]{6}$", ifsc_cleaned):
        raise HTTPException(status_code=400, detail="Invalid IFSC code format (e.g., SBIN0001234, HDFC0000456).")

    # Generate unique transaction reference ID (e.g. CM-20261122-8392)
    ref_id = f"CM-{datetime.now().strftime('%Y%m%d')}-{random.randint(10000, 99999)}"

    new_tx = Transaction(
        reference_id=ref_id,
        user_id=user.id,
        depositor_account=data.depositor_account,
        receiver_account=data.receiver_account,
        ifsc_code=ifsc_cleaned,
        amount=float(data.amount) if data.amount else 10000.0,
        transaction_date=data.transaction_date,
        status="PENDING_SIGNATURE"
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)

    return {
        "success": True,
        "message": "Transaction initiated. Proceed to Cheque and Signature upload.",
        "transaction": {
            "id": new_tx.id,
            "reference_id": new_tx.reference_id,
            "depositor_account": new_tx.depositor_account,
            "receiver_account": new_tx.receiver_account,
            "ifsc_code": new_tx.ifsc_code,
            "amount": new_tx.amount,
            "transaction_date": new_tx.transaction_date,
            "status": new_tx.status
        }
    }


# -------------------------------------------------------------
# 3. CHEQUE UPLOAD AND SIGNATURE VERIFICATION
# -------------------------------------------------------------
@app.post("/api/transactions/verify-signature")
async def verify_signature_endpoint(
    reference_id: str = Form(...),
    cheque_file: UploadFile = File(...),
    signature_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.reference_id == reference_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    cheque_ext = cheque_file.filename.split(".")[-1] if "." in cheque_file.filename else "jpg"
    sig_ext = signature_file.filename.split(".")[-1] if "." in signature_file.filename else "jpg"

    cheque_path = os.path.join(UPLOAD_DIR, f"{reference_id}_cheque.{cheque_ext}")
    sig_path = os.path.join(UPLOAD_DIR, f"{reference_id}_signature.{sig_ext}")

    cheque_bytes = await cheque_file.read()
    with open(cheque_path, "wb") as f:
        f.write(cheque_bytes)

    sig_bytes = await signature_file.read()
    with open(sig_path, "wb") as f:
        f.write(sig_bytes)

    # Perform CV signature verification
    result = verify_signatures(cheque_path, sig_path)

    tx.cheque_image_path = cheque_path
    tx.signature_image_path = sig_path
    tx.signature_verified = result["verified"]
    tx.signature_score = result["score"]

    if result["verified"]:
        tx.status = "SIGNATURE_VERIFIED"
        db.commit()
        return {
            "success": True,
            "verified": True,
            "score": result["score"],
            "message": result["message"]
        }
    else:
        tx.status = "SIGNATURE_FAILED"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=result["message"] or "Signature verification failed. The signature does not match the cheque."
        )


# -------------------------------------------------------------
# 4. LIVE FACE VERIFICATION
# -------------------------------------------------------------
@app.post("/api/transactions/verify-face")
async def verify_face_endpoint(
    reference_id: str = Form(...),
    face_frame: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.reference_id == reference_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    # Must have completed signature verification first
    if not tx.signature_verified:
        raise HTTPException(status_code=400, detail="Cannot proceed to face verification: Signature is not verified.")

    frame_bytes = await face_frame.read()
    user = tx.user

    result = verify_face_with_deepface_or_cv(frame_bytes, user.face_image_path if user else None)

    tx.face_verified = result["verified"]
    tx.face_score = result["score"]

    if result["verified"]:
        tx.status = "FACE_VERIFIED"
        # Auto-generate OTP upon face verification success
        otp_code = str(random.randint(100000, 999999))
        tx.otp_code = otp_code
        db.commit()

        # In production, send via Email/SMS. For immediate testing, we also return the OTP in the API response.
        return {
            "success": True,
            "verified": True,
            "score": result["score"],
            "message": result["message"],
            "otp_sent_to": user.email if user else "registered email",
            "otp_preview": otp_code  # For easy live testing & demonstration
        }
    else:
        tx.status = "FACE_FAILED"
        db.commit()
        raise HTTPException(
            status_code=400,
            detail=result["message"] or "Face verification failed. Please try again."
        )


# -------------------------------------------------------------
# 5. OTP VERIFICATION
# -------------------------------------------------------------
@app.post("/api/transactions/send-otp")
def resend_otp(reference_id: str, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.reference_id == reference_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if not tx.face_verified:
        raise HTTPException(status_code=400, detail="Face verification must be passed before requesting OTP.")

    otp_code = str(random.randint(100000, 999999))
    tx.otp_code = otp_code
    db.commit()

    return {
        "success": True,
        "message": f"A 6-digit OTP has been sent to {tx.user.email if tx.user else 'your email'}.",
        "otp_preview": otp_code
    }


@app.post("/api/transactions/verify-otp")
def verify_otp_endpoint(data: VerifyOTPRequest, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.reference_id == data.reference_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if not tx.face_verified:
        raise HTTPException(status_code=400, detail="Cannot verify OTP: Face verification has not been completed.")

    if not tx.otp_code or tx.otp_code != data.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please re-check the entered number.")

    tx.otp_verified = True
    tx.status = "SUCCESSFUL"
    db.commit()
    db.refresh(tx)

    return {
        "success": True,
        "message": "OTP verification successful. Transaction completed!",
        "transaction": {
            "reference_id": tx.reference_id,
            "depositor_account": tx.depositor_account,
            "receiver_account": tx.receiver_account,
            "ifsc_code": tx.ifsc_code,
            "amount": tx.amount,
            "transaction_date": tx.transaction_date,
            "status": tx.status,
            "completed_at": tx.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
    }


# -------------------------------------------------------------
# 6. TRANSACTION HISTORY & DETAILS
# -------------------------------------------------------------
@app.get("/api/transactions/history")
def get_user_transactions(user_id: int, db: Session = Depends(get_db)):
    transactions = (
        db.query(Transaction)
        .filter(Transaction.user_id == user_id)
        .order_by(Transaction.id.desc())
        .all()
    )

    return [
        {
            "id": t.id,
            "reference_id": t.reference_id,
            "depositor_account": t.depositor_account,
            "receiver_account": t.receiver_account,
            "ifsc_code": t.ifsc_code,
            "amount": t.amount,
            "transaction_date": t.transaction_date,
            "status": t.status,
            "signature_verified": t.signature_verified,
            "face_verified": t.face_verified,
            "otp_verified": t.otp_verified,
            "created_at": t.created_at.strftime("%Y-%m-%d %H:%M")
        }
        for t in transactions
    ]


@app.get("/api/transactions/{reference_id}")
def get_transaction_by_ref(reference_id: str, db: Session = Depends(get_db)):
    t = db.query(Transaction).filter(Transaction.reference_id == reference_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    return {
        "id": t.id,
        "reference_id": t.reference_id,
        "depositor_account": t.depositor_account,
        "receiver_account": t.receiver_account,
        "ifsc_code": t.ifsc_code,
        "amount": t.amount,
        "transaction_date": t.transaction_date,
        "status": t.status,
        "signature_verified": t.signature_verified,
        "signature_score": t.signature_score,
        "face_verified": t.face_verified,
        "face_score": t.face_score,
        "otp_verified": t.otp_verified,
        "created_at": t.created_at.strftime("%Y-%m-%d %H:%M:%S")
    }


@app.get("/")
def root():
    return {
        "system": "ChequeMates Digital Cheque Processing System API",
        "status": "Online",
        "docs_url": "/docs"
    }
