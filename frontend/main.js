const API_BASE = 'https://aqua-ai-1.onrender.com';
let currentTab = 'weather';
let historyChart = null;
let chatHistory = [];
let isTyping = false;

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const FALLBACK_W = {
  location: "Hanoi, Vietnam", temperature: 31, feels_like: 34,
  humidity: 84, description: "Cloudy, high humidity",
  wind_speed: 18, wind_dir: "SE", rainfall_today: 12, visibility: 8,
  tide_height: 1.2, uv_index: 8, pressure: 1008, cloud_cover: 75, dew_point: 26,
  updated_at: new Date().toISOString(),
  forecast: [
    { day: "Today", icon: "cloud", temp: 31, rain_prob: 40 },
    { day: "Tomorrow", icon: "rainy", temp: 29, rain_prob: 70 },
    { day: "Wed", icon: "thunderstorm", temp: 28, rain_prob: 85 },
    { day: "Thu", icon: "partly_cloudy_day", temp: 32, rain_prob: 25 },
    { day: "Fri", icon: "clear_day", temp: 34, rain_prob: 10 }
  ]
};
const FALLBACK_R = { risk_score: 62, level: "Medium", color: "#f59e0b", message: "Risk level medium due to weather", actions: ["Reduce feeding by 20%", "Check salinity"], storm_warning: false };

// === ĐIỀU HƯỚNG TỔNG QUÁT ===
function switchTab(tabId) {
  currentTab = tabId;

  $$('.mobile-nav-item').forEach(b => {
    if (b.dataset.tab === tabId) {
      b.classList.add('active', 'text-primary');
      b.classList.remove('text-on-surface-variant');
    } else {
      b.classList.remove('active', 'text-primary');
      b.classList.add('text-on-surface-variant');
    }
  });

  $$('.tab-content').forEach(c => {
    c.classList.remove('active');
    c.style.display = 'none';
  });

  const targetTab = $(`#tab-${tabId}`);
  if (targetTab) {
    targetTab.classList.add('active');
    // Sửa lại chỉ dùng block, không dùng flex nữa
    targetTab.style.display = 'block';
  }

  const titles = { weather: 'Weather', devices: 'Devices', chat: 'AI Assistant', notifications: 'Alerts', halal: 'Halal Certification', traceability: 'Traceability', preparation: 'Preparation Phase', active: 'Active Farming', export: 'Export Phase' };
  $('#pageTitle').textContent = titles[tabId];

  const mainEl = document.querySelector('main');
  if (tabId === 'chat') {
    $('#chatInputArea').classList.remove('hidden');
    mainEl.classList.remove('pb-20');
    mainEl.classList.add('pb-36'); // Nới đáy thẻ main để tin nhắn không bị che
    if ($('#messagesWrapper').children.length === 0) initChat();
    setTimeout(() => { mainEl.scrollTop = mainEl.scrollHeight; }, 10);
  } else {
    $('#chatInputArea').classList.add('hidden');
    mainEl.classList.remove('pb-36');
    mainEl.classList.add('pb-20'); // Trả lại chiều cao đáy bình thường
  }
}

