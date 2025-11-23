import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import auth
import os

# Initialize Firebase Admin
cred_path = os.path.join(os.path.dirname(__file__), "firebase_serviceAccountKey.json")

if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    try:
        firebase_admin.get_app()
    except ValueError:
        firebase_admin.initialize_app(cred)
    
    print("Firebase Admin initialized.")
    
    target_email = "vivek.maswadkar@gmail.com"
    print(f"Searching for user with email: {target_email}")

    try:
        user = auth.get_user_by_email(target_email)
        print(f"Found user:")
        print(f"  UID: {user.uid}")
        print(f"  Email: {user.email}")
        print(f"  Display Name: {user.display_name}")
        
        # Also fetch their stats
        db = firestore.client()
        doc = db.collection("users").document(user.uid).get()
        if doc.exists:
            print(f"  Stats: {doc.to_dict()}")
        else:
            print("  No stats found in 'users' collection.")
            
    except auth.UserNotFoundError:
        print(f"User with email {target_email} not found in Firebase Auth.")
    except Exception as e:
        print(f"Error accessing Auth: {e}")
        print("Falling back to listing all users in Firestore 'users' collection...")
        
        db = firestore.client()
        users_ref = db.collection("users")
        docs = users_ref.stream()
        
        print("\nListing all users in Firestore:")
        for doc in docs:
            print(f"  ID: {doc.id} => {doc.to_dict()}")

else:
    print(f"Error: {cred_path} not found.")
