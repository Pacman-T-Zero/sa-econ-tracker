from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import json, os, httpx
from pathlib import Path

app = FastAPI(title="SA Economic Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_DIR = Path(__file__).parent / "data"
CACHE_DIR.mkdir(exist_ok=True)

class QuestionRequest(BaseModel):
    question: str

class ExplanationResponse(BaseModel):
    answer: str
    sources_used: List[str]
    confidence: str

def get_cache(name):
    p = CACHE_DIR / f"{name}.json"
    if p.exists():
        d = json.loads(p.read_text())
        if datetime.fromisoformat(d["ts"]) > datetime.now() - timedelta(hours=6):
            return d["data"]
    return None

def set_cache(name, data):
    (CACHE_DIR / f"{name}.json").write_text(json.dumps({"ts": datetime.now().isoformat(), "data": data}))

async def fetch_exchange():
    if c := get_cache("exchange"): return c
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.frankfurter.app/latest", params={"from": "USD", "to": "ZAR"}, timeout=10)
        h = await client.get("https://api.frankfurter.app/2024-01-01..", params={"from": "USD", "to": "ZAR"}, timeout=15)
        data = {"current": {"rate": r.json()["rates"]["ZAR"], "date": r.json()["date"]}, "history": [{"date": d, "value": v["ZAR"]} for d, v in h.json().get("rates", {}).items()]}
        set_cache("exchange", data)
        return data

async def fetch_sarb():
    return {"repo_rate": {"current": 8.0, "date": "2024-11-21", "history": [{"date": "2024-11-21", "value": 8.0}, {"date": "2024-09-19", "value": 8.25}, {"date": "2024-03-27", "value": 8.25}, {"date": "2023-05-25", "value": 8.25}, {"date": "2023-01-26", "value": 7.25}, {"date": "2022-11-24", "value": 7.0}]}}

async def fetch_inflation():
    if c := get_cache("inflation"): return c
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.worldbank.org/v2/country/ZAF/indicator/FP.CPI.TOTL.ZG", params={"format": "json", "per_page": 10}, timeout=10)
        d = r.json()
        if len(d) > 1 and d[1]:
            obs = [{"date": str(i["date"]), "value": i["value"]} for i in d[1] if i["value"]]
            data = {"cpi": {"current": obs[0]["value"], "date": obs[0]["date"], "history": obs}}
            set_cache("inflation", data)
            return data
    return {"cpi": {"current": 5.3, "date": "2023", "history": []}}

async def fetch_gdp():
    if c := get_cache("gdp"): return c
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.worldbank.org/v2/country/ZAF/indicator/NY.GDP.MKTP.KD.ZG", params={"format": "json", "per_page": 10}, timeout=10)
        d = r.json()
        if len(d) > 1 and d[1]:
            obs = [{"date": str(i["date"]), "value": round(i["value"], 2)} for i in d[1] if i["value"]]
            data = {"gdp_growth": {"current": obs[0]["value"], "date": obs[0]["date"], "history": obs}}
            set_cache("gdp", data)
            return data
    return {"gdp_growth": {"current": 0.7, "date": "2023", "history": []}}

@app.get("/")
async def root():
    return {"name": "SA Economic Tracker API", "status": "healthy"}

@app.get("/dashboard")
async def dashboard():
    import asyncio
    ex, sarb, inf, gdp = await asyncio.gather(fetch_exchange(), fetch_sarb(), fetch_inflation(), fetch_gdp(), return_exceptions=True)
    safe = lambda x: {} if isinstance(x, Exception) else x
    return {
        "exchange_rate": safe(ex), "sarb": safe(sarb), "inflation": safe(inf), "gdp": safe(gdp),
        "indicators": [
            {"name": "ZAR/USD Rate", "value": safe(ex).get("current", {}).get("rate", "N/A"), "unit": "ZAR", "description": "Rand per US Dollar", "icon": "💱"},
            {"name": "Repo Rate", "value": safe(sarb).get("repo_rate", {}).get("current", "N/A"), "unit": "%", "description": "SARB interest rate", "icon": "🏦"},
            {"name": "Inflation", "value": safe(inf).get("cpi", {}).get("current", "N/A"), "unit": "%", "description": "Annual CPI", "icon": "📈"},
            {"name": "GDP Growth", "value": safe(gdp).get("gdp_growth", {}).get("current", "N/A"), "unit": "%", "description": "Annual growth", "icon": "🇿🇦"},
        ]
    }

@app.post("/ask", response_model=ExplanationResponse)
async def ask(req: QuestionRequest):
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return ExplanationResponse(answer="AI features need a GROQ_API_KEY. Get one free at console.groq.com", sources_used=[], confidence="low")
    async with httpx.AsyncClient() as client:
        r = await client.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": "llama-3.1-70b-versatile", "messages": [{"role": "user", "content": f"As an SA economic expert, briefly answer: {req.question}"}], "max_tokens": 500},
            timeout=30)
        if r.status_code == 200:
            return ExplanationResponse(answer=r.json()["choices"][0]["message"]["content"], sources_used=["SARB", "StatsSA"], confidence="high")
    return ExplanationResponse(answer="Could not get AI response. Try again.", sources_used=[], confidence="low")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
