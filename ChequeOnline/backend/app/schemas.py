from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserSignupRequest(BaseModel):
    name: str
    email: str
    password: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    has_registered_face: bool

class TransactionInitRequest(BaseModel):
    depositor_account: str
    receiver_account: str
    confirm_receiver_account: str
    ifsc_code: str
    transaction_date: str
    amount: Optional[float] = 10000.0

class VerifyOTPRequest(BaseModel):
    reference_id: str
    otp: str

class TransactionResponse(BaseModel):
    id: int
    reference_id: str
    depositor_account: str
    receiver_account: str
    ifsc_code: str
    amount: float
    transaction_date: str
    status: str
    signature_verified: bool
    face_verified: bool
    otp_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True
