from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
import random
import math
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AQUA·AI Backend API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

def sine_wave(base, amp, t, period=24):
    return round(base + amp * math.sin(2 * math.pi * t / period), 2)

def generate_history(base, amp, hours=48, noise=0.3):
    now = datetime.now()
    return [
        {
            "time": (now - timedelta(hours=hours - i)).strftime("%H:%M"),
            "date": (now - timedelta(hours=hours - i)).strftime("%d/%m"),
            "value": round(sine_wave(base, amp, i) + random.uniform(-noise, noise), 2)
        }
        for i in range(hours)
    ]

PONDS = {
    "pond1": {"name": "Ao #1 – Tôm sú", "species": "Tôm sú", "area": 5000, "density": 80},
    "pond2": {"name": "Ao #2 – Cá tra", "species": "Cá tra", "area": 8000, "density": 50},
    "pond3": {"name": "Ao #3 – Tôm thẻ", "species": "Tôm thẻ", "area": 4000, "density": 120},
}

LOCATION_WEATHER = {
    "cà mau": {"temp": 31, "humidity": 84, "desc": "Nhiều mây, độ ẩm cao", "icon": "🌦", "wind": 18},
    "bạc liêu": {"temp": 30, "humidity": 82, "desc": "Có mây rải rác", "icon": "⛅", "wind": 14},
    "kiên giang": {"temp": 29, "humidity": 86, "desc": "Mưa rào nhẹ", "icon": "🌧", "wind": 12},
    "sóc trăng": {"temp": 32, "humidity": 78, "desc": "Nắng gián đoạn", "icon": "🌤", "wind": 16},
    "trà vinh": {"temp": 31, "humidity": 80, "desc": "Trời quang", "icon": "☀️", "wind": 10},
}

@app.get("/api/weather")
def get_weather(location: str = Query("Cà Mau")):
    key = location.lower().strip()
    data = LOCATION_WEATHER.get(key, {
        "temp": random.randint(28, 34),
        "humidity": random.randint(72, 90),
        "desc": "Nhiều mây",
        "icon": "⛅",
        "wind": random.randint(10, 25),
    })
    forecast = []
    days = ["Hôm nay", "T.3", "T.4", "T.5", "T.6", "T.7", "CN"]
    icons = ["🌦", "⛈", "🌧", "⛅", "☀️", "🌤", "🌩"]
    for i in range(5):
        forecast.append({
            "day": days[i],
            "icon": random.choice(icons),
            "temp": data["temp"] + random.randint(-3, 3),
            "rain_prob": random.randint(20, 80),
        })
    return {
        "location": location,
        "temperature": data["temp"],
        "feels_like": data["temp"] + 3,
        "humidity": data["humidity"],
        "description": data["desc"],
        "icon": data["icon"],
        "wind_speed": data["wind"],
        "wind_dir": "Đông Nam",
        "rainfall_today": round(random.uniform(5, 25), 1),
        "cloud_cover": random.randint(50, 85),
        "visibility": round(random.uniform(6, 12), 1),
        "tide_height": round(random.uniform(0.8, 1.8), 1),
        "uv_index": random.randint(5, 10),
        "pressure": random.randint(1005, 1015),
        "dew_point": data["temp"] - random.randint(4, 8),
        "forecast": forecast,
        "updated_at": datetime.now().isoformat(),
    }

@app.get("/api/weather-risk")
def get_weather_risk(location: str = Query("Cà Mau")):
    score = random.randint(45, 80)
    level = "Thấp" if score < 40 else "Trung bình" if score < 70 else "Cao"
    color = "#22c55e" if score < 40 else "#f59e0b" if score < 70 else "#ef4444"
    return {
        "risk_score": score,
        "level": level,
        "color": color,
        "message": f"Rủi ro {level.lower()} do điều kiện thời tiết hiện tại",
        "actions": [
            "Giảm cho ăn 20–30% trước khi bão",
            "Kiểm tra độ mặn trước 18:00",
            "Chuẩn bị máy sục khí dự phòng",
        ],
        "storm_warning": True,
        "salt_shock_risk": score > 60,
    }

