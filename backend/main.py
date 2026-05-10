import os
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

ADVISOR_GEMINI_MODEL = os.getenv("ADVISOR_GEMINI_MODEL", "gemini-2.0-flash")


def _parse_metric_float(val) -> Optional[float]:
    """Parse sensor values like 7.8, '< 0.1', '0,05'."""
    if val is None:
        return None
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return float(val)
    s = str(val).strip().replace(",", ".")
    if not s or s.upper() == "N/A":
        return None
    if s.startswith("<"):
        s = s[1:].strip()
    try:
        return float(s)
    except ValueError:
        return None


def _build_expert_advisor_payload(ctx: dict) -> dict:
    """
    Fallback chuyên gia (quy tắc + ngữ cảnh) khi không gọi được Gemini hoặc model trả rỗng.
    Luôn trả về nhận định và đề xuất cụ thể bằng tiếng Việt.
    """
    ctx = ctx or {}
    ph = _parse_metric_float(ctx.get("ph"))
    do = _parse_metric_float(ctx.get("do"))
    temp = _parse_metric_float(ctx.get("temperature"))
    sal = _parse_metric_float(ctx.get("salinity"))
    nh3 = _parse_metric_float(ctx.get("nh3"))
    no2 = _parse_metric_float(ctx.get("no2"))
    alk = _parse_metric_float(ctx.get("alkalinity"))
    h2s = _parse_metric_float(ctx.get("h2s"))

    wq_label = ctx.get("water_quality_label") or ""
    wq_advice = (ctx.get("water_quality_advice") or "").strip()
    readiness = (ctx.get("readiness_status") or "").strip()
    feed_adv = (ctx.get("feed_advice") or "").strip()

    analysis_parts: List[str] = []
    recommendations: List[str] = []
    risk_score = 0  # 0 thấp, 1 TB, 2 cao

    def note_risk(delta: int):
        nonlocal risk_score
        risk_score = max(risk_score, delta)

    if ph is not None:
        if ph < 7.5:
            analysis_parts.append(
                f"pH {ph:g} đang thấp so với vùng thuận lợi thường gặp (khoảng 7,5–8,5 cho tôm thẻ chân trắng); "
                "quá trình nitrate hóa dễ bị hạn chế và tôm dễ stress khi cho ăn."
            )
            recommendations.append(
                "Điều chỉnh pH từ từ: dùng vôi nước (CaCO₃) hoặc đá vôi theo chỉ định kỹ thuật địa phương; "
                "đo lại pH và kiềm sau 24–48 giờ, tránh tăng đột ngột >0,3 đơn vị/ngày."
            )
            note_risk(1)
        elif ph > 8.5:
            analysis_parts.append(
                f"pH {ph:g} cao; NH₃ dạng độc hại tăng theo pH, tăng nguy cơ ngộ độc ni tơ khi nồng độ tổng amoni còn trong ao."
            )
            recommendations.append(
                "Giảm pH dần: kiểm soát tảo (che sáng một phần nếu tảo bùng), trao đổi nước có kiểm soát, "
                "tránh bón quá liều vôi; theo dõi NH₃ sát."
            )
            note_risk(1)
        else:
            analysis_parts.append(f"pH {ph:g} nằm trong khoảng thường được xem là chấp nhận được cho nhiều hệ nuôi tôm.")

    if do is not None:
        if do < 3.5:
            analysis_parts.append(
                f"DO {do:g} mg/L rất thấp — nguy cơ thiếu ôxy cấp tính, tôm lên đầu, tổn thất nhanh sau vài giờ."
            )
            recommendations.append(
                "Ưu tiên: bật toàn bộ sục khí quạt/khò, giảm lượng cho ăn 30–50% trong 24h, tránh xúc đáy gây tiêu thụ BOD."
            )
            note_risk(2)
        elif do < 5:
            analysis_parts.append(
                f"DO {do:g} mg/L dưới ngưỡng an toàn thường dùng ban ngày (≥5 mg/L); cá thể có thể giảm ăn và yếu dần nếu kéo dài."
            )
            recommendations.append(
                "Tăng thời gian sục khí đêm; rà soát mật độ nuôi và tảo; đo DO sáng sớm và chiều mỗi ngày."
            )
            note_risk(1)
        else:
            analysis_parts.append(f"DO {do:g} mg/L cho thấy khả năng cung cấp ôxy hiện tại đang đủ nếu duy trì sục khí ổn định.")

    if temp is not None:
        if temp < 26:
            analysis_parts.append(f"Nhiệt độ {temp:g}°C hơi thấp — tôm có thể giảm tiêu hóa, FCR xấu nếu cho ăn quá tay.")
            recommendations.append("Giảm khẩu phần 10–25% hoặc chuyển sang cho ăn theo bảng nhiệt độ thấp; tăng theo dõi phân đáy.")
            note_risk(1)
        elif temp > 32:
            analysis_parts.append(
                f"Nhiệt độ {temp:g}°C cao — tăng nhịp thở, tiêu hao ôxy và stress; tảo/cyanobacteria dễ bùng nổ."
            )
            recommendations.append("Tăng sục khí; che bớt nắng nếu cho phép; tránh cho ăn giữa trưa nắng gắt; đo DO thường xuyên hơn.")
            note_risk(1)
        else:
            analysis_parts.append(f"Nhiệt độ {temp:g}°C thường phù hợp giai đoạn nuôi nhiệt đới nếu DO và chất lượng nước ổn định.")

    if sal is not None:
        if sal < 5:
            analysis_parts.append("Độ mặn rất thấp — cần khớp với giống và giai đoạn; đột biến mặn gây sốc.")
            recommendations.append("Mọi thay đổi mặn thực hiện chậm (≤2 ppt/ngày trừ khi quy trình cấp cứu có chỉ định khác).")
            note_risk(1)
        elif sal > 30:
            analysis_parts.append("Độ mặn cao — kiểm tra nguồn nước, thoát nước ao và sức chịu đựng loài nuôi.")
            note_risk(1)

    if nh3 is not None:
        if nh3 >= 0.5:
            analysis_parts.append(f"NH₃ khoảng {nh3:g} mg/L ở mức nguy hiểm — ưu tiên xử lý ni tơ và giảm nguồn phát thải hữu cơ.")
            recommendations.append(
                "Hạn chế cho ăn; tăng sục khí; xem xét đổi nước có kiểm soát và sản phẩm xử lý amoni theo khuyến cáo thủy sản."
            )
            note_risk(2)
        elif nh3 >= 0.1:
            analysis_parts.append("NH₃ đang ở mức cần cảnh giác; kết hợp pH cao sẽ làm tăng phần NH₃ độc.")
            recommendations.append("Đo lại NH₃ buổi sáng; tránh tăng pH đột ngột; giảm khẩu phần nếu có phân lắng nhiều.")
            note_risk(1)

    if no2 is not None and no2 >= 0.2:
        analysis_parts.append(f"NO₂⁻ {no2:g} mg/L cao — hệ vi sinh chưa ổn định hoặc tải hữu cơ lớn.")
        recommendations.append("Tăng sục khí; trao đổi nước vừa phải; tránh bón vi sinh trùng thời điểm nồng độ NO₂ đang cao nếu chưa có hướng dẫn.")
        note_risk(2)
    elif no2 is not None and no2 >= 0.05:
        analysis_parts.append("NO₂⁻ ở mức cần theo dõi sát trong 48 giờ.")
        note_risk(1)

    if h2s is not None and h2s >= 0.01:
        analysis_parts.append("H₂S có dấu hiệu — kiểm tra tầng đáy, chất hữu cơ lắng và vùng yếm khí.")
        recommendations.append("Khuấy trộn nhẹ vùng đáy an toàn hoặc sục khí đáy; tránh gây trộn mạnh làm bung khí độc.")
        note_risk(2)

    if alk is not None and alk < 80:
        analysis_parts.append("Độ kiềm thấp — buffer yếu, pH dễ biến động sau mưa hoặc khi tảo sụt.")
        recommendations.append("Bổ sung kiềm (bicarbonate/đá vôi) theo quy trình; tránh thay đổi đột ngột.")
        note_risk(1)

    if wq_label or wq_advice:
        analysis_parts.append(
            f"Tóm tắt hệ thống: chất lượng nước {wq_label or '—'}. {wq_advice}".strip()
        )
    if readiness:
        analysis_parts.append(f"Trạng thái chuẩn bị ao: {readiness} (nhiệm vụ {ctx.get('tasks_completed', '?')}/{ctx.get('tasks_total', '?')}).")
    if feed_adv:
        recommendations.append(f"Kế hoạch cho ăn: {feed_adv}")

    if not analysis_parts:
        analysis_parts.append(
            "Dữ liệu cảm biến gửi lên chưa đủ chi tiết để phân tích định lượng; "
            "trong thực tế vẫn nên coi đây là dịp rà soát vận hành hàng ngày."
        )

    if len(recommendations) < 3:
        recommendations.extend(
            [
                "Duy trì nhật ký đo pH, DO, NH₃, NO₂ mỗi ngày (sáng + chiều) và ghi lại lượng cho ăn/trao đổi nước.",
                "Ưu tiên sục khí liên tục đêm; kiểm tra định kỳ độ bùn đáy và ống thổi.",
                "Khi thời tiết xấu (mưa, gió lớn): giảm cho ăn, kiểm tra mặn và pH sau mưa trước khi tăng lại khẩu phần.",
            ]
        )

    risk_label = "Bình thường"
    if risk_score >= 2:
        risk_label = "Cao"
    elif risk_score >= 1:
        risk_label = "Trung bình"

    return {
        "analysis": " ".join(analysis_parts).strip(),
        "recommendations": recommendations[:6],
        "risk_level": risk_label,
        "source": "rule_engine",
    }


