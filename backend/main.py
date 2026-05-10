import os
# pyrefly: ignore [missing-import]
import httpx
import math
import random
import re
import json as pyjson
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="AQUA·AI Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

# Yêu cầu cho AI FARMING ADVISOR
class AdvisorRequest(BaseModel):
    sensor_context: Optional[dict] = {}

# API tư vấn AI FARMING ADVISOR
@app.post("/api/advisor")
async def advisor(req: AdvisorRequest):
    ctx = req.sensor_context or {}
    sensor_summary = f"""
Water pH: {ctx.get('ph', 'N/A')} ({ctx.get('ph_status', '')})
Dissolved Oxygen (DO): {ctx.get('do', 'N/A')} mg/L ({ctx.get('do_status', '')})
Water Temperature: {ctx.get('temperature', 'N/A')}°C ({ctx.get('temp_status', '')})
Salinity: {ctx.get('salinity', 'N/A')} ppt ({ctx.get('salinity_status', '')})
Amonia (NH3): {ctx.get('nh3', 'N/A')} mg/L
NO2: {ctx.get('no2', 'N/A')} mg/L
Alkalinity: {ctx.get('alkalinity', 'N/A')} mg/L
H2S: {ctx.get('h2s', 'N/A')} mg/L
"""
    system_prompt = f"""You are the AI FARMING ADVISOR, an expert in pond data analysis. Based on the following sensor data:
- Provide a brief assessment of the trends (e.g., NH3 slightly increasing, pH stable...)
- Recommend 2-3 specific actions
- Forecast the overall risk (low/medium/high)
Return the result as JSON with 3 fields: 'analysis', 'recommendations' (array), 'risk_level'.

SENSOR DATA:
{sensor_summary}
"""
    gemini_history = [
        {"role": "user", "parts": [{"text": "Analyze the pond data and return JSON as instructed above."}]}
    ]
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GOOGLE_API_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {"parts": [{"text": system_prompt}]},
                    "contents": gemini_history,
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 800}
                }, timeout=30.0
            )
            res_data = response.json()
            print(f"📦 RAW ADVISOR DATA: {res_data}")
            
            if "error" in res_data:
                return {"error": f"Google API Error: {res_data['error'].get('message', 'Unknown error')}"}
                
            try:
                text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                match = re.search(r'\{.*\}', text, re.DOTALL)
                if match:
                    advisor_json = pyjson.loads(match.group(0))
                    return advisor_json
                else:
                    return {"error": "AI returned text without JSON."}
            except Exception as e:
                print(f"🔥 ADVISOR PARSE ERROR: {str(e)}")
                return {"error": f"AI data processing error: {str(e)}"}
    except Exception as e:
        print(f"🔥 ADVISOR CONNECTION ERROR: {str(e)}")
        return {"error": f"Cannot connect to Gemini: {str(e)}"}
 

def sine_wave(base, amp, t, period=24):
    return round(base + amp * math.sin(2 * math.pi * t / period), 2)

def generate_history(base, amp, hours=48, noise=0.3):
    now = datetime.now()
    return [
        {"time": (now - timedelta(hours=hours - i)).strftime("%H:%M"), "date": (now - timedelta(hours=hours - i)).strftime("%d/%m"), "value": round(sine_wave(base, amp, i) + random.uniform(-noise, noise), 2)}
        for i in range(hours)
    ]

PONDS = {
    "pond1": {"name": "Pond #1 - Black Tiger Shrimp", "species": "Black Tiger Shrimp", "area": 5000, "density": 80},
    "pond2": {"name": "Pond #2 - Pangasius", "species": "Pangasius", "area": 8000, "density": 50},
    "pond3": {"name": "Pond #3 - Whiteleg Shrimp", "species": "Whiteleg Shrimp", "area": 4000, "density": 120},
}

