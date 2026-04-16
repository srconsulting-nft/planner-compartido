import os
import pandas as pd
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from app.database import supabase
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Planner Compartido")

# Configuración de archivos estáticos y plantillas
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Modelos de Pydantic para validación
class UserCreate(BaseModel):
    name: str

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    status: str = "pending"
    task_type: str = "deadline"
    due_date: Optional[str] = None
    recurring_days: List[str] = []
    assigned_users: List[str] = []

# --- RUTAS DE NAVEGACIÓN ---
@app.get("/")
async def read_root(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

# --- API DE USUARIOS ---
@app.get("/api/users")
async def get_users():
    if not supabase: return [{"id": "1", "name": "Modo Local (Sin Supabase)"}]
    response = supabase.table("users").select("*").execute()
    return response.data

@app.post("/api/users")
async def create_user(user: UserCreate):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase no configurado")
    response = supabase.table("users").insert({"name": user.name}).execute()
    return response.data

# --- API DE TAREAS ---
@app.get("/api/tasks")
async def get_tasks():
    if not supabase: return []
    try:
        response = supabase.table("tasks").select("*").order("created_at", desc=True).execute()
        return response.data
    except Exception as e:
        print(f"Error en GET tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks")
async def create_task(task: TaskCreate):
    if not supabase: raise HTTPException(status_code=500, detail="Supabase no configurado")
    try:
        # Convertir a diccionario y asegurar tipos
        data = task.dict()
        # Limpieza: si la fecha es un texto vacío o null, poner None explícitamente
        if not data.get("due_date"):
            data["due_date"] = None
        
        response = supabase.table("tasks").insert(data).execute()
        return response.data
    except Exception as e:
        print(f"Error en POST tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    if not supabase: return {"status": "ok"}
    try:
        supabase.table("users").delete().eq("id", user_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        print(f"Error borrando usuario: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    if not supabase: return {"status": "ok"}
    try:
        supabase.table("tasks").delete().eq("id", task_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        print(f"Error borrando tarea: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/tasks/{task_id}")
async def toggle_task(task_id: str, completed: bool):
    if not supabase: return {"status": "ok"}
    try:
        status = "completed" if completed else "pending"
        response = supabase.table("tasks").update({"status": status}).eq("id", task_id).execute()
        return response.data
    except Exception as e:
        print(f"Error en PATCH task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- EXPORTACIÓN ---
@app.get("/api/export")
async def export_data():
    if not supabase: raise HTTPException(status_code=500, detail="No hay datos para exportar")
    
    users = supabase.table("users").select("*").execute().data
    tasks = supabase.table("tasks").select("*").execute().data
    
    # Crear Excel con dos pestañas
    file_path = "planner_export.xlsx"
    with pd.ExcelWriter(file_path) as writer:
        pd.DataFrame(users).to_excel(writer, sheet_name='Usuarios', index=False)
        pd.DataFrame(tasks).to_excel(writer, sheet_name='Tareas', index=False)
    
    return FileResponse(file_path, filename="Planner_Compartido.xlsx")
