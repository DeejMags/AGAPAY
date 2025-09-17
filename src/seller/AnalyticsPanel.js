import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart, BarElement, CategoryScale, LinearScale } from 'chart.js';
Chart.register(BarElement, CategoryScale, LinearScale);

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    {
      label: 'Revenue',
      data: [500, 800, 1200, 900, 1500, 1800],
      backgroundColor: 'rgba(16, 185, 129, 0.7)',
    },
    {
      label: 'Items Sold',
      data: [5, 8, 12, 9, 15, 18],
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
    },
    {
      label: 'Views',
      data: [200, 400, 600, 500, 700, 900],
      backgroundColor: 'rgba(234, 179, 8, 0.7)',
    },
  ],
};

const options = {
  responsive: true,
  plugins: { legend: { position: 'top' } },
};

export default function AnalyticsPanel() {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">Analytics</h3>
      <Bar data={data} options={options} />
    </div>
  );
}