def _normalize_advisor_json(data: dict, ctx: dict) -> dict:
    """Đảm bảo luôn có nội dung chuyên gia; gộp với fallback nếu model lười viết."""
    fb = _build_expert_advisor_payload(ctx)
    analysis = (data.get("analysis") or "").strip()
    recs = data.get("recommendations")
    if not isinstance(recs, list):
        recs = []
    recs = [str(r).strip() for r in recs if str(r).strip()]
    risk_raw = (data.get("risk_level") or "").strip()
    risk_map = {
        "thấp": "Bình thường",
        "low": "Bình thường",
        "normal": "Bình thường",
    }
    risk = risk_map.get(risk_raw.lower(), risk_raw) if risk_raw else fb["risk_level"]
    if not risk:
        risk = fb["risk_level"]

    if len(analysis) < 80:
        merged = f"{analysis} {fb['analysis']}".strip() if analysis else fb["analysis"]
        analysis = merged.strip()

    if len(recs) < 2:
        recs = list(dict.fromkeys(recs + fb["recommendations"]))[:6]

    out = {"analysis": analysis, "recommendations": recs, "risk_level": risk}
    if data.get("source"):
        out["source"] = data["source"]
    return out


def _parse_advisor_text_to_json(text: str) -> Optional[dict]:
    if not text or not str(text).strip():
        return None
    raw = str(text).strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        return pyjson.loads(raw)
    except pyjson.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            return pyjson.loads(match.group(0))
        except pyjson.JSONDecodeError:
            return None
    return None