# ==================== API THỜI TIẾT THẬT ====================
@app.get("/api/weather")
async def get_weather(location: str = Query("Hanoi")):
# Cho phép OpenWeather tự do tìm kiếm toàn cầu
    query_loc = location.strip()
    
    url = f"https://api.openweathermap.org/data/2.5/weather?q={query_loc}&appid={OPENWEATHER_API_KEY}&units=metric"
    forecast_url = f"https://api.openweathermap.org/data/2.5/forecast?q={query_loc}&appid={OPENWEATHER_API_KEY}&units=metric"
    
    async with httpx.AsyncClient() as client:
        try:
            # Lấy thời tiết hiện tại
            response = await client.get(url)
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="City not found") # Chặn địa điểm láo
            response.raise_for_status()
            real_data = response.json()
            
            # Lấy dự báo 5 ngày
            forecast_res = await client.get(forecast_url)
            forecast_data = []
            if forecast_res.status_code == 200:
                f_json = forecast_res.json()
                # OpenWeather trả về 40 mốc (mỗi 3 tiếng). Ta lấy mốc số 0, 8, 16, 24, 32 để đại diện cho 5 ngày
                for i in range(0, 40, 8):
                    item = f_json["list"][i]
                    dt = datetime.fromtimestamp(item["dt"])
                    day_name = "Today" if i == 0 else "Tomorrow" if i == 8 else dt.strftime("%a")
                    forecast_data.append({
                        "day": day_name,
                        "icon": item["weather"][0]["main"],
                        "temp": round(item["main"]["temp"]),
                        "rain_prob": int(item.get("pop", 0) * 100)
                    })
            
            return {
                "location": f"{real_data['name']}, {real_data['sys']['country']}",
                "temperature": round(real_data["main"]["temp"]),
                "feels_like": round(real_data["main"]["feels_like"]),
                "humidity": real_data["main"]["humidity"],
                "description": real_data["weather"][0]["description"].capitalize(),
                "icon": real_data["weather"][0]["main"],
                "wind_speed": round(real_data["wind"]["speed"] * 3.6),
                "wind_dir": "SE",
                "rainfall_today": real_data.get("rain", {}).get("1h", 0),
                "cloud_cover": real_data["clouds"]["all"],
                "visibility": round(real_data.get("visibility", 10000) / 1000),
                "tide_height": round(random.uniform(0.8, 1.8), 1),
                "uv_index": random.randint(5, 10),
                "pressure": real_data["main"]["pressure"],
                "dew_point": round(real_data["main"]["temp"] - ((100 - real_data["main"]["humidity"]) / 5)),
                "forecast": forecast_data,
                "updated_at": datetime.now().isoformat(),
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail="Weather API error")

# Các API Cũ giữ nguyên
@app.get("/api/weather-risk")
def get_weather_risk(location: str = Query("Ca Mau")):
    score = random.randint(45, 80)
    level = "Low" if score < 40 else "Medium" if score < 70 else "High"
    color = "#22c55e" if score < 40 else "#f59e0b" if score < 70 else "#ef4444"
    return {"risk_score": score, "level": level, "color": color, "message": f"Risk level {level.lower()} due to current weather conditions", "actions": ["Reduce feeding by 20–30% before storm", "Check water salinity before 18:00", "Prepare backup aerator system"], "storm_warning": True, "salt_shock_risk": score > 60}

@app.get("/api/device/sensor-data")
def get_sensor_data(pond: str = Query("pond1")):
    h = datetime.now().hour
    return {"pond_id": pond, "pond_name": PONDS.get(pond, {}).get("name", pond), "timestamp": datetime.now().isoformat(), "salinity": round(sine_wave(16, 3, h) + random.uniform(-0.5, 0.5), 1), "do": round(sine_wave(6.5, 1.2, h, 12) + random.uniform(-0.2, 0.2), 1), "ph": round(sine_wave(7.8, 0.3, h) + random.uniform(-0.05, 0.05), 2), "temperature": round(sine_wave(29, 2, h) + random.uniform(-0.3, 0.3), 1), "ammonia": round(random.uniform(0.01, 0.06), 3), "nitrite": round(random.uniform(0.02, 0.08), 3), "alkalinity": round(random.uniform(100, 140), 0), "turbidity": round(random.uniform(25, 55), 0), "h2s": round(random.uniform(0.0005, 0.003), 4), "battery": random.randint(75, 95), "signal": random.randint(70, 100), "device_id": f"AQ-00{pond[-1]}", "status": "online"}

@app.get("/api/device/status")
def get_device_status(): return {"devices": [{"id": "AQ-001", "pond": "pond1", "status": "online", "battery": 87, "last_seen": datetime.now().isoformat()}, {"id": "AQ-002", "pond": "pond2", "status": "online", "battery": 62, "last_seen": datetime.now().isoformat()}, {"id": "AQ-003", "pond": "pond3", "status": "online", "battery": 91, "last_seen": datetime.now().isoformat()}], "total": 3, "online": 3, "offline": 0}

@app.get("/api/device/feeding-log")
def get_feeding_log(pond: str = Query("pond1")): return {"pond_id": pond, "date": datetime.now().strftime("%d/%m/%Y"), "logs": [{"time": "06:30", "type": "auto", "feed": "Grobest #2", "amount": 250, "icon": "🦐"}, {"time": "14:30", "type": "auto", "feed": "Grobest #2", "amount": 250, "icon": "🦐"}], "total_today": 500, "target": 600}