$$('.mobile-nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

$('#notifBtn').addEventListener('click', () => {
  $('#notifDot').classList.add('hidden');
  switchTab('notifications');
});

function uvLabel(v) {
  if (v <= 2) return { l: "Low", c: "#22c55e" };
  if (v <= 5) return { l: "Moderate", c: "#f59e0b" };
  if (v <= 7) return { l: "High", c: "#f97316" };
  if (v <= 10) return { l: "Very High", c: "#ef4444" };
  return { l: "Extreme", c: "#7c3aed" };
}

function getMaterialIcon(condition) {
  const lower = (condition || '').toLowerCase();
  if (lower.includes('rain') || lower.includes('mưa')) return 'rainy';
  if (lower.includes('cloud') || lower.includes('mây')) return 'cloud';
  if (lower.includes('storm') || lower.includes('bão')) return 'thunderstorm';
  if (lower.includes('clear') || lower.includes('trong')) return 'clear_day';
  if (lower.includes('sun') || lower.includes('nắng')) return 'sunny';
  return 'partly_cloudy_day';
}

function renderWeather(d) {
  if (!d) return;

  if ($('#hero-location')) $('#hero-location').textContent = d.location || '--';
  if ($('#hero-temp')) $('#hero-temp').textContent = (d.temperature !== undefined ? d.temperature : '--') + "°C";
  if ($('#hero-desc')) $('#hero-desc').textContent = d.description || '--';
  if ($('#hero-icon')) $('#hero-icon').textContent = getMaterialIcon(d.icon || d.description);

  if ($('#w-badges')) {
    $('#w-badges').innerHTML = `
  <div class="flex items-center gap-1 bg-surface-container-low border border-surface-variant px-3 py-1.5 rounded-full text-[11px] font-bold text-outline"><span class="material-symbols-outlined text-[14px] text-primary">water_drop</span> ${d.humidity ?? '--'}%</div>
  <div class="flex items-center gap-1 bg-surface-container-low border border-surface-variant px-3 py-1.5 rounded-full text-[11px] font-bold text-outline"><span class="material-symbols-outlined text-[14px] text-primary">air</span> ${d.wind_speed ?? '--'} km/h ${d.wind_dir || ''}</div>
  <div class="flex items-center gap-1 bg-surface-container-low border border-surface-variant px-3 py-1.5 rounded-full text-[11px] font-bold text-outline"><span class="material-symbols-outlined text-[14px] text-primary">rainy</span> ${d.rainfall_today ?? '--'}mm</div>
  <div class="flex items-center gap-1 bg-surface-container-low border border-surface-variant px-3 py-1.5 rounded-full text-[11px] font-bold text-outline"><span class="material-symbols-outlined text-[14px] text-primary">visibility</span> ${d.visibility ?? '--'}km</div>
`;
  }

  if ($('#stat-humidity')) $('#stat-humidity').textContent = (d.humidity !== undefined ? d.humidity : '--') + "%";
  if ($('#stat-tide')) $('#stat-tide').textContent = (d.tide_height !== undefined ? d.tide_height : '--') + "m";

  if ($('#stat-uv')) {
    const uvVal = d.uv_index || 0;
    const uv = uvLabel(uvVal);
    $('#stat-uv').textContent = d.uv_index !== undefined ? `${uvVal} ${uv.l}` : '--';
    if ($('#stat-uv-dot')) $('#stat-uv-dot').style.backgroundColor = uv.c;
  }

  if ($('#stat-pressure')) $('#stat-pressure').textContent = (d.pressure !== undefined ? d.pressure : '--') + " hPa";
  if ($('#stat-cloud')) $('#stat-cloud').textContent = (d.cloud_cover !== undefined ? d.cloud_cover : '--') + "%";
  if ($('#stat-dew')) $('#stat-dew').textContent = (d.dew_point !== undefined ? d.dew_point : '--') + "°C";

  if ($('#forecast-row') && d.forecast && Array.isArray(d.forecast)) {
    $('#forecast-row').innerHTML = d.forecast.map(f => `
  <div class="min-w-[105px] bg-white border border-surface-variant rounded-2xl p-4 flex flex-col items-center shadow-[0_2px_8px_rgba(0,0,0,0.04)] snap-center">
    <span class="text-xs text-outline font-bold mb-2">${f.day || '-'}</span>
    <span class="material-symbols-outlined text-[32px] text-primary mb-3">${getMaterialIcon(f.icon || f.description)}</span>
    <div class="text-sm font-bold text-on-surface">${f.temp ?? '-'}° <span class="text-outline font-normal ml-1">${f.temp !== undefined ? f.temp - 5 : '-'}°</span></div>
  </div>
`).join("");
  }
}

async function loadWeather(loc = 'Hanoi') {
  try {
    const wRes = await fetch(`${API_BASE}/api/weather?location=${encodeURIComponent(loc)}`);

    if (wRes.status === 404) {
      $('#hero-location').textContent = 'Không tìm thấy thành phố';
      $('#hero-desc').textContent = 'Vui lòng kiểm tra lại chính tả';
      $('#hero-temp').textContent = '--';

      if ($('#w-badges')) $('#w-badges').innerHTML = '';
      if ($('#stat-humidity')) $('#stat-humidity').textContent = '--';
      if ($('#stat-tide')) $('#stat-tide').textContent = '--';
      if ($('#stat-pressure')) $('#stat-pressure').textContent = '--';
      if ($('#stat-cloud')) $('#stat-cloud').textContent = '--';
      if ($('#stat-dew')) $('#stat-dew').textContent = '--';
      if ($('#stat-uv')) $('#stat-uv').textContent = '--';

      return;
    }

    if (wRes.status === 500) {
      $('#hero-desc').textContent = 'Lỗi máy chủ thời tiết';
      return;
    }

    if (!wRes.ok) throw new Error(`API returned status ${wRes.status}`);

    const rRes = await fetch(`${API_BASE}/api/weather-risk?location=${encodeURIComponent(loc)}`);

    renderWeather(await wRes.json());
  } catch (e) {
    console.warn("Network error or backend down, using fallback data:", e.message);
    renderWeather({ ...FALLBACK_W, location: loc + " (Local)" });
  }
}

function getBatteryColor(level) {
  if (level >= 80) return 'text-secondary';
  if (level >= 40) return 'text-tertiary';
  return 'text-error';
}

function renderProWaterQuality(data) {
  const isOffline = data.status === 'offline';

  const salPct = Math.min(100, Math.max(0, ((data.salinity || 0) / 30) * 100));
  const doPct = Math.min(100, Math.max(0, ((data.do || 0) / 10) * 100));
  const phPct = Math.min(100, Math.max(0, ((data.ph || 0) / 14) * 100));
  const tempPct = Math.min(100, Math.max(0, ((data.temperature || 0) / 40) * 100));

  return `
<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Salinity</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">science</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold text-on-surface tracking-tight">${data.salinity ?? '--'}</span>
    <span class="text-[10px] font-bold text-on-surface-variant">ppt</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant mb-1 font-bold">
      <span>15-25 ppt</span>
      <span class="text-secondary">Optimal</span>
    </div>
    <div class="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
      <div class="bg-primary h-full rounded-full" style="width: ${salPct}%"></div>
    </div>
  </div>
</div>

<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Oxygen</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">air</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold ${data.do < 5 ? 'text-error' : 'text-on-surface'} tracking-tight">${data.do ?? '--'}</span>
    <span class="text-[10px] font-bold text-on-surface-variant">mg/L</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant mb-1 font-bold">
      <span>>5.0 mg/L</span>
      <span class="${data.do < 5 ? 'text-error' : 'text-secondary'}">${data.do < 5 ? 'Low' : 'Good'}</span>
    </div>
    <div class="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
      <div class="${data.do < 5 ? 'bg-error' : 'bg-secondary'} h-full rounded-full" style="width: ${doPct}%"></div>
    </div>
  </div>
</div>

<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Water pH</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">opacity</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold ${data.ph < 7.5 || data.ph > 8.5 ? 'text-error' : 'text-on-surface'} tracking-tight">${data.ph ?? '--'}</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant mb-1 font-bold">
      <span>7.5-8.5</span>
      <span class="text-primary-container">Stable</span>
    </div>
    <div class="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
      <div class="bg-primary-container h-full rounded-full" style="width: ${phPct}%"></div>
    </div>
  </div>
</div>

<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Temp</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">thermostat</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold text-on-surface tracking-tight">${data.temperature ?? '--'}</span>
    <span class="text-[10px] font-bold text-on-surface-variant">°C</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant mb-1 font-bold">
      <span>28-32 °C</span>
      <span class="text-on-surface-variant">Normal</span>
    </div>
    <div class="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
      <div class="bg-primary-fixed-dim h-full rounded-full" style="width: ${tempPct}%"></div>
    </div>
  </div>
</div>
`;
}

function renderProChemicals(data) {
  return `
<div class="flex justify-between items-center p-3 rounded-xl border border-outline-variant bg-surface">
  <div>
    <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">Ammonia (NH3)</p>
    <div class="flex items-baseline gap-1">
      <span class="font-bold text-lg text-on-surface">${data.ammonia ?? '--'}</span>
      <span class="text-[10px] text-on-surface-variant">mg/L</span>
    </div>
  </div>
  <span class="material-symbols-outlined text-secondary bg-secondary-container/30 p-1.5 rounded-full text-sm">check_circle</span>
</div>
<div class="flex justify-between items-center p-3 rounded-xl border border-outline-variant bg-surface">
  <div>
    <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">Nitrite (NO2)</p>
    <div class="flex items-baseline gap-1">
      <span class="font-bold text-lg text-on-surface">${data.nitrite ?? '--'}</span>
      <span class="text-[10px] text-on-surface-variant">mg/L</span>
    </div>
  </div>
  <span class="material-symbols-outlined text-secondary bg-secondary-container/30 p-1.5 rounded-full text-sm">check_circle</span>
</div>
<div class="flex justify-between items-center p-3 rounded-xl border border-outline-variant bg-surface">
  <div>
    <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">Alkalinity</p>
    <div class="flex items-baseline gap-1">
      <span class="font-bold text-lg text-on-surface">${data.alkalinity ?? '--'}</span>
      <span class="text-[10px] text-on-surface-variant">mg/L</span>
    </div>
  </div>
  <span class="material-symbols-outlined text-primary bg-primary-container/20 p-1.5 rounded-full text-sm">check_circle</span>
</div>
<div class="flex justify-between items-center p-3 rounded-xl border border-error-container bg-error-container/10">
  <div>
    <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">H2S (Danger)</p>
    <div class="flex items-baseline gap-1">
      <span class="font-bold text-lg text-error">${data.h2s ?? '--'}</span>
      <span class="text-[10px] text-on-surface-variant">mg/L</span>
    </div>
  </div>
  <span class="material-symbols-outlined text-error bg-error-container p-1.5 rounded-full text-sm">warning</span>
</div>
`;
}

async function loadDevices() {
  const pond = $('#globalPondSelector').value;
  try {
    const res = await fetch(`${API_BASE}/api/device/sensor-data?pond=${pond}`);
    if (!res.ok) throw new Error();

    const data = await res.json();

    $('#pro-water-quality').innerHTML = renderProWaterQuality(data);
    $('#pro-chemical-stats').innerHTML = renderProChemicals(data);

    const batt = data.battery || 85;
    $('#pro-battery').textContent = batt + '%';
    $('#pro-battery').className = `text-lg font-bold ${getBatteryColor(batt)}`;
    $('#pro-batt-icon').className = `material-symbols-outlined text-[18px] ${getBatteryColor(batt)}`;
    $('#pro-batt-icon').textContent = batt >= 80 ? 'battery_full' : batt >= 40 ? 'battery_5_bar' : 'battery_alert';

    $('#pro-signal').textContent = (data.signal || 90) + '%';

    loadChart(pond);
  } catch (e) {
    $('#pro-water-quality').innerHTML = `<div class="col-span-2 text-center text-sm text-error py-4">Lỗi kết nối API. Vui lòng thử lại.</div>`;
  }
}

async function loadChart(pond) {
  const metric = $('#metricSelect').value;
  try {
    const res = await fetch(`${API_BASE}/api/device/history?pond=${pond}&metric=${metric}&hours=24`);
    const data = await res.json();
    if (historyChart) historyChart.destroy();

    const labels = data.data.map(d => d.time);
    const values = data.data.map(d => d.value);

    if (values.length > 0) {
      const maxVal = Math.max(...values).toFixed(1);
      const minVal = Math.min(...values).toFixed(1);
      const avgVal = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);

      if ($('#chart-high')) $('#chart-high').textContent = maxVal;
      if ($('#chart-low')) $('#chart-low').textContent = minVal;
      if ($('#chart-avg')) $('#chart-avg').textContent = avgVal;
    }

    historyChart = new Chart($('#historyChart').getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: metric,
          data: values,
          borderColor: '#005394',
          backgroundColor: 'rgba(43, 108, 176, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: {
            display: true,
            position: 'left',
            grid: { color: 'rgba(0,0,0,0.05)' },
            border: { display: false },
            ticks: { font: { size: 10 }, color: '#727782' }
          }
        }
      }
    });
  } catch (e) { }
}

