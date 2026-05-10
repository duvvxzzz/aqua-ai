const mockData = {
  traceability: {
    batchId: "EXP-203",
    species: "Penaeus monodon (Black Tiger)",
    harvestDate: "Oct 24, 2023",
    quantity: "4,800 kg",
    halalIntegrityScore: 92,
    destination: "UAE (GCC)",
    blockchain: {
      network: "Ethereum",
      txHash: "0x8f2a...3b9c",
      timestamp: "2023-10-25T08:30:00Z"
    },
    lifecycle: [
      {
        stage: "Pond Preparation",
        date: "Aug 01, 2023",
        status: "Completed",
        details: ["Drying & Liming completed", "Water quality tested (pH 7.8)"]
      },
      {
        stage: "Seed Stocking",
        date: "Aug 15, 2023",
        status: "Completed",
        details: ["Source: AquaGen Hatchery", "Density: 80 PL/m2"]
      },
      {
        stage: "Grow-out Phase",
        date: "Ongoing",
        status: "In Progress",
        details: ["FCR: 1.2", "Survival Rate: 92%", "No antibiotics detected"]
      }
    ]
  }
};

// Generate dynamic data for the system
mockData.generateDynamicSystemData = function () {
  // Random Halal Integrity Score (80-100)
  const integrityScore = Math.floor(Math.random() * 21) + 80;

  // Random Ponds Compliant (out of 10)
  const pondsCompliant = Math.floor(Math.random() * 4) + 7; // 7 to 10

  // Random Active Risks
  const activeRisks = Math.floor(Math.random() * 4); // 0 to 3

  // Halal Certificate Health
  const certHealth = Math.floor(Math.random() * 4) + 6; // 6 to 9
  const daysToExpire = Math.floor(Math.random() * 60) + 10;

  // Generate 10 ponds for the Risk Map
  const riskMap = [];
  const statuses = ['compliant', 'warning', 'critical', 'offline'];
  for (let i = 1; i <= 10; i++) {
    // Weight the probability so 'compliant' is most common
    let status;
    const rand = Math.random();
    if (rand < 0.7) status = 'compliant';
    else if (rand < 0.85) status = 'warning';
    else if (rand < 0.95) status = 'critical';
    else status = 'offline';

    riskMap.push({ id: String(i).padStart(2, '0'), status });
  }

  // Generate random alerts
  const possibleAlerts = [
    { type: 'critical', title: 'Aerator Power Alert', desc: 'Sudden voltage drop detected at the main aerator. System has automatically engaged backup battery.', time: '5 mins ago', icon: 'warning' },
    { type: 'warning', title: 'pH Minor Deviation', desc: 'Slight pH fluctuation detected following recent rainfall. AI is actively monitoring the trend.', time: '15 mins ago', icon: 'science' },
    { type: 'critical', title: 'Ammonia Spike', desc: 'Ammonia levels exceeded safe threshold in Pond 03. Immediate water exchange recommended.', time: '1 hour ago', icon: 'water_drop' },
    { type: 'info', title: 'Halal Certificate Expiring', desc: `Halal certification is due for renewal in ${daysToExpire} days.`, time: '2 hours ago', icon: 'verified' },
    { type: 'warning', title: 'Temperature Drop', desc: 'Water temperature dropped below optimal range. Consider reducing feeding.', time: '3 hours ago', icon: 'thermostat' }
  ];

  // Pick 2-4 random alerts
  const numAlerts = Math.floor(Math.random() * 3) + 2;
  const shuffledAlerts = possibleAlerts.sort(() => 0.5 - Math.random());
  const alerts = shuffledAlerts.slice(0, numAlerts);

  // Generate Preparation Data
  const prepReadinessScore = Math.floor(Math.random() * 41) + 60; // 60 to 100
  let prepReadinessStatus = 'Good';
  if (prepReadinessScore < 75) prepReadinessStatus = 'Warning';
  if (prepReadinessScore < 65) prepReadinessStatus = 'Critical';

  const waterQualities = [
    { label: 'Good', detail: 'Stable', status: 'compliant' },
    { label: 'Warning', detail: 'Fluctuating', status: 'warning' },
    { label: 'Poor', detail: 'Low pH', status: 'critical' },
    { label: 'Good', detail: 'Optimal', status: 'compliant' },
  ];
  const waterQuality = waterQualities[Math.floor(Math.random() * waterQualities.length)];

  const feedPlans = [
    { label: 'Verified', detail: 'Approved', status: 'compliant' },
    { label: 'Pending', detail: 'Review Needed', status: 'warning' }
  ];
  const feedPlan = feedPlans[Math.floor(Math.random() * feedPlans.length)];

  const inputComplianceScore = Math.floor(Math.random() * 21) + 80; // 80 to 100
  let inputComplianceStatus = 'Compliant';
  if (inputComplianceScore < 90) inputComplianceStatus = 'Action Needed';

  const possibleTasks = [
    'Vệ sinh ao', 'Kiểm tra nguồn nước', 'Xử lý đáy ao', 'Kiểm tra thức ăn & đầu vào',
    'Kiểm tra hệ thống sục khí', 'Diệt khuẩn', 'Lắp đặt lưới che'
  ];
  
  // Randomly select 5 tasks and assign them random status (true = completed, false = pending)
  const shuffledTasks = possibleTasks.sort(() => 0.5 - Math.random()).slice(0, 5);
  const tasks = shuffledTasks.map(taskName => ({
    name: taskName,
    completed: Math.random() > 0.3 // 70% chance of being completed
  }));

  const completedTasksCount = tasks.filter(t => t.completed).length;

  return {
    halal: {
      integrityScore,
      pondsCompliant,
      activeRisks,
      certHealth,
      daysToExpire,
      riskMap
    },
    preparation: {
      readiness: { score: prepReadinessScore, status: prepReadinessStatus },
      waterQuality: waterQuality,
      feedPlan: feedPlan,
      inputCompliance: { score: inputComplianceScore, status: inputComplianceStatus },
      tasks: tasks,
      tasksCompleted: completedTasksCount,
      tasksTotal: tasks.length
    },
    alerts
  };
};

// Initialize with a random state
mockData.dynamic = mockData.generateDynamicSystemData();
