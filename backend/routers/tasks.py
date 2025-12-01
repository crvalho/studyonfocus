from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Optional
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.exceptions import RefreshError
import os

router = APIRouter()

class TaskItem(BaseModel):
    title: str
    notes: Optional[str] = None
    due: Optional[str] = None # RFC 3339 timestamp
    status: Optional[str] = "needsAction" # needsAction or completed
    access_token: str

class DeleteTaskRequest(BaseModel):
    task_id: str
    access_token: str

class ListTasksRequest(BaseModel):
    access_token: str

class UpdateTaskRequest(BaseModel):
    task_id: str
    access_token: str
    title: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None # "needsAction" or "completed"

def get_service(access_token: str):
    creds = Credentials(token=access_token)
    return build('tasks', 'v1', credentials=creds)

@router.post("/create_task")
async def create_task(task: TaskItem):
    try:
        service = get_service(task.access_token)
        
        task_body = {
            'title': task.title,
            'notes': task.notes,
            'status': task.status
        }
        
        if task.due:
            task_body['due'] = task.due

        # Use the default task list ('@default')
        result = service.tasks().insert(tasklist='@default', body=task_body).execute()
        return {"taskId": result.get('id'), "status": "success"}
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error creating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete_task")
async def delete_task(request: DeleteTaskRequest):
    try:
        service = get_service(request.access_token)
        service.tasks().delete(tasklist='@default', task=request.task_id).execute()
        return {"status": "success"}
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error deleting task: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/list_tasks")
async def list_tasks(request: ListTasksRequest):
    try:
        service = get_service(request.access_token)
        results = service.tasks().list(tasklist='@default', showCompleted=True, showHidden=True).execute()
        items = results.get('items', [])
        return {"tasks": items}
    except Exception as e:
        print(f"Error listing tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error listing tasks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/update_task")
async def update_task(request: UpdateTaskRequest):
    try:
        service = get_service(request.access_token)
        
        # First get the task to preserve other fields
        task = service.tasks().get(tasklist='@default', task=request.task_id).execute()
        
        if request.title:
            task['title'] = request.title
        if request.notes:
            task['notes'] = request.notes
        if request.status:
            task['status'] = request.status
            
        updated_task = service.tasks().update(tasklist='@default', task=request.task_id, body=task).execute()
        return {"status": "success", "task": updated_task}
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error updating task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
