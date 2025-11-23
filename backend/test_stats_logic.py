import os
import sys
from backend.database import update_player_stats, get_player_stats

# Ensure we can import backend modules
sys.path.append(os.getcwd())

def test_firestore_stats():
    print("Testing Firestore Stats...")
    test_id = "test_user_123"
    
    # 1. Reset/Clear stats (optional, or just assume we add to them)
    # For this test, let's just print what we have
    initial_stats = get_player_stats(test_id)
    print(f"Initial Stats: {initial_stats}")
    
    # 2. Update Stats (Simulate a Win as Tiger)
    print("Updating stats: Tiger WIN...")
    update_player_stats(test_id, "TIGER", "WIN")
    
    # 3. Fetch Stats
    new_stats = get_player_stats(test_id)
    print(f"New Stats: {new_stats}")
    
    # 4. Verify
    if new_stats:
        print("Stats fetched successfully.")
        if new_stats.get("tiger_wins", 0) > (initial_stats.get("tiger_wins", 0) if initial_stats else 0):
            print("SUCCESS: Tiger wins incremented.")
        else:
            print("FAILURE: Tiger wins did not increment.")
    else:
        print("FAILURE: Could not fetch stats.")

if __name__ == "__main__":
    test_firestore_stats()
