"use client"

import { apiFetch } from "@/lib/api"

// Firestore sync utilities using Python backend
// Replaces direct Firebase SDK usage

export async function initializeFirestore() {
  // No-op for backend-based sync, but kept for compatibility if needed
  return true
}

export async function syncToFirestore(userId: string, collection: string, data: any) {
  try {
    if (userId === "preview-user") {
      console.log("[v0] Preview mode - skipping Firestore sync")
      return true
    }

    // Use the generic data endpoint: /api/data/{collection}
    // We need to ensure the data has an ID if possible, or let the backend generate one.
    // The backend expects { id: optional, data: ... } or just the data body?
    // Looking at data.py: save_data takes item: Dict[str, Any] = Body(...)
    // And it checks item.get("id").

    // If data doesn't have an ID, we might want to assign one or let backend do it.
    // Usually syncToFirestore is used with a specific document structure in the original code:
    // doc(db, `users/${userId}/${collection}`, "data") -> This implies a SINGLE document named "data" for some collections?
    // Wait, the original code was:
    // const docRef = doc(db, `users/${userId}/${collection}`, "data")
    // It seems it was storing everything in a single document named "data" inside the collection?
    // OR it was a subcollection?
    // `users/${userId}/${collection}` is a collection path? No, `users/${userId}` is a doc. `${collection}` is a subcollection.
    // And "data" is the document ID?
    // "const docRef = doc(db, `users/${userId}/${collection}`, "data")"
    // Yes, it seems it was using a fixed document ID "data" for these syncs.

    // The backend `save_data` endpoint:
    // @router.post("/{collection}")
    // def save_data(collection: str, item: Dict[str, Any] ...):
    //    ...
    //    doc_id = item.get("id")
    //    if not doc_id: create new...
    //    else: update existing...

    // If we want to match the previous behavior of a single "data" document, we should pass id="data".

    const payload = {
      ...data,
      id: "data" // Force the ID to be "data" to match previous behavior of single-doc sync
    }

    await apiFetch(`/data/${collection}`, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    console.log(`[v0] Synced to Firestore via Backend: users/${userId}/${collection}/data`)
    return true
  } catch (error) {
    console.error("[v0] Error syncing to Firestore:", error)
    return false
  }
}

export async function loadFromFirestore(userId: string, collection: string) {
  try {
    if (userId === "preview-user") {
      console.log("[v0] Preview mode - skipping Firestore load")
      return null
    }

    // The backend `get_data` returns a LIST of documents in the collection.
    // @router.get("/{collection}") -> returns results = []

    const results = await apiFetch(`/data/${collection}`)

    if (Array.isArray(results)) {
      // We are looking for the specific document with id "data"
      const doc = results.find((d: any) => d.id === "data")
      if (doc) {
        console.log(`[v0] Loaded from Firestore via Backend: users/${userId}/${collection}/data`)
        return doc
      }
    }

    console.log(`[v0] No data found in Firestore: users/${userId}/${collection}`)
    return null
  } catch (error) {
    console.error("[v0] Error loading from Firestore:", error)
    return null
  }
}

export async function subscribeToFirestore(userId: string, collection: string, callback: (data: any) => void) {
  // Real-time subscription is not supported by the REST API yet.
  // We will perform an initial load.
  const data = await loadFromFirestore(userId, collection)
  if (data) {
    callback(data)
  }

  // Return dummy unsubscribe
  return () => { }
}
