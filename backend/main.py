from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import gemini, auth, data, calendar, tasks
import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_msg = f"Global Error: {str(exc)}\n{traceback.format_exc()}"
    print(error_msg)
    # File writing removed for Vercel (read-only filesystem)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "detail": str(exc)},
    )

# Configurar CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "*", # Allow all origins for initial Vercel deployment
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
