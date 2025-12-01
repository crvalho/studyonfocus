
from fastapi import APIRouter, HTTPException, Body, Depends
from pydantic import BaseModel
from typing import List, Optional
from google.oauth2.credentials import Credentials
from google.auth.exceptions import RefreshError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from backend.routers.auth import verify_token

router = APIRouter(tags=["calendar"])

class CalendarEvent(BaseModel):
    summary: str
    description: Optional[str] = None
    start_time: str # ISO format
    end_time: str # ISO format
    access_token: str
    recurrence: Optional[List[str]] = None

@router.post("/create_event")
def create_event(event: CalendarEvent, user = Depends(verify_token)):
    try:
        # Create credentials object from access token
        creds = Credentials(token=event.access_token)
        
        service = build('calendar', 'v3', credentials=creds)
        
        event_body = {
            'summary': event.summary,
            'description': event.description,
            'start': {
                'dateTime': event.start_time,
                'timeZone': 'America/Sao_Paulo', # Defaulting to BRT as requested by user context
            },
            'end': {
                'dateTime': event.end_time,
                'timeZone': 'America/Sao_Paulo',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 10},
                ],
            },
        }

        if event.recurrence:
            event_body['recurrence'] = event.recurrence
        
        created_event = service.events().insert(calendarId='primary', body=event_body).execute()
        
        return {"message": "Event created", "eventId": created_event.get('id'), "link": created_event.get('htmlLink')}
        
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error creating calendar event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class DeleteEventRequest(BaseModel):
    eventId: str
    access_token: str

@router.post("/delete_event")
def delete_event(request: DeleteEventRequest, user = Depends(verify_token)):
    try:
        creds = Credentials(token=request.access_token)
        service = build('calendar', 'v3', credentials=creds)
        
        service.events().delete(calendarId='primary', eventId=request.eventId).execute()
        return {"message": "Event deleted"}
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except HttpError as e:
        if e.resp.status == 410:
            return {"message": "Event already deleted"}
        print(f"Error deleting event: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Error deleting event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ListEventsRequest(BaseModel):
    access_token: str
    timeMin: Optional[str] = None
    timeMax: Optional[str] = None

@router.post("/list_events")
def list_events(request: ListEventsRequest, user = Depends(verify_token)):
    try:
        creds = Credentials(token=request.access_token)
        service = build('calendar', 'v3', credentials=creds)
        
        events_result = service.events().list(
            calendarId='primary', 
            timeMin=request.timeMin,
            timeMax=request.timeMax,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        return {"events": events}
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error listing events: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class UpdateEventRequest(BaseModel):
    eventId: str
    access_token: str
    summary: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    recurrence: Optional[List[str]] = None

@router.post("/update_event")
def update_event(request: UpdateEventRequest, user = Depends(verify_token)):
    try:
        creds = Credentials(token=request.access_token)
        service = build('calendar', 'v3', credentials=creds)
        
        event_body = {}
        if request.summary is not None:
            event_body['summary'] = request.summary
        if request.description is not None:
            event_body['description'] = request.description
        if request.start_time:
            event_body['start'] = {'dateTime': request.start_time, 'timeZone': 'America/Sao_Paulo'}
        if request.end_time:
            event_body['end'] = {'dateTime': request.end_time, 'timeZone': 'America/Sao_Paulo'}
        if request.recurrence is not None:
            event_body['recurrence'] = request.recurrence
            
        updated_event = service.events().patch(calendarId='primary', eventId=request.eventId, body=event_body).execute()
        
        return {"message": "Event updated", "eventId": updated_event.get('id'), "link": updated_event.get('htmlLink')}
        
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error updating calendar event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class BatchCreateEventsRequest(BaseModel):
    events: List[CalendarEvent]

@router.post("/create_events_batch")
def create_events_batch(request: BatchCreateEventsRequest, user = Depends(verify_token)):
    try:
        # We'll use the first event's token for credentials (assuming all are for same user)
        if not request.events:
            return {"created": [], "errors": []}
            
        creds = Credentials(token=request.events[0].access_token)
        service = build('calendar', 'v3', credentials=creds)
        
        created_events = []
        errors = []
        
        # Google Calendar API doesn't have a true "batch create" endpoint that is atomic
        # We have to iterate or use the batch HTTP request helper
        # For simplicity and reliability in this context, we'll iterate
        # Ideally we should use batch_request from googleapiclient
        
        batch = service.new_batch_http_request()
        
        def callback(request_id, response, exception):
            if exception:
                errors.append({"id": request_id, "error": str(exception)})
            else:
                created_events.append({"id": request_id, "eventId": response.get('id'), "summary": response.get('summary')})

        for i, event in enumerate(request.events):
            event_body = {
                'summary': event.summary,
                'description': event.description,
                'start': {
                    'dateTime': event.start_time,
                    'timeZone': 'America/Sao_Paulo',
                },
                'end': {
                    'dateTime': event.end_time,
                    'timeZone': 'America/Sao_Paulo',
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [{'method': 'popup', 'minutes': 10}],
                },
            }
            if event.recurrence:
                event_body['recurrence'] = event.recurrence
                
            batch.add(service.events().insert(calendarId='primary', body=event_body), callback=callback)
            
        batch.execute()
        
        return {"created": created_events, "errors": errors}
        
    except RefreshError:
        raise HTTPException(status_code=401, detail="Google token expired")
    except Exception as e:
        print(f"Error creating batch events: {e}")
        raise HTTPException(status_code=500, detail=str(e))