// Hàm in tin nhắn tức thì (dùng cho User)
function appendMsg(sender, text) {
  const isUser = sender === 'User';
  const html = `
<div class="flex gap-2 ${isUser ? 'flex-row-reverse' : ''} message-enter">
  <div class="w-8 h-8 rounded-full flex shrink-0 items-center justify-center ${isUser ? 'bg-surface-variant' : 'bg-primary text-white'}">
    <span class="material-symbols-outlined text-[16px]">${isUser ? 'person' : 'smart_toy'}</span>
  </div>
  <div class="p-3 rounded-2xl max-w-[80%] text-sm ${isUser ? 'bg-primary text-white rounded-tr-sm' : 'bg-surface-container rounded-tl-sm markdown-content'}">
    ${isUser ? text : marked.parse(text)}
  </div>
</div>
`;
  $('#messagesWrapper').insertAdjacentHTML('beforeend', html);
  const mainEl = document.querySelector('main');
  mainEl.scrollTop = mainEl.scrollHeight;
}

// HIỆU ỨNG GÕ CHỮ CHO AI
function appendDynamicAIMsg(text) {
  const msgId = 'ai-msg-' + Date.now();
  const html = `
<div class="flex gap-2 message-enter">
  <div class="w-8 h-8 rounded-full flex shrink-0 items-center justify-center bg-primary text-white">
    <span class="material-symbols-outlined text-[16px]">smart_toy</span>
  </div>
  <div id="${msgId}" class="p-3 rounded-2xl max-w-[80%] text-sm bg-surface-container rounded-tl-sm markdown-content min-h-[44px]">
  </div>
</div>
`;
  $('#messagesWrapper').insertAdjacentHTML('beforeend', html);

  const bubble = document.getElementById(msgId);
  let i = 0;
  const charsPerFrame = 2; // Tốc độ gõ: Tăng số này lên nếu muốn gõ nhanh hơn

  const typingInterval = setInterval(() => {
    i += charsPerFrame;
    bubble.innerHTML = marked.parse(text.substring(0, i));
    const mainEl = document.querySelector('main');
    mainEl.scrollTop = mainEl.scrollHeight;

    if (i >= text.length) {
      clearInterval(typingInterval);
      bubble.innerHTML = marked.parse(text); // Chốt hạ nội dung cuối cùng
    }
  }, 15);
}

