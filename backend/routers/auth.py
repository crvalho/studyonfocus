from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
import os

router = APIRouter(tags=["auth"])
security = HTTPBearer()

# Initialize Firebase Admin
# We look for serviceAccountKey.json in the backend directory
cred_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "serviceAccountKey.json")

if not firebase_admin._apps:
    if os.path.exists(cred_path):
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            print("[Python] Firebase Admin initialized successfully")
        except Exception as e:
            print(f"[Python] Error initializing Firebase Admin: {e}")
    else:
        print(f"[Python] Warning: {cred_path} not found. Firebase features will not work until you add the file.")

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    
    # If Firebase is not initialized, we can't verify. 
    # For development without credentials, we might want to bypass or fail.
    # Failing is safer.
    if not firebase_admin._apps:
         raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase not initialized on server",
        )

    try:
        # Add 60 seconds leeway for clock skew
        decoded_token = auth.verify_id_token(token, clock_skew_seconds=60)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.get("/api/auth/verify")
def verify_user(user = Depends(verify_token)):
    return {"message": "User verified", "uid": user["uid"], "email": user.get("email")}
