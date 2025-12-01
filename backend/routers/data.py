from fastapi import APIRouter, Depends, HTTPException, Body
from backend.routers.auth import verify_token
from firebase_admin import firestore
from pydantic import BaseModel
from typing import Dict, Any, List, Optional

router = APIRouter(tags=["data"])

class DataItem(BaseModel):
    id: Optional[str] = None
    data: Dict[str, Any]

@router.get("/{collection}")
def get_data(collection: str, user = Depends(verify_token)):
    try:
        db = firestore.client()
        uid = user["uid"]
        
        # Fetch all documents in the user's sub-collection
        docs = db.collection("users").document(uid).collection(collection).stream()
        
        results = []
        for doc in docs:
            data = doc.to_dict()
            # Ensure ID is included
            data["id"] = doc.id
            results.append(data)
            
        return results
    except Exception as e:
        print(f"Error getting data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{collection}")
def save_data(collection: str, item: Dict[str, Any] = Body(...), user = Depends(verify_token)):
    try:
        db = firestore.client()
        uid = user["uid"]
        
        # Check if item has an ID
        doc_id = item.get("id")
        
        if not doc_id:
            # Create new document
            doc_ref = db.collection("users").document(uid).collection(collection).document()
            item["id"] = doc_ref.id
            doc_ref.set(item)
            return {"message": "Created", "id": doc_ref.id, "data": item}
        else:
            # Update existing document
            db.collection("users").document(uid).collection(collection).document(doc_id).set(item)
            return {"message": "Updated", "id": doc_id, "data": item}
            
    except Exception as e:
        print(f"Error saving data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{collection}/{doc_id}")
def delete_data(collection: str, doc_id: str, user = Depends(verify_token)):
    try:
        db = firestore.client()
        uid = user["uid"]
        
        db.collection("users").document(uid).collection(collection).document(doc_id).delete()
        return {"message": "Deleted", "id": doc_id}
    except Exception as e:
        print(f"Error deleting data: {e}")
        raise HTTPException(status_code=500, detail=str(e))
