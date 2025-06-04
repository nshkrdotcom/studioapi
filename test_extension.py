#!/usr/bin/env python3
"""
Simple test script to verify Chrome extension communication
"""
import time
import tempfile
import os
import json

def test_extension_communication():
    """Test if the extension can read commands"""
    print("🧪 Testing Chrome Extension Communication...")
    
    # Create a simple command file (same as the extension uses)
    temp_dir = os.path.join(tempfile.gettempdir(), "ai_studio_cli")
    os.makedirs(temp_dir, exist_ok=True)
    command_file = os.path.join(temp_dir, "commands.json")
    
    print(f"📁 Command file location: {command_file}")
    
    # Write a test command
    test_command = {
        'type': 'TEST_COMMAND',
        'data': {
            'message': 'Hello from Python!',
            'timestamp': time.time()
        }
    }
    
    try:
        with open(command_file, 'w', encoding='utf-8') as f:
            json.dump(test_command, f, ensure_ascii=False, indent=2)
        
        print("✅ Test command written to file")
        print("📋 Command content:")
        print(json.dumps(test_command, indent=2))
        
        print("\n🔍 Now check the Chrome DevTools console for debug messages...")
        print("   The extension should log messages about finding and processing this command.")
        
        # Wait a bit
        time.sleep(5)
        
        # Check if file still exists (extension should have read and potentially cleared it)
        if os.path.exists(command_file):
            print("⚠️  Command file still exists - extension may not be reading it")
            with open(command_file, 'r') as f:
                content = f.read()
                print(f"📄 File content: {content}")
        else:
            print("✅ Command file was processed by extension")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_extension_communication() 