function initChat() {
  appendMsg('AI', "**Hello!** Aqua-AI system is online. How can I assist you today?");
}

$('#chatForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#messageInput');
  const msg = input.value.trim();
  if (!msg) return;

  // 1. Hiển thị tin nhắn User
  input.value = '';
  appendMsg('User', msg);

  // 2. Hiện bong bóng "AI đang suy nghĩ..." (Lượn sóng)
  const typingId = 'typing-' + Date.now();
  const typingHtml = `
<div id="${typingId}" class="flex gap-2 message-enter">
  <div class="w-8 h-8 rounded-full flex shrink-0 items-center justify-center bg-primary text-white">
    <span class="material-symbols-outlined text-[16px]">smart_toy</span>
  </div>
  <div class="p-3 rounded-2xl bg-surface-container rounded-tl-sm flex items-center justify-center gap-1 min-w-[50px] h-[40px]">
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  </div>
</div>
`;
  $('#messagesWrapper').insertAdjacentHTML('beforeend', typingHtml);
  const mainEl = document.querySelector('main');
  mainEl.scrollTop = mainEl.scrollHeight;

  // 3. Gọi API
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, pond: $('#globalPondSelector').value, history: chatHistory })
    });
    const data = await res.json();

    // 4. Tắt bong bóng lượn sóng
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    // 5. Chạy hiệu ứng AI gõ từng chữ
    appendDynamicAIMsg(data.reply || data.response);

    chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: data.reply });
  } catch (e) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    appendMsg('AI', "⚠️ Lỗi kết nối đến máy chủ AI. Xin thử lại sau.");
  }
});