@app.get("/api/device/sensor-data")
def get_sensor_data(pond: str = Query("pond1")):
    h = datetime.now().hour
    return {
        "pond_id": pond,
        "pond_name": PONDS.get(pond, {}).get("name", pond),
        "timestamp": datetime.now().isoformat(),
        "salinity": round(sine_wave(16, 3, h) + random.uniform(-0.5, 0.5), 1),
        "do": round(sine_wave(6.5, 1.2, h, 12) + random.uniform(-0.2, 0.2), 1),
        "ph": round(sine_wave(7.8, 0.3, h) + random.uniform(-0.05, 0.05), 2),
        "temperature": round(sine_wave(29, 2, h) + random.uniform(-0.3, 0.3), 1),
        "ammonia": round(random.uniform(0.01, 0.06), 3),
        "nitrite": round(random.uniform(0.02, 0.08), 3),
        "alkalinity": round(random.uniform(100, 140), 0),
        "turbidity": round(random.uniform(25, 55), 0),
        "h2s": round(random.uniform(0.0005, 0.003), 4),
        "battery": random.randint(75, 95),
        "signal": random.randint(70, 100),
        "device_id": f"AQ-00{pond[-1]}",
        "status": "online",
    }

@app.get("/api/device/status")
def get_device_status():
    return {
        "devices": [
            {"id": "AQ-001", "pond": "pond1", "status": "online", "battery": 87, "last_seen": datetime.now().isoformat()},
            {"id": "AQ-002", "pond": "pond2", "status": "online", "battery": 62, "last_seen": datetime.now().isoformat()},
            {"id": "AQ-003", "pond": "pond3", "status": "online", "battery": 91, "last_seen": datetime.now().isoformat()},
        ],
        "total": 3,
        "online": 3,
        "offline": 0,
    }

@app.get("/api/device/feeding-log")
def get_feeding_log(pond: str = Query("pond1")):
    logs = [
        {"time": "06:30", "type": "auto", "feed": "Cám tôm Grobest #2", "amount": 250, "icon": "🦐"},
        {"time": "10:00", "type": "manual", "feed": "Thức ăn bổ sung vi sinh", "amount": 50, "icon": "🌿"},
        {"time": "14:30", "type": "auto", "feed": "Cám tôm Grobest #2", "amount": 250, "icon": "🦐"},
    ]
    return {
        "pond_id": pond,
        "date": datetime.now().strftime("%d/%m/%Y"),
        "logs": logs,
        "total_today": sum(l["amount"] for l in logs),
        "target": 600,
    }

@app.get("/api/device/history")
def get_history(pond: str = Query("pond1"), metric: str = Query("salinity"), hours: int = Query(48)):
    configs = {
        "salinity": (16, 3, 0.4),
        "do": (6.5, 1.2, 0.15),
        "ph": (7.8, 0.25, 0.05),
        "temperature": (29, 2, 0.2),
        "ammonia": (0.03, 0.015, 0.005),
    }
    base, amp, noise = configs.get(metric, (10, 2, 0.3))
    return {
        "pond_id": pond,
        "metric": metric,
        "hours": hours,
        "data": generate_history(base, amp, min(hours, 48), noise),
        "unit": {"salinity": "ppt", "do": "mg/L", "ph": "", "temperature": "°C", "ammonia": "mg/L"}.get(metric, ""),
        "safe_min": {"salinity": 10, "do": 5, "ph": 7.5, "temperature": 26, "ammonia": 0}.get(metric),
        "safe_max": {"salinity": 20, "do": 10, "ph": 8.5, "temperature": 32, "ammonia": 0.1}.get(metric),
    }

