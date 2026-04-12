import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")

app = FastAPI()
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
