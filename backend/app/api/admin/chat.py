
from dotenv import load_dotenv
from fastapi import APIRouter
from pydantic import BaseModel
from google import genai
load_dotenv()
router = APIRouter(tags=["chat"])

client = genai.Client()
 
MODEL = "gemini-3.6-flash"

class ChatRequest(BaseModel):
    message: str
    history: list = []

def real_api_call(message: str) -> str:
    response = client.models.generate_content(
        model=MODEL,
        contents=message,
    )
    return response.text

@router.post("/chat")
def chat(req: ChatRequest):
    reply = real_api_call(req.message)
    return {"reply": reply}
 
 
@router.get("/")
def health_check():
    return {"status": "backend is running"}