@app.get("/api/shock-alert")
def get_shock_alert(pond: str = Query("pond1")):
    return {
        "alerts": [
            {
                "id": "SA-001",
                "type": "salt_shock",
                "severity": "danger",
                "pond": pond,
                "title": "Cảnh báo sốc mặn – Ao #1",
                "message": "Độ mặn dự báo tăng lên 24 ppt vào 14:00 ngày mai",
                "actions": ["Giảm mật độ ao 20–30%", "Chuẩn bị nước ngọt pha loãng", "Ngừng cho ăn buổi chiều"],
                "confidence": 87,
                "time": "2 giờ trước",
                "unread": True,
            }
        ]
    }

@app.get("/api/disease-risk")
def get_disease_risk(pond: str = Query("pond1")):
    prob = random.randint(30, 55)
    return {
        "pond_id": pond,
        "vibrio_probability": prob,
        "risk_level": "medium" if prob < 60 else "high",
        "conditions": {"temperature_risk": True, "ph_risk": False, "do_risk": False},
        "recommendation": "Bổ sung men vi sinh, kiểm tra tôm định kỳ 6h/lần",
        "next_check": "18:00 hôm nay",
    }

@app.get("/api/harvest-optimization")
def get_harvest_optimization(pond: str = Query("pond3")):
    return {
        "pond_id": pond,
        "growth_percent": 82,
        "days_to_target": random.randint(5, 10),
        "market_price_trend": "up",
        "recommended_window": "5–7 ngày tới",
        "estimated_yield": round(random.uniform(800, 1200), 0),
        "profit_estimate": round(random.uniform(12000000, 20000000), -5),
    }

@app.get("/api/action-recommendation")
def get_action_recommendation(pond: str = Query("pond1")):
    return {
        "recommendations": [
            {"priority": "high", "action": "Giảm cho ăn 30% do dự báo bão", "deadline": "Trước 17:00"},
            {"priority": "medium", "action": "Kiểm tra máy sục khí dự phòng", "deadline": "Hôm nay"},
            {"priority": "low", "action": "Ghi nhật ký tăng trưởng tuần", "deadline": "Cuối tuần"},
        ]
    }

@app.get("/api/ponds")
def get_ponds():
    return {"ponds": [{"id": k, **v} for k, v in PONDS.items()]}

class ChatRequest(BaseModel):
    message: str
    pond: str = "pond1"
    history: list = []

@app.post("/api/chat")
async def chat(req: ChatRequest):
    sensor = get_sensor_data(req.pond)
    system_prompt = f"Bạn là AQUA·AI – trợ lý thông minh chuyên về nuôi trồng thủy sản tại Việt Nam. Dữ liệu ao hiện tại ({PONDS.get(req.pond, {}).get('name', req.pond)}): Độ mặn {sensor['salinity']} ppt, DO {sensor['do']} mg/L, pH {sensor['ph']}, Nhiệt độ {sensor['temperature']}°C, NH3 {sensor['ammonia']} mg/L, NO2 {sensor['nitrite']} mg/L. Trả lời ngắn gọn, thực tế, dùng tiếng Việt và emoji."
    
    gemini_history = []
    for msg in req.history:
        role = "user" if msg["role"] == "user" else "model"
        gemini_history.append({
            "role": role,
            "parts": [{"text": msg.get("content", "")}]
        })
    
    gemini_history.append({
        "role": "user",
        "parts": [{"text": req.message}]
    })

    async with httpx.AsyncClient() as client:
        response = await client.post(
            # 1. FIX MODEL MỚI: Nâng cấp thẳng lên gemini-2.5-flash (bản mới và ổn định nhất)
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GOOGLE_API_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                # 2. FIX CẤU TRÚC JSON: Thêm ngoặc vuông [...] vào phần parts
                "system_instruction": {"parts": [{"text": system_prompt}]},
                "contents": gemini_history
            },
            timeout=30.0
        )
        res_data = response.json()
        
        # Bắt lỗi nếu Google vẫn phàn nàn
        if response.status_code != 200:
            print("Lỗi từ Google API:", res_data)
            
        try:
            reply = res_data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            reply = "⚠️ Lỗi kết nối Gemini API! "
            
        return {"reply": reply}

import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)