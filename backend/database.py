import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import os

# Initialize Firebase Admin
# Expecting 'firebase_serviceAccountKey.json' in the same directory or provided via env var
cred_path = os.path.join(os.path.dirname(__file__), "firebase_serviceAccountKey.json")

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Admin initialized successfully.")
else:
    print(f"Warning: {cred_path} not found. Stats will not be saved.")
    db = None

def update_player_stats(player_id: str, role: str, result: str):
    """
    Update stats for a player.
    role: "TIGER" or "GOAT"
    result: "WIN", "LOSS", "DRAW"
    """
    if not db or not player_id or player_id == "AI":
        return

    doc_ref = db.collection("users").document(player_id)
    
    # We use a transaction or simple increment. 
    # Since we might be creating the doc, set with merge is good, 
    # but for atomic increments, we need to know the field names.
    
    updates = {}
    
    # Total stats
    if result == "WIN":
        updates["total_wins"] = firestore.Increment(1)
    elif result == "LOSS":
        updates["total_losses"] = firestore.Increment(1)
    elif result == "DRAW":
        updates["total_draws"] = firestore.Increment(1)
        
    # Role specific stats
    prefix = role.lower() # tiger or goat
    
    # Fix for pluralization: "loss" -> "losses", others add "s"
    suffix = "losses" if result == "LOSS" else f"{result.lower()}s"
    key = f"{prefix}_{suffix}"
    
    updates[key] = firestore.Increment(1)
    
    try:
        doc_ref.set(updates, merge=True)
        print(f"Updated stats for {player_id}: {updates}")
    except Exception as e:
        print(f"Error updating stats for {player_id}: {e}")

def get_player_stats(player_id: str):
    """
    Fetch stats for a player.
    """
    if not db or not player_id:
        return None

    try:
        doc = db.collection("users").document(player_id).get()
        if doc.exists:
            return doc.to_dict()
        else:
            return {}
    except Exception as e:
        print(f"Error fetching stats for {player_id}: {e}")
        return None
