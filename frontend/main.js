const API_BASE = 'https://aqua-ai-duc-egdi.onrender.com';
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
    mainEl.classList.replace('pb-20', 'pb-36');
    if ($('#messagesWrapper').children.length === 0) initChat();
    setTimeout(() => { mainEl.scrollTop = mainEl.scrollHeight; }, 10);
  } else {
    $('#chatInputArea').classList.add('hidden');
    mainEl.classList.replace('pb-36', 'pb-20');
    if (tabId === 'weather' || tabId === 'active') updateAIFarmingAdvisor();
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
  if (lower.includes('rain')) return 'rainy';
  if (lower.includes('cloud')) return 'cloud';
  if (lower.includes('storm')) return 'thunderstorm';
  if (lower.includes('clear')) return 'clear_day';
  if (lower.includes('sun')) return 'sunny';
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
      $('#hero-location').textContent = 'City not found';
      $('#hero-desc').textContent = 'Please check the spelling';
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
      $('#hero-desc').textContent = 'Weather server error';
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
  const getSalinityLogic = (val) => {
    if (val === undefined || val === null) return { color: 'text-on-surface', label: '--' };
    if (val < 15) return { color: 'text-error', label: 'Low' };
    if (val > 25) return { color: 'text-error', label: 'High' };
    return { color: 'text-secondary', label: 'Optimal' };
  };

  const getDOLogic = (val) => {
    if (val === undefined || val === null) return { color: 'text-on-surface', label: '--' };
    if (val < 5) return { color: 'text-error', label: 'Low' };
    return { color: 'text-secondary', label: 'Good' };
  };

  const getPHLogic = (val) => {
    if (val === undefined || val === null) return { color: 'text-on-surface', label: '--' };
    if (val < 7.5) return { color: 'text-error', label: 'Low' };
    if (val > 8.5) return { color: 'text-error', label: 'High' };
    return { color: 'text-secondary', label: 'Stable' };
  };

  const getTempLogic = (val) => {
    if (val === undefined || val === null) return { color: 'text-on-surface', label: '--' };
    if (val < 28) return { color: 'text-error', label: 'Low' };
    if (val > 32) return { color: 'text-error', label: 'High' };
    return { color: 'text-secondary', label: 'Normal' };
  };

  const sal = getSalinityLogic(data.salinity);
  const doL = getDOLogic(data.do);
  const phL = getPHLogic(data.ph);
  const tempL = getTempLogic(data.temperature);

  return `
<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Salinity</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">science</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold ${sal.color} tracking-tight">${data.salinity ?? '--'}</span>
    <span class="text-[10px] font-bold text-on-surface-variant">ppt</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant font-bold">
      <span>15-25 ppt</span>
      <span class="${sal.color}">${sal.label}</span>
    </div>
  </div>
</div>

<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Oxygen</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">air</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold ${doL.color} tracking-tight">${data.do ?? '--'}</span>
    <span class="text-[10px] font-bold text-on-surface-variant">mg/L</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant font-bold">
      <span>>5.0 mg/L</span>
      <span class="${doL.color}">${doL.label}</span>
    </div>
  </div>
</div>

<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Water pH</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">opacity</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold ${phL.color} tracking-tight">${data.ph ?? '--'}</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant font-bold">
      <span>7.5-8.5</span>
      <span class="${phL.color}">${phL.label}</span>
    </div>
  </div>
</div>

<div class="border border-outline-variant rounded-xl p-3 bg-surface flex flex-col justify-between">
  <div class="flex justify-between items-start mb-2">
    <span class="font-bold text-xs text-on-surface-variant">Temp</span>
    <span class="material-symbols-outlined text-on-surface-variant text-[16px]">thermostat</span>
  </div>
  <div class="flex items-baseline gap-1 mb-2">
    <span class="text-2xl font-bold ${tempL.color} tracking-tight">${data.temperature ?? '--'}</span>
    <span class="text-[10px] font-bold text-on-surface-variant">°C</span>
  </div>
  <div class="mt-auto">
    <div class="flex justify-between text-[9px] text-on-surface-variant font-bold">
      <span>28-32 °C</span>
      <span class="${tempL.color}">${tempL.label}</span>
    </div>
  </div>
</div>
`;
}