# Yêu cầu cho AI FARMING ADVISOR
class AdvisorRequest(BaseModel):
    sensor_context: Optional[dict] = {}

# API tư vấn AI FARMING ADVISOR
@app.post("/api/advisor")
async def advisor(req: AdvisorRequest):
    ctx = req.sensor_context or {}
    sensor_summary = f"""
pH nước: {ctx.get('ph', 'N/A')} ({ctx.get('ph_status', '')})
Oxy hòa tan (DO): {ctx.get('do', 'N/A')} mg/L ({ctx.get('do_status', '')})
Nhiệt độ nước: {ctx.get('temperature', 'N/A')}°C ({ctx.get('temp_status', '')})
Độ mặn: {ctx.get('salinity', 'N/A')} ppt ({ctx.get('salinity_status', '')})
Amonia (NH3): {ctx.get('nh3', 'N/A')} mg/L
NO2: {ctx.get('no2', 'N/A')} mg/L
Độ kiềm: {ctx.get('alkalinity', 'N/A')} mg/L
H2S: {ctx.get('h2s', 'N/A')} mg/L
Ngữ cảnh thêm — chất lượng nước: {ctx.get('water_quality_label', 'N/A')}. {ctx.get('water_quality_advice', '')}
Chuẩn bị ao: {ctx.get('readiness_status', 'N/A')} (nhiệm vụ {ctx.get('tasks_completed', '?')}/{ctx.get('tasks_total', '?')}).
Cho ăn: {ctx.get('feed_label', 'N/A')}. {ctx.get('feed_advice', '')}
Baseline: {ctx.get('baseline_params', '')}
"""
    system_prompt = f"""Bạn là kỹ sư thủy sản cấp cao (AI FARMING ADVISOR) với kinh nghiệm nuôi tôm thẻ chân trắng/tôm sú ở Việt Nam.

Nhiệm vụ: đọc DỮ LIỆU dưới đây và viết tư vấn thực địa, có thể áp dụng ngay.

QUY TẮC BẮT BUỘC (vi phạm là sai):
1) Trường "analysis": tối thiểu 3–5 câu tiếng Việt; giải thích ý nghĩa sinh học/nguồn gốc rủi ro (stress, nitơ, ôxy đáy, tảo…), không dùng câu chung như "ổn định/mọi thứ tốt" nếu chưa lý giải bằng chỉ số.
2) "recommendations": ít nhất 3 bullet hành động cụ thể (thời điểm đo lại, mức giảm thức ăn %, kiểm tra thiết bị…).
3) "risk_level": chính xác một trong: "Bình thường", "Trung bình", "Cao" (dùng "Bình thường" thay cho mức rủi ro thấp).

DỮ LIỆU AO:
{sensor_summary}
"""

    user_turn = {"role": "user", "parts": [{"text": "Phân tích và trả lời ĐÚNG định dạng JSON theo schema (analysis, recommendations, risk_level)."}]}
    gemini_history = [user_turn]

    generation_json = {
        "temperature": 0.35,
        "maxOutputTokens": 1200,
        "responseMimeType": "application/json",
        "responseSchema": {
            "type": "OBJECT",
            "properties": {
                "analysis": {"type": "STRING"},
                "recommendations": {"type": "ARRAY", "items": {"type": "STRING"}},
                "risk_level": {"type": "STRING"},
            },
            "required": ["analysis", "recommendations", "risk_level"],
        },
    }

    fb_only = lambda: _build_expert_advisor_payload(ctx)

    def finalize_from_gemini_body(res_body: dict) -> Optional[dict]:
        candidates = res_body.get("candidates") or []
        if not candidates:
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        text = (parts[0].get("text") if parts else "") or ""
        parsed = _parse_advisor_text_to_json(text)
        if not isinstance(parsed, dict):
            return None
        parsed["source"] = "gemini"
        normalized = _normalize_advisor_json(parsed, ctx)
        normalized["source"] = "gemini"
        return normalized

    if not GOOGLE_API_KEY:
        print("⚠️ ADVISOR: thiếu GOOGLE_API_KEY — dùng bộ luật chuyên gia cục bộ.")
        out = fb_only()
        out.pop("source", None)
        return out

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{ADVISOR_GEMINI_MODEL}:generateContent?key={GOOGLE_API_KEY}"

    payload_schema = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": gemini_history,
        "generationConfig": generation_json,
    }

    plain_user = {
        "role": "user",
        "parts": [{
            "text": (
                "Trả về DUY NHẤT một object JSON thuần (không markdown), có khóa analysis (string ≥3 câu tiếng Việt), "
                "recommendations (mảng ≥3 string), risk_level ('Bình thường'|'Trung bình'|'Cao'). Không có văn bản khác."
            )
        }],
    }
    payload_plain = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [plain_user],
        "generationConfig": {"temperature": 0.35, "maxOutputTokens": 1200},
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload_schema,
                timeout=45.0,
            )
            res_data = response.json()
            print(f"📦 DỮ LIỆU GỐC ADVISOR (schema): {res_data}")

            if response.status_code != 200 or res_data.get("error"):
                print(f"⚠️ ADVISOR thử schema thất bại ({response.status_code}), thử lại không schema…")

            ok = response.status_code == 200 and not res_data.get("error")
            body = finalize_from_gemini_body(res_data) if ok else None
            if body is None:
                response2 = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json=payload_plain,
                    timeout=45.0,
                )
                res_data2 = response2.json()
                print(f"📦 DỮ LIỆU GỐC ADVISOR (plain): {res_data2}")
                if response2.status_code != 200 or res_data2.get("error"):
                    print(f"🔥 ADVISOR HTTP/lỗi API: {response2.status_code} {res_data2.get('error')}")
                    out = fb_only()
                    out.pop("source", None)
                    return out
                body = finalize_from_gemini_body(res_data2)

            if body is None:
                print("🔥 ADVISOR: không parse được JSON từ model.")
                out = fb_only()
                out.pop("source", None)
                return out
            return body

    except Exception as e:
        print(f"🔥 LỖI ADVISOR: {str(e)}")
        out = fb_only()
        out.pop("source", None)
        return out
 

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
def get_weather_risk(location: str = Query("Cà Mau")):
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
pH nước: {ctx.get('ph', 'N/A')} ({ctx.get('ph_status', '')})
Oxy hòa tan (DO): {ctx.get('do', 'N/A')} mg/L ({ctx.get('do_status', '')})
Nhiệt độ nước: {ctx.get('temperature', 'N/A')}°C ({ctx.get('temp_status', '')})
Độ mặn: {ctx.get('salinity', 'N/A')} ppt ({ctx.get('salinity_status', '')})
Amonia (NH3): {ctx.get('nh3', 'N/A')} mg/L
NO2: {ctx.get('no2', 'N/A')} mg/L
Độ kiềm: {ctx.get('alkalinity', 'N/A')} mg/L
H2S: {ctx.get('h2s', 'N/A')} mg/L

