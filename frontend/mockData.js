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
