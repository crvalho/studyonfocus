from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import gemini, auth, data, calendar, tasks
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Configurar CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rotas
app.include_router(gemini.router, prefix="/api/gemini", tags=["gemini"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(data.router, prefix="/api/data", tags=["data"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])

@app.get("/")
def read_root():
    return {"message": "Backend is running"}
