import cv2
import numpy as np

# 1. Create a sample bank cheque leaf
def generate_sample_cheque():
    # Standard cheque aspect ratio (approx 800 x 380)
    img = np.ones((380, 800, 3), dtype=np.uint8) * 248  # Off-white / light security paper
    
    # Border & guilloche security lines
    cv2.rectangle(img, (15, 15), (785, 365), (200, 220, 235), 2)
    cv2.rectangle(img, (20, 20), (780, 360), (40, 80, 130), 2)
    
    # Bank Logo & Name
    cv2.putText(img, "GLOBAL SECURE BANK", (40, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (20, 50, 100), 2)
    cv2.putText(img, "IFS CODE: SBIN0001234", (40, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (80, 80, 80), 1)

    # Date boxes
    cv2.putText(img, "DATE: 2 2 1 1 2 0 2 6", (550, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)
    
    # Payee line
    cv2.putText(img, "PAY: Priya Patel", (40, 135), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)
    cv2.line(img, (100, 140), (740, 140), (160, 160, 160), 1)

    # Rupees line
    cv2.putText(img, "RUPEES: Twenty Five Thousand Only", (40, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (10, 10, 10), 2)
    cv2.line(img, (140, 190), (550, 190), (160, 160, 160), 1)

    # Amount box
    cv2.rectangle(img, (580, 160), (740, 200), (30, 30, 30), 2)
    cv2.putText(img, "Rs. 25,000/-", (595, 190), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (10, 10, 10), 2)

    # A/c No box
    cv2.putText(img, "A/C NO: 50100438921890", (60, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (10, 10, 10), 2)

    # Authorized Signatory
    cv2.putText(img, "Please sign above this line", (560, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (100, 100, 100), 1)
    cv2.line(img, (540, 305), (750, 305), (100, 100, 100), 1)

    # Draw realistic stylized signature curves on Cheque
    pts = np.array([[550, 290], [580, 250], [600, 280], [620, 240], [640, 295], [670, 260], [700, 280], [730, 260]], np.int32)
    pts = pts.reshape((-1, 1, 2))
    cv2.polylines(img, [pts], False, (15, 20, 100), 3, cv2.LINE_AA)

    # Bottom MICR band
    cv2.rectangle(img, (20, 335), (780, 360), (230, 230, 230), -1)
    cv2.putText(img, "c 000123 c  500002001 d  012345 c 31", (180, 352), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20, 20, 20), 1)

    cv2.imwrite("sample_cheque.jpg", img)
    print("Generated sample_cheque.jpg")


def generate_sample_signature():
    # Pure signature on clean white background
    sig = np.ones((150, 300, 3), dtype=np.uint8) * 255
    pts = np.array([[30, 95], [65, 45], [90, 85], [115, 35], [140, 105], [175, 55], [210, 85], [245, 55]], np.int32)
    pts = pts.reshape((-1, 1, 2))
    cv2.polylines(sig, [pts], False, (15, 20, 100), 3, cv2.LINE_AA)
    
    cv2.imwrite("sample_signature.png", sig)
    print("Generated sample_signature.png")

if __name__ == "__main__":
    generate_sample_cheque()
    generate_sample_signature()