function renderProChemicals(data) {
  // Helper to determine UI state based on shrimp farming thresholds
  const getStatusUI = (val, type) => {
    const v = parseFloat(val);
    if (isNaN(v)) {
      return { valueColor: 'text-on-surface', containerClass: 'border-outline-variant bg-surface', icon: 'remove', iconClass: 'text-on-surface-variant bg-surface-container-high' };
    }

    let isCritical = false;
    let isWarning = false;

    // Threshold logic for specific chemicals
    if (type === 'nh3') {
      if (v >= 0.5) isCritical = true;
      else if (v >= 0.1) isWarning = true;
    } else if (type === 'no2') {
      if (v >= 0.2) isCritical = true;
      else if (v >= 0.05) isWarning = true;
    } else if (type === 'alkalinity') {
      // Ideal Alkalinity: 80 - 150 mg/L
      if (v < 80 || v > 200) isWarning = true;
    } else if (type === 'h2s') {
      // H2S is highly toxic, very low thresholds
      if (v >= 0.05) isCritical = true;
      else if (v >= 0.01) isWarning = true;
    }

    if (isCritical) {
      return {
        valueColor: 'text-error',
        containerClass: 'border-error-container bg-error-container/10',
        icon: 'warning',
        iconClass: 'text-error bg-error-container'
      };
    } else if (isWarning) {
      return {
        valueColor: 'text-[#d97706]', // Orange for warning
        containerClass: 'border-[#fde047] bg-[#fef08a]/20',
        icon: 'warning',
        iconClass: 'text-[#b45309] bg-[#fef08a]'
      };
    } else {
      // Optimal state
      const themeColor = type === 'alkalinity' ? 'primary' : 'secondary';
      return {
        valueColor: 'text-on-surface',
        containerClass: 'border-outline-variant bg-surface',
        icon: 'check_circle',
        iconClass: `text-${themeColor} bg-${themeColor}-container/30`
      };
    }
  };

  const nh3UI = getStatusUI(data.ammonia, 'nh3');
  const no2UI = getStatusUI(data.nitrite, 'no2');
  const alkUI = getStatusUI(data.alkalinity, 'alkalinity');
  const h2sUI = getStatusUI(data.h2s, 'h2s');

  return `
  <div class="flex justify-between items-center p-3 rounded-xl border transition-colors ${nh3UI.containerClass}">
    <div>
      <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">Ammonia (NH3)</p>
      <div class="flex items-baseline gap-1">
        <span class="font-bold text-lg ${nh3UI.valueColor}">${data.ammonia ?? '--'}</span>
        <span class="text-[10px] text-on-surface-variant">mg/L</span>
      </div>
    </div>
    <span class="material-symbols-outlined p-1.5 rounded-full text-sm ${nh3UI.iconClass}">${nh3UI.icon}</span>
  </div>

  <div class="flex justify-between items-center p-3 rounded-xl border transition-colors ${no2UI.containerClass}">
    <div>
      <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">Nitrite (NO2)</p>
      <div class="flex items-baseline gap-1">
        <span class="font-bold text-lg ${no2UI.valueColor}">${data.nitrite ?? '--'}</span>
        <span class="text-[10px] text-on-surface-variant">mg/L</span>
      </div>
    </div>
    <span class="material-symbols-outlined p-1.5 rounded-full text-sm ${no2UI.iconClass}">${no2UI.icon}</span>
  </div>

  <div class="flex justify-between items-center p-3 rounded-xl border transition-colors ${alkUI.containerClass}">
    <div>
      <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">Alkalinity</p>
      <div class="flex items-baseline gap-1">
        <span class="font-bold text-lg ${alkUI.valueColor}">${data.alkalinity ?? '--'}</span>
        <span class="text-[10px] text-on-surface-variant">mg/L</span>
      </div>
    </div>
    <span class="material-symbols-outlined p-1.5 rounded-full text-sm ${alkUI.iconClass}">${alkUI.icon}</span>
  </div>

  <div class="flex justify-between items-center p-3 rounded-xl border transition-colors ${h2sUI.containerClass}">
    <div>
      <p class="text-[10px] font-bold text-on-surface-variant mb-0.5">H2S (Danger)</p>
      <div class="flex items-baseline gap-1">
        <span class="font-bold text-lg ${h2sUI.valueColor}">${data.h2s ?? '--'}</span>
        <span class="text-[10px] text-on-surface-variant">mg/L</span>
      </div>
    </div>
    <span class="material-symbols-outlined p-1.5 rounded-full text-sm ${h2sUI.iconClass}">${h2sUI.icon}</span>
  </div>
  `;
}