@app.get("/api/device/history")
def get_history(pond: str = Query("pond1"), metric: str = Query("salinity"), hours: int = Query(48)):
    configs = {"salinity": (16, 3, 0.4), "do": (6.5, 1.2, 0.15), "ph": (7.8, 0.25, 0.05), "temperature": (29, 2, 0.2), "ammonia": (0.03, 0.015, 0.005)}
    base, amp, noise = configs.get(metric, (10, 2, 0.3))
    return {"pond_id": pond, "metric": metric, "hours": hours, "data": generate_history(base, amp, min(hours, 48), noise), "unit": {"salinity": "ppt", "do": "mg/L", "ph": "", "temperature": "°C", "ammonia": "mg/L"}.get(metric, ""), "safe_min": {"salinity": 10, "do": 5, "ph": 7.5, "temperature": 26, "ammonia": 0}.get(metric), "safe_max": {"salinity": 20, "do": 10, "ph": 8.5, "temperature": 32, "ammonia": 0.1}.get(metric)}

class ChatRequest(BaseModel):
    message: str
    pond: str = "pond1"
    history: list = []
    sensor_context: dict = {}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    # Use context sent from frontend if available, else fall back to sensor API
    if req.sensor_context:
        ctx = req.sensor_context
        sensor_summary = f"""
Water pH: {ctx.get('ph', 'N/A')} ({ctx.get('ph_status', '')})
Dissolved Oxygen (DO): {ctx.get('do', 'N/A')} mg/L ({ctx.get('do_status', '')})
Water Temperature: {ctx.get('temperature', 'N/A')}°C ({ctx.get('temp_status', '')})
Salinity: {ctx.get('salinity', 'N/A')} ppt ({ctx.get('salinity_status', '')})
Ammonia (NH3): {ctx.get('nh3', 'N/A')} mg/L
NO2: {ctx.get('no2', 'N/A')} mg/L
Alkalinity: {ctx.get('alkalinity', 'N/A')} mg/L
H2S: {ctx.get('h2s', 'N/A')} mg/L

Overall Assessment:
- Water Quality: {ctx.get('water_quality_label', 'N/A')} - {ctx.get('water_quality_advice', '')}
- Pond Readiness: {ctx.get('readiness_status', 'N/A')} - Completed {ctx.get('tasks_completed', '?')}/{ctx.get('tasks_total', '?')} tasks
- Feeding Plan: {ctx.get('feed_label', 'N/A')} - {ctx.get('feed_advice', '')}
- Detailed Baseline: {ctx.get('baseline_params', '')}"""
    else:
        sensor_data = get_sensor_data(req.pond)
        sensor_summary = f"""pH: {sensor_data.get('ph')} | DO: {sensor_data.get('do')} mg/L | Temp: {sensor_data.get('temperature')}°C | Salinity: {sensor_data.get('salinity')} ppt"""

    try:
        weather_data = await get_weather("Hanoi")
    except:
        weather_data = {"description": "N/A", "temperature": 31, "humidity": 84, "wind_speed": 10}

    system_prompt = f"""You are AQUA-AI, an intelligent shrimp farming assistant. Always reply in English, concisely and practically. Use markdown for beautiful presentation.

REAL-TIME SENSOR DATA:
{sensor_summary}

Current Weather: {weather_data.get('description')} ({weather_data.get('temperature')}°C, humidity {weather_data.get('humidity', 'N/A')}%)

When there are abnormal parameters, provide SPECIFIC recommendations based on actual numbers (e.g., "pH is 6.8 which is lower than the safe threshold of 7.5, need to add CaCO3 lime..."). Do not speak in general terms."""

    gemini_history = [{"role": "user" if msg.get("role") == "user" else "model", "parts": [{"text": msg.get("content", "")}]} for msg in req.history]
    gemini_history.append({"role": "user", "parts": [{"text": req.message}]})

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GOOGLE_API_KEY}",
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {"parts": [{"text": system_prompt}]},
                    "contents": gemini_history,
                    "generationConfig": {"temperature": 0.7, "maxOutputTokens": 1000}
                }, timeout=30.0
            )
            res_data = response.json()
            print(f"📦 RAW DATA FROM GOOGLE: {res_data}")
            
            if "error" in res_data:
                return {"reply": f"⚠️ Google API Error: {res_data['error'].get('message', 'Unknown error')}"}
                
            try:
                return {"reply": res_data["candidates"][0]["content"]["parts"][0]["text"]}
            except Exception as e:
                print(f"🔥 GEMINI ERROR: {str(e)}")
                return {"reply": f"⚠️ Error: AI did not return content. ({str(e)})"}
    except Exception as e:
        print(f"🔥 GEMINI ERROR: {str(e)}")
        return {"reply": f"⚠️ Connection Error: {str(e)}"}

import uvicorn
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)