// Toast Notification Helper
function showToast(title, message, icon = 'info') {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-20 left-4 right-4 bg-surface-container border border-outline-variant rounded-lg px-4 py-3 shadow-lg z-50 animate-fade-in';
  toast.innerHTML = `
<div class="flex items-start gap-2">
  <span class="material-symbols-outlined text-primary mt-0.5">${icon}</span>
  <div>
    <p class="font-bold text-sm text-on-surface">${title}</p>
    <p class="text-xs text-on-surface-variant mt-0.5">${message}</p>
  </div>
</div>
`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// QR Code Generator Function
function generateTraceabilityQR() {
  const qrContainer = document.getElementById('batch-qrcode-container');
  if (!qrContainer) return;

  // Check if mockData exists
  if (typeof mockData !== 'undefined' && mockData.traceability) {
    // Generate QR using the mock payload
    const qrData = JSON.stringify(mockData.traceability);
    
    // Clear any existing content
    qrContainer.innerHTML = '';
    
    new QRCode(qrContainer, {
      text: qrData,
      width: 160,
      height: 160,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.H
    });
  }
}

// Event Listeners
$('#weatherSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadWeather(e.target.value); });
$('#metricSelect').addEventListener('change', () => loadChart($('#globalPondSelector').value));
$('#globalPondSelector').addEventListener('change', () => { loadDevices(); if (currentTab === 'weather') loadWeather(); });

// --- DYNAMIC RENDERING FUNCTIONS ---

function renderHalalDashboard(data) {
  if (!$('#halal-score')) return;
  
  $('#halal-score').textContent = data.integrityScore;
  $('#halal-score-bar').style.width = data.integrityScore + '%';
  
  // Color change logic for score
  if (data.integrityScore >= 90) $('#halal-score-bar').className = 'h-full bg-secondary transition-all duration-500';
  else if (data.integrityScore >= 75) $('#halal-score-bar').className = 'h-full bg-[#f59e0b] transition-all duration-500';
  else $('#halal-score-bar').className = 'h-full bg-error transition-all duration-500';

  $('#halal-ponds-compliant').textContent = data.pondsCompliant;
  $('#halal-ponds-bar').style.width = (data.pondsCompliant / 10 * 100) + '%';
  
  $('#halal-active-risks').textContent = data.activeRisks;
  
  $('#halal-cert-health').textContent = data.certHealth;
  $('#halal-cert-expiry').textContent = `Expiring in ${data.daysToExpire} days`;
}

function renderHalalRiskMap(ponds) {
  const container = $('#halal-risk-map-grid');
  if (!container) return;
  
  container.innerHTML = ''; // Clear
  
  ponds.forEach(pond => {
    let classes = 'h-full w-full rounded md:rounded-lg flex items-center justify-center text-[10px] font-semibold border ';
    if (pond.status === 'compliant') {
      classes += 'bg-secondary-fixed text-on-secondary-fixed border-secondary/20';
    } else if (pond.status === 'warning') {
      classes += 'bg-[#fef08a] text-[#854d0e] border-[#eab308]/20';
    } else if (pond.status === 'critical') {
      classes += 'bg-error-container text-on-error-container border-error/20';
    } else {
      classes += 'bg-surface-variant text-on-surface-variant border-outline';
    }
    
    container.innerHTML += `<div class="${classes}">${pond.id}</div>`;
  });
}

function renderNotifications(alerts) {
  const container = $('#notifications-list');
  if (!container) return;
  
  container.innerHTML = ''; // Clear
  
  if (alerts.length === 0) {
    container.innerHTML = '<p class="text-sm text-center text-on-surface-variant mt-4">No active alerts</p>';
    return;
  }
  
  alerts.forEach(alert => {
    let colorClass, iconColorClass;
    if (alert.type === 'critical') {
      colorClass = 'bg-red-600';
      iconColorClass = 'bg-red-100 text-red-700';
    } else if (alert.type === 'warning') {
      colorClass = 'bg-orange-500';
      iconColorClass = 'bg-orange-100 text-orange-700';
    } else {
      colorClass = 'bg-blue-500';
      iconColorClass = 'bg-blue-100 text-blue-700';
    }
    
    const alertHTML = `
      <div class="bg-white border border-outline-variant rounded-xl p-4 flex flex-col gap-3 shadow-sm relative overflow-hidden">
        <div class="absolute left-0 top-0 bottom-0 w-1 ${colorClass}"></div>
        <div class="flex gap-3">
          <div class="w-10 h-10 rounded-full ${iconColorClass} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[20px]" style="font-variation-settings: 'FILL' 1;">${alert.icon}</span>
          </div>
          <div class="flex-1">
            <div class="flex justify-between items-start">
              <h3 class="font-bold text-sm text-on-surface">${alert.title}</h3>
              <span class="text-[10px] text-outline-variant">${alert.time}</span>
            </div>
            <p class="text-xs text-on-surface-variant mt-1">${alert.desc}</p>
          </div>
        </div>
      </div>
    `;
    container.innerHTML += alertHTML;
  });
}

// Init
loadWeather();
loadDevices();

if (typeof mockData !== 'undefined' && mockData.dynamic) {
  renderHalalDashboard(mockData.dynamic.halal);
  renderHalalRiskMap(mockData.dynamic.halal.riskMap);
  renderNotifications(mockData.dynamic.alerts);
}

// Render QR code after small delay to ensure DOM is ready
setTimeout(generateTraceabilityQR, 500);