Đánh giá tổng thể:
- Chất lượng nước: {ctx.get('water_quality_label', 'N/A')} - {ctx.get('water_quality_advice', '')}
- Chuẩn bị ao: {ctx.get('readiness_status', 'N/A')} - Hoàn thành {ctx.get('tasks_completed', '?')}/{ctx.get('tasks_total', '?')} nhiệm vụ
- Kế hoạch cho ăn: {ctx.get('feed_label', 'N/A')} - {ctx.get('feed_advice', '')}
- Baseline chi tiết: {ctx.get('baseline_params', '')}"""
    else:
        sensor_data = get_sensor_data(req.pond)
        sensor_summary = f"""pH: {sensor_data.get('ph')} | DO: {sensor_data.get('do')} mg/L | Nhiệt độ: {sensor_data.get('temperature')}°C | Độ mặn: {sensor_data.get('salinity')} ppt"""

    try:
        weather_data = await get_weather("Hanoi")
    except:
        weather_data = {"description": "N/A", "temperature": 31, "humidity": 84, "wind_speed": 10}

    system_prompt = f"""Bạn là AQUA-AI, trợ lý chuyên gia nuôi tôm thông minh. Luôn trả lời bằng tiếng Việt, ngắn gọn, thực tế. Dùng markdown để trình bày đẹp.

DỮ LIỆU CẢM BIẾN THỜI GIAN THỰC:
{sensor_summary}

Thời tiết hiện tại: {weather_data.get('description')} ({weather_data.get('temperature')}°C, độ ẩm {weather_data.get('humidity', 'N/A')}%)

Khi có thông số bất thường, hãy đưa ra khuyến nghị CỤ THỂ dựa trên con số thực (ví dụ: "pH đang 6.8 thấp hơn ngưỡng an toàn 7.5, cần bổ sung vôi CaCO3..."). Không nói chung chung."""

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
            print(f"📦 DỮ LIỆU GỐC TỪ GOOGLE TRẢ VỀ: {res_data}")
            try:
                return {"reply": res_data["candidates"][0]["content"]["parts"][0]["text"]}
            except Exception as e:
                print(f"🔥 LỖI TỪ GEMINI LÀ: {str(e)}")
                return {"reply": "⚠️ Lỗi: Máy chủ AI không phản hồi. Vui lòng thử lại."}
    except Exception as e:
        print(f"🔥 LỖI TỪ GEMINI LÀ: {str(e)}")
        return {"reply": "⚠️ Lỗi: Máy chủ AI không phản hồi. Vui lòng thử lại."}

import uvicorn
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)