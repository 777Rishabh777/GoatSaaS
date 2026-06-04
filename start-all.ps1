# Start script for AI SaaS Dashboard (runs web, server, and ai-service concurrently)
Write-Host "Starting Web (Next.js), Server (Express), and AI Service (FastAPI) concurrently..." -ForegroundColor Green

npx concurrently `
  -n "WEB,SERVER,AI-SVC" `
  -c "blue,green,magenta" `
  "npm --prefix apps/web run dev" `
  "npm --prefix apps/server run dev" `
  "cd apps/ai-service && .venv\Scripts\python -m uvicorn app.main:app --reload --port 8000"
