from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    face_image_path = Column(String(255), nullable=True)  # Registered face reference
    created_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="user")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    reference_id = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    depositor_account = Column(String(50), nullable=False)
    receiver_account = Column(String(50), nullable=False)
    ifsc_code = Column(String(20), nullable=False)
    amount = Column(Float, nullable=False, default=0.0)
    transaction_date = Column(String(30), nullable=False)
    cheque_image_path = Column(String(255), nullable=True)
    signature_image_path = Column(String(255), nullable=True)
    signature_verified = Column(Boolean, default=False)
    signature_score = Column(Float, default=0.0)
    face_verified = Column(Boolean, default=False)
    face_score = Column(Float, default=0.0)
    otp_code = Column(String(10), nullable=True)
    otp_verified = Column(Boolean, default=False)
    status = Column(String(30), default="PENDING")  # PENDING, SIGNATURE_VERIFIED, FACE_VERIFIED, COMPLETED, FAILED
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")
