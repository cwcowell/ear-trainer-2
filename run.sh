#!/bin/bash
set -e
cd "$(dirname "$0")/backend"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir .
