import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")

# Permitir inicialización nula para desarrollo inicial sin credenciales
supabase: Client = create_client(url, key) if url and key else None
