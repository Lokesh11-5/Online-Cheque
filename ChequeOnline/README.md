# ChequeMates – Digital Cheque Processing System

ChequeMates is a complete, enterprise-grade **Digital Cheque Processing System** that modernizes traditional cheque clearance through automated cheque verification, computer vision-based signature matching, live webcam biometric facial authentication, and secure OTP verification.

---

## 🏛️ Architecture & Highlights

- **Frontend**: Modern banking UI using **React 18**, CSS3 Custom Properties, FontAwesome 6, and Google Fonts (Plus Jakarta Sans).
  - Show/hide password toggling with eye icons.
  - Interactive stage progress stepper.
  - Live webcam preview with face positioning guide oval.
  - Instant cheque transaction history tracking.
- **Backend**: **FastAPI** with async high-performance endpoints and SQLAlchemy ORM.
- **Database**:
  - Out of the box: **SQLite** (`chequemates.db`) for immediate zero-config testing.
  - Enterprise Mode: **PostgreSQL** support via `DATABASE_URL` environment variable (e.g. `postgresql://user:password@localhost:5432/chequemates`).
- **Computer Vision & Biometrics**:
  - **OpenCV** (ORB feature detector + morphological contour matching) for cheque signature verification.
  - **OpenCV + DeepFace** for webcam face detection, liveness verification, and biometric matching.
  - **OTP Authentication**: 6-digit dynamic token clearance stage.

---

## 📁 Project Structure

```
ChequeOnline/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py       # SQLAlchemy engine (PostgreSQL / SQLite switch)
│   │   ├── models.py         # User and Transaction DB models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── verification.py   # OpenCV signature matcher & DeepFace biometric module
│   │   └── main.py           # FastAPI routes and verification workflows
│   ├── uploads/              # Storage for cheque & signature uploads
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── index.html            # Main HTML document
│   ├── styles.css            # Professional banking styling with clear borders
│   └── app.js                # Full React application logic
├── sample_cheque.jpg         # Sample bank cheque leaf for testing
├── sample_signature.png      # Sample signature specimen for testing
├── generate_samples.py       # Utility to generate test cheques
├── run_backend.bat           # One-click script to start FastAPI backend
├── run_frontend.bat          # One-click script to start frontend server
└── README.md                 # Complete documentation & VS Code instructions
```

---

## 🚀 Step-by-Step VS Code Setup Instructions

### Step 1: Open Project in VS Code
1. Open **Visual Studio Code**.
2. Click **File -> Open Folder...** and select the folder:
   `c:\Users\Lokesh Jakkula\OneDrive\Desktop\loki\ChequeOnline`

### Step 2: Open Integrated Terminal in VS Code
Press `Ctrl + ~` (or `Terminal -> New Terminal`) to open PowerShell / Command Prompt.

### Step 3: Install Backend Dependencies
Ensure Python 3.10+ is installed:
```bash
cd backend
pip install -r requirements.txt
```

### Step 4: Run the FastAPI Backend Server
Run the following command:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Docs (Swagger UI): **http://127.0.0.1:8000/docs**
- Backend Health Check: **http://127.0.0.1:8000/**

*(Alternatively, you can just double-click `run_backend.bat` in the ChequeOnline folder).*

### Step 5: Run the Frontend Application
Open a second terminal tab in VS Code (`Terminal -> Split Terminal` or `+`):
```bash
cd frontend
python -m http.server 3000
```
*(Alternatively, you can double-click `run_frontend.bat` in the ChequeOnline folder).*

Now open your web browser (Chrome, Edge, or Firefox) and navigate to:
👉 **http://127.0.0.1:3000**

---

## 🧪 Testing the 5-Stage Verification Flow

1. **User Sign Up & Login**:
   - Click **Sign Up**, fill in Name, Email, and Password (use the eye icon to verify show/hide password).
   - Log in with your registered credentials.
2. **Bank Transaction Form**:
   - Enter Depositor Account (e.g. `50100438921890`).
   - Enter Amount (e.g. `25000`).
   - Enter Receiver Account (e.g. `30200892716382`) and re-enter in confirmation field.
   - Enter IFSC Code (e.g. `SBIN0001234`).
   - Click **Start Transaction**.
3. **Cheque & Signature Upload**:
   - For **Cheque Image**: Choose `sample_cheque.jpg` (found in `ChequeOnline/`).
   - For **Signature Specimen**: Choose `sample_signature.png` (found in `ChequeOnline/`).
   - Click **Verify Signature**. The OpenCV feature-matching pipeline will verify the signature on the cheque.
4. **Live Face Verification**:
   - Click **Start Webcam**. Your browser will ask for webcam permission.
   - Center your face in the oval frame and click **Capture & Verify Face**.
   - OpenCV and DeepFace verify biometric facial presence and liveness.
5. **OTP Authentication**:
   - The system generates a secure 6-digit OTP (displayed in the demo notification badge).
   - Enter the 6-digit OTP code and click **Authorize & Clear Cheque**.
6. **Transaction Clearance**:
   - Displays the **Transaction Successful** screen with unique Reference ID, amount, and timestamp.
   - Transaction History table updates automatically.

---

## 🔒 Switching to PostgreSQL (Optional Production Setup)
By default, the backend connects via SQLite so you can test instantly without setting up databases.
To switch to PostgreSQL:
1. Ensure your PostgreSQL server is active.
2. Create database: `CREATE DATABASE chequemates;`
3. Set the environment variable in your terminal before running uvicorn:
   - On Windows PowerShell:
     `$env:DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/chequemates"`
   - On Linux/macOS:
     `export DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/chequemates"`
4. Start `uvicorn app.main:app --reload`. Tables are created automatically on launch.