async function loadDevices() {
  const pond = $('#globalPondSelector').value;

  // Use unified mock data if available
  if (typeof mockData !== 'undefined' && mockData.dynamic && mockData.dynamic.unifiedWater) {
    const uw = mockData.dynamic.unifiedWater;
    const data = {
      salinity: uw.salinity,
      do: uw.do,
      ph: uw.ph,
      temperature: uw.temperature,
      ammonia: uw.nh3,
      nitrite: uw.no2,
      alkalinity: uw.alkalinity,
      h2s: uw.h2s,
      battery: 85,
      signal: 90
    };

    $('#pro-water-quality').innerHTML = renderProWaterQuality(data);
    $('#pro-chemical-stats').innerHTML = renderProChemicals(data);

    const batt = data.battery || 85;
    $('#pro-battery').textContent = batt + '%';
    $('#pro-battery').className = `text-lg font-bold ${getBatteryColor(batt)}`;
    $('#pro-batt-icon').className = `material-symbols-outlined text-[18px] ${getBatteryColor(batt)}`;
    $('#pro-batt-icon').textContent = batt >= 80 ? 'battery_full' : batt >= 40 ? 'battery_5_bar' : 'battery_alert';

    $('#pro-signal').textContent = (data.signal || 90) + '%';

    // We update the SVG chart immediately with the unified data
    updateSVGChartWithUnifiedData(uw);

    // Also load the history chart using fallback data in loadChart if API is down
    loadChart(pond);

    return;
  }

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
    $('#pro-water-quality').innerHTML = `<div class="col-span-2 text-center text-sm text-error py-4">API connection error. Please try again.</div>`;
  }
}

