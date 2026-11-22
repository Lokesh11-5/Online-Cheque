const { useState, useEffect, useRef } = React;

const API_BASE = "http://127.0.0.1:8000";

function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("chequemates_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Active Stage in Process:
  // 1: Bank Transaction Details Form
  // 2: Cheque Upload & Signature Verification
  // 3: Live Face Verification
  // 4: OTP Verification
  // 5: Transaction Success / Receipt
  const [currentStep, setCurrentStep] = useState(1);

  // Bank Transaction Form State
  const [txForm, setTxForm] = useState({
    depositor_account: "",
    receiver_account: "",
    confirm_receiver_account: "",
    ifsc_code: "",
    transaction_date: new Date().toISOString().split("T")[0],
    amount: "25000"
  });
  const [txError, setTxError] = useState("");
  const [activeTx, setActiveTx] = useState(null);

  // Transaction History State
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Cheque & Signature Verification State
  const [chequeFile, setChequeFile] = useState(null);
  const [signatureFile, setSignatureFile] = useState(null);
  const [chequePreview, setChequePreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [sigVerifying, setSigVerifying] = useState(false);
  const [sigResult, setSigResult] = useState(null);
  const [sigError, setSigError] = useState("");

  // Live Face Verification State
  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceVerifying, setFaceVerifying] = useState(false);
  const [faceResult, setFaceResult] = useState(null);
  const [faceError, setFaceError] = useState("");
  const [cameraStream, setCameraStream] = useState(null);

  // OTP Verification State
  const [otpCode, setOtpCode] = useState("");
  const [otpSentNotice, setOtpSentNotice] = useState("");
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpError, setOtpError] = useState("");

  // Final Success State
  const [successDetails, setSuccessDetails] = useState(null);

  // Fetch Transaction History
  const fetchHistory = async (userId) => {
    if (!userId) return;
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/api/transactions/history?user_id=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchHistory(currentUser.id);
    }
  }, [currentUser]);

  // Handle Authentication
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");
    setAuthLoading(true);

    try {
      if (authMode === "signup") {
        if (!authForm.name.trim() || !authForm.email.trim() || !authForm.password) {
          throw new Error("Please fill in all required fields.");
        }
        if (authForm.password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }

        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authForm)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Registration failed.");

        setAuthSuccess("Account created successfully! Please sign in.");
        setAuthMode("login");
        setAuthForm({ name: "", email: authForm.email, password: "" });
      } else {
        if (!authForm.email.trim() || !authForm.password) {
          throw new Error("Please enter your email and password.");
        }

        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: authForm.email, password: authForm.password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Invalid credentials.");

        localStorage.setItem("chequemates_user", JSON.stringify(data.user));
        setCurrentUser(data.user);
        setCurrentStep(1);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("chequemates_user");
    setCurrentUser(null);
    setCurrentStep(1);
    stopCamera();
  };

  // -------------------------------------------------------------
  // STEP 1: Bank Transaction Details Validation & Submission
  // -------------------------------------------------------------
  const handleStartTransaction = async (e) => {
    e.preventDefault();
    setTxError("");

    const { depositor_account, receiver_account, confirm_receiver_account, ifsc_code, transaction_date } = txForm;

    if (!/^\d{9,18}$/.test(depositor_account)) {
      setTxError("Depositor account number must be between 9 and 18 digits.");
      return;
    }
    if (!/^\d{9,18}$/.test(receiver_account)) {
      setTxError("Receiver account number must be between 9 and 18 digits.");
      return;
    }
    if (receiver_account !== confirm_receiver_account) {
      setTxError("Receiver account number confirmation does not match.");
      return;
    }
    if (depositor_account === receiver_account) {
      setTxError("Depositor and receiver account numbers cannot be identical.");
      return;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.trim().toUpperCase())) {
      setTxError("Invalid IFSC code format (e.g. SBIN0001234, HDFC0000456).");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/transactions/init?user_id=${currentUser.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...txForm,
          ifsc_code: ifsc_code.trim().toUpperCase(),
          amount: parseFloat(txForm.amount) || 10000.0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to initialize transaction.");

      setActiveTx(data.transaction);
      // Move to Step 2
      setCurrentStep(2);
    } catch (err) {
      setTxError(err.message);
    }
  };

  // -------------------------------------------------------------
  // STEP 2: Cheque & Signature Verification
  // -------------------------------------------------------------
  const handleChequeUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setChequeFile(file);
      setChequePreview(URL.createObjectURL(file));
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  const handleVerifySignature = async () => {
    if (!chequeFile || !signatureFile) {
      setSigError("Please upload both the Cheque image and your Signature specimen.");
      return;
    }
    setSigError("");
    setSigVerifying(true);

    const formData = new FormData();
    formData.append("reference_id", activeTx.reference_id);
    formData.append("cheque_file", chequeFile);
    formData.append("signature_file", signatureFile);

    try {
      const res = await fetch(`${API_BASE}/api/transactions/verify-signature`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Signature verification failed.");

      setSigResult(data);
      // Proceed to Step 3 (Live Face Verification) strictly after signature verified
      setTimeout(() => {
        setCurrentStep(3);
        startCamera();
      }, 1200);
    } catch (err) {
      setSigError(err.message);
    } finally {
      setSigVerifying(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 3: Live Face Verification with Webcam
  // -------------------------------------------------------------
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn("Camera access failed or unavailable:", err);
      setFaceError("Unable to access webcam. Please allow camera permissions in your browser.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (currentStep === 3 && videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [currentStep, cameraStream]);

  const captureAndVerifyFace = async () => {
    if (!videoRef.current) return;
    setFaceError("");
    setFaceVerifying(true);

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setFaceError("Failed to capture image frame.");
          setFaceVerifying(false);
          return;
        }

        const formData = new FormData();
        formData.append("reference_id", activeTx.reference_id);
        formData.append("face_frame", blob, "face_capture.jpg");

        try {
          const res = await fetch(`${API_BASE}/api/transactions/verify-face`, {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || "Face verification failed.");

          setFaceResult(data);
          setOtpSentNotice(`OTP generated and sent to ${data.otp_sent_to}. (For instant demo testing, your code is: ${data.otp_preview})`);
          stopCamera();

          // Proceed strictly to OTP step after face verified
          setTimeout(() => {
            setCurrentStep(4);
          }, 1400);
        } catch (err) {
          setFaceError(err.message);
        } finally {
          setFaceVerifying(false);
        }
      }, "image/jpeg", 0.92);
    } catch (err) {
      setFaceError(err.message);
      setFaceVerifying(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 4: OTP Verification
  // -------------------------------------------------------------
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError("Please enter a valid 6-digit OTP code.");
      return;
    }
    setOtpError("");
    setOtpVerifying(true);

    try {
      const res = await fetch(`${API_BASE}/api/transactions/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_id: activeTx.reference_id,
          otp: otpCode.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid or expired OTP.");

      // Success!
      setSuccessDetails(data.transaction);
      setCurrentStep(5);
      fetchHistory(currentUser.id);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleResetForNew = () => {
    setActiveTx(null);
    setChequeFile(null);
    setSignatureFile(null);
    setChequePreview(null);
    setSignaturePreview(null);
    setSigResult(null);
    setFaceResult(null);
    setOtpCode("");
    setSuccessDetails(null);
    setCurrentStep(1);
    stopCamera();
    fetchHistory(currentUser.id);
  };

  // -------------------------------------------------------------
  // RENDER: Unauthenticated (Login / Registration)
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div>
        <header className="navbar">
          <div className="brand-container">
            <div className="brand-logo"><i className="fa-solid fa-money-check-dollar"></i></div>
            <div className="brand-text">
              <h1>Cheque<span>Mates</span></h1>
            </div>
            <span className="brand-badge">Enterprise Core Banking</span>
          </div>
        </header>

        <div className="app-container" style={{ maxWidth: "480px", marginTop: "3.5rem" }}>
          <div className="bank-card" style={{ border: "2px solid #E2E8F0", padding: "2.5rem" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#EBF3FC",
                color: "#0056B3",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                marginBottom: "0.75rem"
              }}>
                <i className={authMode === "login" ? "fa-solid fa-shield-halved" : "fa-solid fa-user-plus"}></i>
              </div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "800", color: "#0A192F" }}>
                {authMode === "login" ? "Secure Portal Login" : "Create Bank Account"}
              </h2>
              <p style={{ color: "#64748B", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                Digital Cheque Deposit & Biometric Clearance System
              </p>
            </div>

            {authError && (
              <div className="bank-alert bank-alert-danger">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="bank-alert bank-alert-success">
                <i className="fa-solid fa-circle-check"></i>
                <span>{authSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit}>
              {authMode === "signup" && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-user lead-icon"></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Rahul Sharma"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-icon-wrapper">
                  <i className="fa-solid fa-envelope lead-icon"></i>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="name@example.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-icon-wrapper">
                  <i className="fa-solid fa-lock lead-icon"></i>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="form-control"
                    placeholder="Enter confidential password"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  />
                  <button
                    type="button"
                    className="eye-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    <i className={showPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn-bank-primary"
                style={{ width: "100%", marginTop: "1rem" }}
                disabled={authLoading}
              >
                {authLoading ? (
                  <span><i className="fa-solid fa-circle-notch fa-spin"></i> Authenticating...</span>
                ) : authMode === "login" ? (
                  <span><i className="fa-solid fa-arrow-right-to-bracket"></i> Sign In to Banking</span>
                ) : (
                  <span><i className="fa-solid fa-user-check"></i> Register Account</span>
                )}
              </button>
            </form>

            <div style={{ marginTop: "1.75rem", textAlign: "center", borderTop: "1px solid #E2E8F0", paddingTop: "1.25rem" }}>
              {authMode === "login" ? (
                <p style={{ fontSize: "0.88rem", color: "#64748B" }}>
                  Don't have an online banking ID?{" "}
                  <button
                    onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthSuccess(""); }}
                    style={{ background: "none", border: "none", color: "#2563EB", fontWeight: "700", cursor: "pointer" }}
                  >
                    Sign Up
                  </button>
                </p>
              ) : (
                <p style={{ fontSize: "0.88rem", color: "#64748B" }}>
                  Already registered?{" "}
                  <button
                    onClick={() => { setAuthMode("login"); setAuthError(""); setAuthSuccess(""); }}
                    style={{ background: "none", border: "none", color: "#2563EB", fontWeight: "700", cursor: "pointer" }}
                  >
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Authenticated Banking Workspace
  // -------------------------------------------------------------
  return (
    <div>
      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand-container">
          <div className="brand-logo"><i className="fa-solid fa-money-check-dollar"></i></div>
          <div className="brand-text">
            <h1>Cheque<span>Mates</span></h1>
          </div>
          <span className="brand-badge">Secured CTS Clearance</span>
        </div>

        <div className="user-nav-actions">
          <div className="user-info-chip">
            <i className="fa-solid fa-circle-user" style={{ color: "#00D2B4", fontSize: "1.1rem" }}></i>
            <div>
              <div style={{ fontWeight: "700", lineHeight: 1.2 }}>{currentUser.name}</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.7)" }}>{currentUser.email}</div>
            </div>
          </div>
          <button className="btn-nav-logout" onClick={handleLogout}>
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="app-container">
        {/* Verification Stepper */}
        <div className="stepper-container">
          <div className="stepper-progress-bar">
            <div
              className="stepper-progress-fill"
              style={{
                width: currentStep === 1 ? "0%" :
                       currentStep === 2 ? "25%" :
                       currentStep === 3 ? "50%" :
                       currentStep === 4 ? "75%" : "100%"
              }}
            ></div>
          </div>

          <div className={`step-node ${currentStep === 1 ? "active" : currentStep > 1 ? "completed" : ""}`}>
            <div className="step-circle">{currentStep > 1 ? <i className="fa-solid fa-check"></i> : "1"}</div>
            <div className="step-label">Bank Details</div>
          </div>

          <div className={`step-node ${currentStep === 2 ? "active" : currentStep > 2 ? "completed" : ""}`}>
            <div className="step-circle">{currentStep > 2 ? <i className="fa-solid fa-check"></i> : "2"}</div>
            <div className="step-label">Signature Match</div>
          </div>

          <div className={`step-node ${currentStep === 3 ? "active" : currentStep > 3 ? "completed" : ""}`}>
            <div className="step-circle">{currentStep > 3 ? <i className="fa-solid fa-check"></i> : "3"}</div>
            <div className="step-label">Live Face Check</div>
          </div>

          <div className={`step-node ${currentStep === 4 ? "active" : currentStep > 4 ? "completed" : ""}`}>
            <div className="step-circle">{currentStep > 4 ? <i className="fa-solid fa-check"></i> : "4"}</div>
            <div className="step-label">OTP Verification</div>
          </div>

          <div className={`step-node ${currentStep === 5 ? "completed" : ""}`}>
            <div className="step-circle">{currentStep === 5 ? <i className="fa-solid fa-check"></i> : "5"}</div>
            <div className="step-label">Clearance Done</div>
          </div>
        </div>

        {/* =========================================================================
            STAGE 1: Bank Transaction Details Form
        ========================================================================= */}
        {currentStep === 1 && (
          <div className="bank-card">
            <div className="card-header-styled">
              <div className="card-title-group">
                <h2><i className="fa-solid fa-building-columns" style={{ color: "#2563EB" }}></i> Initiate Cheque Clearance Transaction</h2>
                <p>Fill in authentic bank account details to start the digital cheque deposit process.</p>
              </div>
            </div>

            {txError && (
              <div className="bank-alert bank-alert-danger">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{txError}</span>
              </div>
            )}

            <form onSubmit={handleStartTransaction}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label"><i className="fa-solid fa-id-card"></i> Depositor Bank Account Number</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-hashtag lead-icon"></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 50100438921890"
                      value={txForm.depositor_account}
                      onChange={(e) => setTxForm({ ...txForm, depositor_account: e.target.value.replace(/\D/g, '') })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><i className="fa-solid fa-indian-rupee-sign"></i> Cheque Amount (₹)</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-coins lead-icon"></i>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Amount in Rupees"
                      value={txForm.amount}
                      onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><i className="fa-solid fa-wallet"></i> Receiver Bank Account Number</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-hashtag lead-icon"></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 30200892716382"
                      value={txForm.receiver_account}
                      onChange={(e) => setTxForm({ ...txForm, receiver_account: e.target.value.replace(/\D/g, '') })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><i className="fa-solid fa-circle-check"></i> Re-enter Receiver Account Number</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-hashtag lead-icon"></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Confirm Receiver Account"
                      value={txForm.confirm_receiver_account}
                      onChange={(e) => setTxForm({ ...txForm, confirm_receiver_account: e.target.value.replace(/\D/g, '') })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><i className="fa-solid fa-landmark"></i> Bank IFSC Code</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-code-branch lead-icon"></i>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. HDFC0000123 / SBIN0001092"
                      value={txForm.ifsc_code}
                      onChange={(e) => setTxForm({ ...txForm, ifsc_code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label"><i className="fa-solid fa-calendar-days"></i> Transaction Date</label>
                  <div className="input-icon-wrapper">
                    <i className="fa-solid fa-calendar lead-icon"></i>
                    <input
                      type="date"
                      className="form-control"
                      value={txForm.transaction_date}
                      onChange={(e) => setTxForm({ ...txForm, transaction_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn-bank-primary">
                  <i className="fa-solid fa-play"></i> Start Transaction
                </button>
              </div>
            </form>
          </div>
        )}

        {/* =========================================================================
            STAGE 2: Cheque Upload and Signature Verification
        ========================================================================= */}
        {currentStep === 2 && (
          <div className="bank-card">
            <div className="card-header-styled">
              <div className="card-title-group">
                <h2><i className="fa-solid fa-signature" style={{ color: "#2563EB" }}></i> Cheque & Signature Verification</h2>
                <p>Upload the physical cheque image and your authorized signature specimen to execute algorithmic verification.</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="brand-badge" style={{ background: "#E2E8F0", color: "#334155" }}>
                  Ref: {activeTx?.reference_id}
                </span>
              </div>
            </div>

            {sigError && (
              <div className="bank-alert bank-alert-danger">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{sigError}</span>
              </div>
            )}
            {sigResult && (
              <div className="bank-alert bank-alert-success">
                <i className="fa-solid fa-circle-check"></i>
                <span>{sigResult.message} (Match Confidence: {sigResult.score}%)</span>
              </div>
            )}

            <div className="form-grid-2">
              <div>
                <label className="form-label"><i className="fa-solid fa-file-invoice-dollar"></i> Upload Cheque Leaf Image</label>
                <label className="upload-dropzone">
                  <input type="file" accept="image/*" onChange={handleChequeUpload} style={{ display: "none" }} />
                  <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: "2rem", color: "#2563EB", marginBottom: "0.5rem" }}></i>
                  <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                    {chequeFile ? chequeFile.name : "Click to select Cheque file"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>PNG, JPG, or JPEG</span>
                  {chequePreview && <img src={chequePreview} alt="Cheque Preview" className="preview-thumb" />}
                </label>
              </div>

              <div>
                <label className="form-label"><i className="fa-solid fa-pen-nib"></i> Upload Specimen Signature</label>
                <label className="upload-dropzone">
                  <input type="file" accept="image/*" onChange={handleSignatureUpload} style={{ display: "none" }} />
                  <i className="fa-solid fa-signature" style={{ fontSize: "2rem", color: "#00D2B4", marginBottom: "0.5rem" }}></i>
                  <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>
                    {signatureFile ? signatureFile.name : "Click to select Signature file"}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#64748B" }}>Authorized specimen signature crop</span>
                  {signaturePreview && <img src={signaturePreview} alt="Signature Preview" className="preview-thumb" />}
                </label>
              </div>
            </div>

            <div style={{ marginTop: "2rem", display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
              <button
                type="button"
                className="btn-bank-primary"
                onClick={handleVerifySignature}
                disabled={sigVerifying || !chequeFile || !signatureFile}
              >
                {sigVerifying ? (
                  <span><i className="fa-solid fa-spinner fa-spin"></i> Verifying Signature via OpenCV...</span>
                ) : (
                  <span><i className="fa-solid fa-check-double"></i> Verify Signature</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 3: Live Face Verification
        ========================================================================= */}
        {currentStep === 3 && (
          <div className="bank-card">
            <div className="card-header-styled">
              <div className="card-title-group">
                <h2><i className="fa-solid fa-camera" style={{ color: "#2563EB" }}></i> Live Biometric Face Verification</h2>
                <p>Align your face within the frame. Our OpenCV / DeepFace vision pipeline will detect liveness and verify authenticity.</p>
              </div>
              <div>
                <span className="status-badge success">
                  <i className="fa-solid fa-check"></i> Signature Passed
                </span>
              </div>
            </div>

            {faceError && (
              <div className="bank-alert bank-alert-danger">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{faceError}</span>
              </div>
            )}
            {faceResult && (
              <div className="bank-alert bank-alert-success">
                <i className="fa-solid fa-circle-check"></i>
                <span>{faceResult.message} (Score: {faceResult.score}%)</span>
              </div>
            )}

            <div className="webcam-container">
              <div className="video-frame-wrapper">
                <video ref={videoRef} autoPlay playsInline muted className="video-element"></video>
                <div className="face-oval-guide"></div>
              </div>
              <p style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#94A3B8" }}>
                <i className="fa-solid fa-lightbulb" style={{ color: "#FACC15" }}></i> Ensure your environment is well-lit and your full face is visible without obstructions.
              </p>
            </div>

            <div style={{ marginTop: "1.75rem", display: "flex", justifyContent: "center", gap: "1rem" }}>
              {!cameraActive && (
                <button type="button" className="btn-bank-primary" onClick={startCamera}>
                  <i className="fa-solid fa-video"></i> Start Webcam
                </button>
              )}
              <button
                type="button"
                className="btn-bank-primary"
                onClick={captureAndVerifyFace}
                disabled={faceVerifying || !cameraActive}
                style={{ background: "linear-gradient(135deg, #059669 0%, #10B981 100%)" }}
              >
                {faceVerifying ? (
                  <span><i className="fa-solid fa-spinner fa-spin"></i> Running Face Recognition...</span>
                ) : (
                  <span><i className="fa-solid fa-user-shield"></i> Capture & Verify Face</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STAGE 4: OTP Verification
        ========================================================================= */}
        {currentStep === 4 && (
          <div className="bank-card" style={{ maxWidth: "560px", margin: "0 auto 2rem" }}>
            <div className="card-header-styled" style={{ textAlign: "center", display: "block" }}>
              <div style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "#EBF3FC",
                color: "#2563EB",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.6rem",
                marginBottom: "0.75rem"
              }}>
                <i className="fa-solid fa-key"></i>
              </div>
              <h2 style={{ fontSize: "1.4rem", color: "#0A192F" }}>One-Time Password (OTP) Verification</h2>
              <p style={{ color: "#64748B", fontSize: "0.85rem" }}>
                Final security checkpoint to authorize cheque clearance fund transfer.
              </p>
            </div>

            {otpSentNotice && (
              <div className="bank-alert bank-alert-info">
                <i className="fa-solid fa-comment-sms"></i>
                <span style={{ fontSize: "0.85rem" }}>{otpSentNotice}</span>
              </div>
            )}

            {otpError && (
              <div className="bank-alert bank-alert-danger">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOTP}>
              <div className="form-group" style={{ textAlign: "center" }}>
                <label className="form-label" style={{ justifyContent: "center" }}>
                  Enter 6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength="6"
                  className="form-control"
                  style={{
                    textAlign: "center",
                    letterSpacing: "8px",
                    fontSize: "1.6rem",
                    fontWeight: "800",
                    padding: "0.8rem",
                    border: "2px solid #2563EB"
                  }}
                  placeholder="------"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn-bank-primary"
                style={{ width: "100%", marginTop: "1rem" }}
                disabled={otpVerifying || otpCode.length !== 6}
              >
                {otpVerifying ? (
                  <span><i className="fa-solid fa-spinner fa-spin"></i> Validating Token...</span>
                ) : (
                  <span><i className="fa-solid fa-check"></i> Authorize & Clear Cheque</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* =========================================================================
            STAGE 5: Transaction Successful Receipt
        ========================================================================= */}
        {currentStep === 5 && successDetails && (
          <div className="bank-card">
            <div className="receipt-box">
              <div className="receipt-icon-circle">
                <i className="fa-solid fa-check-double"></i>
              </div>
              <h2 style={{ fontSize: "1.75rem", fontWeight: "800", color: "#065F46" }}>
                Transaction Successful!
              </h2>
              <p style={{ color: "#64748B", fontSize: "0.9rem", marginTop: "0.25rem" }}>
                Digital cheque has been authenticated and cleared through automated clearing house.
              </p>

              <div className="receipt-meta-grid">
                <div className="receipt-meta-item">
                  <div className="meta-label">Transaction Reference ID</div>
                  <div className="meta-val" style={{ color: "#2563EB" }}>{successDetails.reference_id}</div>
                </div>
                <div className="receipt-meta-item">
                  <div className="meta-label">Cleared Amount</div>
                  <div className="meta-val" style={{ color: "#059669", fontSize: "1.1rem" }}>
                    ₹ {Number(successDetails.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="receipt-meta-item">
                  <div className="meta-label">Depositor Account</div>
                  <div className="meta-val">{successDetails.depositor_account}</div>
                </div>
                <div className="receipt-meta-item">
                  <div className="meta-label">Receiver Account</div>
                  <div className="meta-val">{successDetails.receiver_account}</div>
                </div>
                <div className="receipt-meta-item">
                  <div className="meta-label">IFSC Code</div>
                  <div className="meta-val">{successDetails.ifsc_code}</div>
                </div>
                <div className="receipt-meta-item">
                  <div className="meta-label">Clearance Date & Time</div>
                  <div className="meta-val">{successDetails.completed_at || successDetails.transaction_date}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
                <button
                  type="button"
                  className="btn-bank-primary"
                  onClick={handleResetForNew}
                >
                  <i className="fa-solid fa-plus"></i> Initiate Another Cheque
                </button>
                <button
                  type="button"
                  className="btn-bank-primary"
                  style={{ background: "#475569" }}
                  onClick={() => window.print()}
                >
                  <i className="fa-solid fa-print"></i> Print Receipt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TRANSACTION HISTORY TABLE
        ========================================================================= */}
        <div className="bank-card">
          <div className="card-header-styled">
            <div className="card-title-group">
              <h2><i className="fa-solid fa-clock-rotate-left" style={{ color: "#2563EB" }}></i> Transaction History</h2>
              <p>Audit trail of all processed, verified, and cleared digital cheques.</p>
            </div>
            <button
              onClick={() => fetchHistory(currentUser.id)}
              style={{
                background: "transparent",
                border: "1px solid #CBD5E1",
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                cursor: "pointer",
                color: "#475569",
                fontWeight: "600",
                fontSize: "0.85rem"
              }}
            >
              <i className="fa-solid fa-rotate-right"></i> Refresh
            </button>
          </div>

          {historyLoading ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748B" }}>
              <i className="fa-solid fa-circle-notch fa-spin"></i> Loading transaction logs...
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#94A3B8" }}>
              <i className="fa-solid fa-receipt" style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}></i>
              <p>No transactions found in record. Start a new cheque deposit above.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="transaction-table">
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Depositor</th>
                    <th>Receiver</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Signature</th>
                    <th>Biometrics</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontWeight: "700", color: "#2563EB" }}>{tx.reference_id}</td>
                      <td>{tx.depositor_account}</td>
                      <td>{tx.receiver_account}</td>
                      <td style={{ fontWeight: "700" }}>₹ {Number(tx.amount).toLocaleString('en-IN')}</td>
                      <td>{tx.transaction_date}</td>
                      <td>
                        {tx.signature_verified ? (
                          <span style={{ color: "#059669", fontWeight: "600" }}><i className="fa-solid fa-check"></i> Passed</span>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {tx.face_verified ? (
                          <span style={{ color: "#059669", fontWeight: "600" }}><i className="fa-solid fa-check"></i> Passed</span>
                        ) : (
                          <span style={{ color: "#94A3B8" }}>Pending</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${tx.status === 'SUCCESSFUL' ? 'success' : tx.status.includes('FAILED') ? 'failed' : 'pending'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
