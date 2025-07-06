"""
Development setup script for uv
Run: python dev_setup.py
"""
import subprocess
import sys

def setup_dev_environment():
    """Set up development environment with uv"""
    
    print("Setting up development environment with uv...")
    
    # Install uv if not present
    try:
        subprocess.run(["uv", "--version"], check=True, capture_output=True)
        print("✓ uv is already installed")
    except:
        print("Installing uv...")
        subprocess.run([
            "curl", "-LsSf", 
            "https://astral.sh/uv/install.sh", 
            "|", "sh"
        ], shell=True)
    
    # Create virtual environment
    print("Creating virtual environment...")
    subprocess.run(["uv", "venv"], check=True)
    
    # Install dependencies
    print("Installing dependencies...")
    subprocess.run(["uv", "pip", "install", "-e", ".[dev]"], check=True)
    
    # Install pre-commit hooks
    print("Setting up pre-commit hooks...")
    subprocess.run([".venv/bin/pre-commit", "install"], check=True)
    
    print("\n✅ Development environment ready!")
    print("Activate with: source .venv/bin/activate")

if __name__ == "__main__":
    setup_dev_environment()