function updateSVGChartWithUnifiedData(uw) {
  // SVG Y-axis: 0 to 10 mapped to 100 to 0 (Y = 100 - val * 10)
  const calcY = (val) => 100 - (val * 10);

  // Scale raw values to fit the 0-10 chart visual scale
  const doY = calcY(uw.raw.do);
  const phY = calcY(uw.raw.ph - 2); // Shift pH down slightly to fit chart
  const nh3Y = calcY(uw.raw.nh3 * 10); // Scale NH3 up
  const tempY = calcY((uw.raw.temperature - 25)); // Shift Temp down

  // Helper to update path
  const updatePath = (id, newY) => {
    const path = $(id);
    if (path) {
      const d = path.getAttribute('d');
      // Replace the last coordinate L100,y with L100,newY
      const newD = d.replace(/L100,[\d.]+$/, `L100,${newY.toFixed(1)}`);
      path.setAttribute('d', newD);
    }
  };

  // Helper to update circle
  const updateCircle = (id, newY) => {
    const circle = $(id);
    if (circle) {
      circle.setAttribute('cy', newY.toFixed(1));
    }
  };

  updatePath('#svg-chart-do-path', doY);
  updateCircle('#svg-chart-do-circle', doY);

  updatePath('#svg-chart-ph-path', phY);
  updateCircle('#svg-chart-ph-circle', phY);

  updatePath('#svg-chart-nh3-path', nh3Y);
  updateCircle('#svg-chart-nh3-circle', nh3Y);

  updatePath('#svg-chart-temp-path', tempY);
  updateCircle('#svg-chart-temp-circle', tempY);
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

function getSensorContext() {
  const d = (typeof mockData !== 'undefined' && mockData.dynamic) ? mockData.dynamic : null;
  if (!d) return {};

  const w = d.unifiedWater;
  const prep = d.preparation;
  const getPHStatus = (v) => parseFloat(v) < 7.5 ? 'LOW - BELOW SAFE LEVEL' : parseFloat(v) > 8.5 ? 'HIGH - ABOVE SAFE LEVEL' : 'Safe';
  const getDOStatus = (v) => parseFloat(v) < 5 ? 'SEVERE OXYGEN DEFICIENCY' : 'Sufficient oxygen';
  const getTempStatus = (v) => parseFloat(v) < 28 ? 'Slightly low' : parseFloat(v) > 32 ? 'Slightly high' : 'Ideal';
  const getSalStatus = (v) => parseFloat(v) < 15 ? 'Low' : parseFloat(v) > 25 ? 'High' : 'Stable';

  return {
    ph: w.ph, ph_status: getPHStatus(w.ph),
    do: w.do, do_status: getDOStatus(w.do),
    temperature: w.temperature, temp_status: getTempStatus(w.temperature),
    salinity: w.salinity, salinity_status: getSalStatus(w.salinity),
    nh3: w.nh3, no2: w.no2, alkalinity: w.alkalinity, h2s: w.h2s,
    water_quality_label: prep.waterQuality.label,
    water_quality_advice: prep.waterQuality.advice,
    readiness_status: prep.readiness.status,
    tasks_completed: prep.tasksCompleted,
    tasks_total: prep.tasksTotal,
    feed_label: prep.feedPlan.label,
    feed_advice: prep.feedPlan.advice,
    baseline_params: prep.baselineParameters.map(p => `${p.name}: ${p.value} (${p.status})`).join(', ')
  };
}

async function updateAIFarmingAdvisor() {
  const timeEl = $('#advisor-time');
  const analysisEl = $('#advisor-analysis');
  const recommendationsEl = $('#advisor-recommendations');
  const riskEl = $('#advisor-risk-level');

  if (!timeEl || !analysisEl) return;

  // 1. Update UI to "Loading"
  timeEl.innerText = "Connecting to Artificial Intelligence...";
  analysisEl.innerText = "Gemini is analyzing your pond data...";
  recommendationsEl.innerHTML = '<li class="animate-pulse text-primary font-medium">Calculating solutions...</li>';
  if (riskEl) {
    riskEl.innerText = "---";
    riskEl.className = "bg-surface-container-high text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider";
  }

  // 2. Extract data from mockData
  if (typeof mockData === 'undefined' || !mockData.dynamic) return;
  const waterData = mockData.dynamic.unifiedWater.raw;
  const activeAlerts = mockData.dynamic.alerts;

  // Find the most critical alert for context
  const criticalAlert = activeAlerts.find(a => a.type === 'critical' || a.type === 'warning');
  const alertContext = criticalAlert ? `Alert: ${criticalAlert.title} (${criticalAlert.desc})` : 'System stable.';

  // 3. Technical Prompt Engineering
  const promptPayload = `
      TECHNICAL ANALYSIS FOR BLACK TIGER SHRIMP (Penaeus monodon):
      Current Sensor Data:
      - Temperature: ${waterData.temperature.toFixed(1)}°C
      - pH: ${waterData.ph.toFixed(1)}
      - Salinity: ${waterData.salinity.toFixed(1)}ppt
      - Dissolved Oxygen (DO): ${waterData.do.toFixed(1)}mg/L
      - Ammonia (NH3): ${waterData.nh3.toFixed(2)}mg/L
      - Nitrite (NO2): ${waterData.no2.toFixed(2)}mg/L
      - Status: ${alertContext}

      REQUIREMENTS:
      Act as an aquaculture expert and analyze the above parameters.
      Return ONLY a JSON object with the following structure:
      {
        "analysis": "Brief analysis of the situation (max 2 sentences)",
        "recommendations": ["Action 1", "Action 2", "Action 3"],
        "risk_level": "Low" or "Warning" or "Critical",
        "risk_color": "Tailwind color class (e.g., bg-error-container text-error for Critical, bg-[#fef08a] text-[#854d0e] for Warning, bg-secondary-container text-secondary for Low/Optimal)"
      }
      Note: Do not return any extra text or markdown, only the JSON object.
    `;

  try {
    // 4. REAL API CALL (Using your FastAPI /api/chat endpoint)
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: promptPayload,
        pond: "Pond 03",
        history: [], // No history needed for single analysis
        sensor_context: {} // Context is already in the prompt
      })
    });

    if (!response.ok) throw new Error("API Backend not responding");

    const data = await response.json();
    
    // Clean JSON string if AI wraps it in markdown blocks
    const cleanJsonString = data.reply.replace(/```json|```/g, "").trim();
    const aiResult = JSON.parse(cleanJsonString);

    // 5. Update UI from Gemini's response
    const now = new Date();
    timeEl.innerText = `AI Updated: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    analysisEl.innerText = aiResult.analysis;
    
    recommendationsEl.innerHTML = aiResult.recommendations
      .map(rec => `<li>${rec}</li>`)
      .join('');

    if (riskEl) {
      riskEl.innerText = aiResult.risk_level.toUpperCase();
      riskEl.className = `text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${aiResult.risk_color}`;
    }

  } catch (error) {
    console.error("AI Advisor Connection Error:", error);
    analysisEl.innerText = "Error: Could not receive AI response. Please check API Key or Backend.";
    recommendationsEl.innerHTML = "<li>Please check your network connection.</li>";
  }
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

  // 3. Gọi backend /api/chat — backend giữ API key an toàn, gọi Gemini server-side
  try {
    const sensorContext = getSensorContext();

    // DEBUG: Log the URL before making the request
    const chatApiUrl = `${API_BASE}/api/chat`;
    console.log("🚀 Preparing API call to URL:", chatApiUrl);

    const res = await fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        pond: $('#globalPondSelector').value,
        history: chatHistory,
        sensor_context: sensorContext
      })
    });

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    if (!res.ok) {
      const errText = await res.text();
      console.error('Backend error:', errText);
      appendMsg('AI', '⚠️ AI server busy. Please try again later.');
      return;
    }

    const data = await res.json();
    const reply = data.reply || '⚠️ No response received.';
    appendDynamicAIMsg(reply);
    chatHistory.push({ role: 'user', content: msg }, { role: 'assistant', content: reply });

  } catch (e) {
    // DEBUG: Expose the actual error
    console.error("❌ ACTUAL ERROR HERE:", e);
    console.error("Error details:", e.message, e.stack);

    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    appendMsg('AI', '⚠️ Cannot connect to server. Please check your internet connection.');
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
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
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

function renderPreparationDashboard(data) {
  if (!$('#prep-readiness-score')) return;

  // Pond Readiness
  $('#prep-readiness-score').textContent = data.readiness.score;
  $('#prep-readiness-status').textContent = data.readiness.status;

  const readinessAdviceEl = $('#prep-readiness-advice');
  if (readinessAdviceEl) {
    readinessAdviceEl.textContent = data.readiness.advice;
    readinessAdviceEl.className = `text-[10px] mt-2 leading-tight font-medium ${data.readiness.adviceColor}`;
  }

  if (data.readiness.status === 'Critical') {
    $('#prep-readiness-status-container').className = 'flex items-center text-error text-xs font-medium gap-1';
    $('#prep-readiness-icon').textContent = 'warning';
  } else if (data.readiness.status === 'Warning') {
    $('#prep-readiness-status-container').className = 'flex items-center text-[#f59e0b] text-xs font-medium gap-1';
    $('#prep-readiness-icon').textContent = 'warning';
  } else {
    $('#prep-readiness-status-container').className = 'flex items-center text-secondary text-xs font-medium gap-1';
    $('#prep-readiness-icon').textContent = 'check_circle';
  }

  // Water Quality
  $('#prep-water-status').textContent = data.waterQuality.label;
  $('#prep-water-detail').textContent = data.waterQuality.detail;

  const waterAdviceEl = $('#prep-water-advice');
  if (waterAdviceEl) {
    waterAdviceEl.textContent = data.waterQuality.advice;
    waterAdviceEl.className = `text-[10px] mt-2 leading-tight font-medium ${data.waterQuality.adviceColor}`;
  }

  if (data.waterQuality.status === 'critical') {
    $('#prep-water-status').className = 'text-lg font-bold text-error';
    $('#prep-water-icon').className = 'material-symbols-outlined text-error';
    $('#prep-water-detail-container').className = 'flex items-center text-error text-xs font-medium gap-1';
    $('#prep-water-dot').className = 'w-2 h-2 rounded-full bg-error';
  } else if (data.waterQuality.status === 'warning') {
    $('#prep-water-status').className = 'text-lg font-bold text-[#f59e0b]';
    $('#prep-water-icon').className = 'material-symbols-outlined text-[#f59e0b]';
    $('#prep-water-detail-container').className = 'flex items-center text-[#f59e0b] text-xs font-medium gap-1';
    $('#prep-water-dot').className = 'w-2 h-2 rounded-full bg-[#f59e0b]';
  } else {
    $('#prep-water-status').className = 'text-lg font-bold text-secondary';
    $('#prep-water-icon').className = 'material-symbols-outlined text-secondary';
    $('#prep-water-detail-container').className = 'flex items-center text-secondary text-xs font-medium gap-1';
    $('#prep-water-dot').className = 'w-2 h-2 rounded-full bg-secondary';
  }

  // Feed Plan
  $('#prep-feed-status').textContent = data.feedPlan.label;
  $('#prep-feed-detail').textContent = data.feedPlan.detail;

  const feedAdviceEl = $('#prep-feed-advice');
  if (feedAdviceEl) {
    feedAdviceEl.textContent = data.feedPlan.advice;
    feedAdviceEl.className = `text-[10px] mt-2 leading-tight font-medium ${data.feedPlan.status === 'warning' ? 'text-[#f59e0b]' : 'text-secondary'}`;
  }

  if (data.feedPlan.status === 'warning') {
    $('#prep-feed-status').className = 'text-lg font-bold text-[#f59e0b]';
    $('#prep-feed-icon').className = 'material-symbols-outlined text-[#f59e0b]';
    $('#prep-feed-detail-container').className = 'flex items-center text-[#f59e0b] text-xs font-medium gap-1';
    $('#prep-feed-dot').className = 'w-2 h-2 rounded-full bg-[#f59e0b]';
  } else {
    $('#prep-feed-status').className = 'text-lg font-bold text-secondary';
    $('#prep-feed-icon').className = 'material-symbols-outlined text-secondary';
    $('#prep-feed-detail-container').className = 'flex items-center text-secondary text-xs font-medium gap-1';
    $('#prep-feed-dot').className = 'w-2 h-2 rounded-full bg-secondary';
  }

  // Input Compliance
  $('#prep-input-score').textContent = data.inputCompliance.score + '%';
  $('#prep-input-status').textContent = data.inputCompliance.status;

  const inputAdviceEl = $('#prep-input-advice');
  if (inputAdviceEl) {
    inputAdviceEl.textContent = data.inputCompliance.advice;
    inputAdviceEl.className = `text-[10px] mt-2 leading-tight font-medium ${data.inputCompliance.status !== 'Compliant' ? 'text-[#f59e0b]' : 'text-secondary'}`;
  }

  if (data.inputCompliance.status !== 'Compliant') {
    $('#prep-input-status-container').className = 'flex items-center text-[#f59e0b] text-xs font-medium gap-1';
    $('#prep-input-icon').textContent = 'warning';
  } else {
    $('#prep-input-status-container').className = 'flex items-center text-secondary text-xs font-medium gap-1';
    $('#prep-input-icon').textContent = 'check_circle';
  }

  // Tasks
  $('#prep-tasks-progress-text').textContent = `${data.tasksCompleted} / ${data.tasksTotal} completed`;
  $('#prep-tasks-progress-bar').style.width = (data.tasksCompleted / data.tasksTotal * 100) + '%';

  const tasksContainer = $('#prep-task-list');
  if (tasksContainer && data.tasks) {
    tasksContainer.innerHTML = '';
    data.tasks.forEach(t => {
      if (t.completed) {
        tasksContainer.innerHTML += `
          <li class="flex items-center gap-3">
            <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            <span class="text-on-surface text-sm font-medium flex-1">${t.name}</span>
            <span class="material-symbols-outlined text-secondary text-sm">check</span>
          </li>
        `;
      } else {
        tasksContainer.innerHTML += `
          <li class="flex items-center gap-3">
            <span class="w-1.5 h-1.5 rounded-full border border-outline-variant"></span>
            <span class="text-on-surface-variant text-sm flex-1">${t.name}</span>
          </li>
        `;
      }
    });
  }

  // Nutrition Chart
  if (data.nutrition) {
    const { protein, lipid, carbohydrate, other } = data.nutrition;
    if ($('#nutrition-protein-text')) $('#nutrition-protein-text').textContent = protein + '%';
    if ($('#nutrition-lipid-text')) $('#nutrition-lipid-text').textContent = lipid + '%';
    if ($('#nutrition-carb-text')) $('#nutrition-carb-text').textContent = carbohydrate + '%';
    if ($('#nutrition-other-text')) $('#nutrition-other-text').textContent = other + '%';

    const donut = $('#nutrition-donut-chart');
    if (donut) {
      const pEnd = protein;
      const lEnd = pEnd + lipid;
      const cEnd = lEnd + carbohydrate;

      donut.style.background = `conic-gradient(
        #005394 0% ${pEnd}%, 
        #38bdf8 ${pEnd}% ${lEnd}%, 
        #006d40 ${lEnd}% ${cEnd}%, 
        #e1e2e8 ${cEnd}% 100%
      )`;
    }
  }

  // Water Quality Baseline Table
  const baselineTbody = $('#prep-water-baseline-tbody');
  if (baselineTbody && data.baselineParameters) {
    baselineTbody.innerHTML = '';
    data.baselineParameters.forEach(param => {
      let statusClass = 'bg-secondary-container text-on-secondary-container';
      let icon = 'check_circle';
      if (param.status === 'Critical') {
        statusClass = 'bg-error text-white';
        icon = 'error';
      } else if (param.status === 'Warning') {
        statusClass = 'bg-[#fef08a] text-[#854d0e]';
        icon = 'warning';
      }

      baselineTbody.innerHTML += `
        <tr>
          <td class="py-2 text-on-surface">${param.name}</td>
          <td class="py-2 font-medium">${param.value}</td>
          <td class="py-2 text-right">
            <span class="inline-flex items-center gap-1 px-2 py-1 ${statusClass} rounded-full text-[10px] font-bold uppercase">
              <span class="material-symbols-outlined text-[12px]">${icon}</span>
              ${param.status}
            </span>
          </td>
        </tr>
      `;
    });
  }
}

function renderActiveHalalCompliance(data) {
  const container = $('#active-halal-compliance-list');
  if (!container) return;

  // 1. Water Quality Logic (Inherited from Preparation Data)
  const waterStatus = data.preparation.waterQuality.status; 
  let waterUI = { icon: 'check_circle', iconColor: 'text-secondary', badge: 'text-secondary bg-secondary-container/20', text: 'Compliant' };
  
  if (waterStatus === 'critical') {
    waterUI = { icon: 'error', iconColor: 'text-error', badge: 'text-error bg-error-container/20', text: 'Critical' };
  } else if (waterStatus === 'warning') {
    waterUI = { icon: 'warning', iconColor: 'text-[#d97706]', badge: 'text-[#854d0e] bg-[#fef08a]', text: 'Warning' };
  }

  // 2. Feed Management Logic
  const feedStatus = data.preparation.feedPlan.status;
  let feedUI = { icon: 'eco', iconColor: 'text-secondary', badge: 'text-secondary bg-secondary-container/20', text: 'Compliant' };
  if (feedStatus !== 'compliant') {
    feedUI = { icon: 'warning', iconColor: 'text-[#d97706]', badge: 'text-[#854d0e] bg-[#fef08a]', text: 'Review Needed' };
  }

  // 3. Treatment & Medication Logic (Based on active alerts)
  const hasRiskAlert = data.alerts.some(a => a.type === 'critical' || a.type === 'warning');
  let medUI = hasRiskAlert 
    ? { icon: 'warning', iconColor: 'text-[#d97706]', badge: 'text-[#854d0e] bg-[#fef08a]', text: 'Warning' }
    : { icon: 'check_circle', iconColor: 'text-secondary', badge: 'text-secondary bg-secondary-container/20', text: 'Compliant' };

  // 4. Biosecurity Logic (Linked to Halal Integrity Score)
  let bioUI = data.halal.integrityScore < 80
    ? { icon: 'warning', iconColor: 'text-error', badge: 'text-error bg-error-container/20', text: 'At Risk' }
    : { icon: 'shield', iconColor: 'text-secondary', badge: 'text-secondary bg-secondary-container/20', text: 'Compliant' };

  // 5. Render HTML
  container.innerHTML = `
    <div class="flex justify-between items-center border-b border-outline-variant/30 pb-2">
      <div class="flex items-center gap-2 text-on-surface">
        <span class="material-symbols-outlined ${waterUI.iconColor} text-sm">${waterUI.icon}</span>
        <span class="text-sm font-medium">Water Quality</span>
      </div>
      <span class="text-xs ${waterUI.badge} px-2 py-0.5 rounded font-semibold">${waterUI.text}</span>
    </div>
    <div class="flex justify-between items-center border-b border-outline-variant/30 pb-2">
      <div class="flex items-center gap-2 text-on-surface">
        <span class="material-symbols-outlined ${feedUI.iconColor} text-sm">${feedUI.icon}</span>
        <span class="text-sm font-medium">Feed Management</span>
      </div>
      <span class="text-xs ${feedUI.badge} px-2 py-0.5 rounded font-semibold">${feedUI.text}</span>
    </div>
    <div class="flex justify-between items-center border-b border-outline-variant/30 pb-2">
      <div class="flex items-center gap-2 text-on-surface">
        <span class="material-symbols-outlined ${medUI.iconColor} text-sm">medication</span>
        <span class="text-sm font-medium">Treatment & Medication</span>
      </div>
      <span class="text-xs ${medUI.badge} px-2 py-0.5 rounded font-semibold">${medUI.text}</span>
    </div>
    <div class="flex justify-between items-center">
      <div class="flex items-center gap-2 text-on-surface">
        <span class="material-symbols-outlined ${bioUI.iconColor} text-sm">${bioUI.icon}</span>
        <span class="text-sm font-medium">Biosecurity</span>
      </div>
      <span class="text-xs ${bioUI.badge} px-2 py-0.5 rounded font-semibold">${bioUI.text}</span>
    </div>
  `;
}

function renderExportDashboard(data) {
  const scoreEl = $('#export-score-text');
  const statusBadge = $('#export-status-badge');
  const checklistContainer = $('#export-checklist-container');
  const conclusionBadge = $('#export-conclusion-badge');

  if (!scoreEl || !checklistContainer) return;

  // 1. Cross-Phase Data Integration
  // Water Quality: Fail if status is 'critical'
  const isWaterStable = data.preparation.waterQuality.status !== 'critical';
  
  // Halal: Fail if score < 80
  const halalScore = data.halal.integrityScore;
  const isHalalPassed = halalScore >= 80;

  // Feed Plan: Fail if status is not 'compliant'
  const isFeedCompliant = data.preparation.feedPlan.status === 'compliant';

  // 2. Dynamic Checklist Generation
  const checklist = [
    { label: "Water Quality Stable", passed: isWaterStable, failMsg: "Critical Params!" },
    { label: "Withdrawal Period Complete", passed: true, failMsg: "" },
    { label: "No Antibiotic Residue", passed: true, failMsg: "" },
    { label: "Feed Compliance Verified", passed: isFeedCompliant, failMsg: "Review Needed" },
    { label: "Disease Free", passed: true, failMsg: "" },
    { label: "Traceability Complete", passed: true, failMsg: "" },
    { label: `Halal Integrity Score > 80 <div class="text-[10px] opacity-70 font-normal leading-tight">(Current: ${halalScore})</div>`, passed: isHalalPassed, failMsg: "Score Too Low" }
  ];

  // 3. Readiness Score Calculation
  let totalScore = 100;
  let failedCount = 0;

  checklist.forEach(item => {
    if (!item.passed) {
      failedCount++;
      if (item.label.includes('Water')) totalScore -= 25;
      else if (item.label.includes('Halal')) totalScore -= 15;
      else totalScore -= 10;
    }
  });

  totalScore = Math.max(0, totalScore);

  // 4. UI State & Theme Determination
  let statusColor, statusText, badgeClasses;
  
  if (failedCount === 0) {
    statusColor = 'text-secondary';
    statusText = 'READY';
    badgeClasses = 'bg-secondary-container/20 text-secondary';
  } else if (failedCount <= 2 && isWaterStable) {
    statusColor = 'text-[#d97706]'; // Orange/Warning
    statusText = 'WARNING';
    badgeClasses = 'bg-[#fef08a] text-[#854d0e]';
  } else {
    statusColor = 'text-error';
    statusText = 'NOT READY';
    badgeClasses = 'bg-error-container text-error';
  }

  // 5. DOM Updates
  scoreEl.innerText = totalScore;
  scoreEl.className = `text-2xl font-bold ${statusColor}`;
  
  statusBadge.className = `text-[10px] font-semibold w-fit px-2 py-0.5 rounded uppercase ${badgeClasses}`;
  statusBadge.innerText = statusText;

  conclusionBadge.className = `text-label-sm font-label-sm px-3 py-1.5 rounded-full font-bold uppercase ${badgeClasses}`;
  conclusionBadge.innerText = statusText === 'READY' ? 'EXPORT READY' : 'ACTION REQUIRED';

  // 6. Checklist Rendering
  checklistContainer.innerHTML = checklist.map(item => {
    if (item.passed) {
      return `
        <li class="flex items-start justify-between">
          <div class="flex items-start gap-2 text-body-md font-body-md">
            <span class="material-symbols-outlined text-secondary text-sm mt-0.5">check</span>
            <div class="flex-1">${item.label}</div>
          </div>
          <span class="text-label-sm font-label-sm text-secondary bg-secondary-container/20 px-2 py-1 rounded shrink-0">Passed</span>
        </li>`;
    } else {
      return `
        <li class="flex items-start justify-between">
          <div class="flex items-start gap-2 text-body-md font-body-md text-on-surface-variant">
            <span class="material-symbols-outlined text-error text-sm mt-0.5">close</span>
            <div class="flex-1">${item.label}</div>
          </div>
          <span class="text-label-sm font-label-sm text-error bg-error-container/20 px-2 py-1 rounded font-semibold shrink-0">${item.failMsg}</span>
        </li>`;
    }
  }).join('');
}

// Init
loadWeather();
loadDevices();
updateAIFarmingAdvisor();

if (typeof mockData !== 'undefined' && mockData.dynamic) {
  renderHalalDashboard(mockData.dynamic.halal);
  renderHalalRiskMap(mockData.dynamic.halal.riskMap);
  renderNotifications(mockData.dynamic.alerts);
  renderPreparationDashboard(mockData.dynamic.preparation);
  renderExportDashboard(mockData.dynamic);
  renderActiveHalalCompliance(mockData.dynamic);
}

// Render QR code after small delay to ensure DOM is ready
setTimeout(generateTraceabilityQR, 500);
