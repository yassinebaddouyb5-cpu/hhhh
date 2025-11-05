
import React from 'react';
import type { ProgressPoint } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProgressChartProps {
  data: ProgressPoint[];
  theme: 'light' | 'dark';
}

export const ProgressChart: React.FC<ProgressChartProps> = ({ data, theme }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#a0aec0' : '#4a5568';
  const gridColor = isDark ? '#4a5568' : '#e2e8f0';
  const tooltipBg = isDark ? '#1a202c' : '#ffffff';
  const tooltipBorder = isDark ? '#4a5568' : '#e2e8f0';
  const tooltipText = isDark ? '#e2e8f0' : '#1a202c';
  const lineColor = isDark ? '#f6e05e' : '#d97706';

  return (
    <div className="w-full h-full p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-center mb-4 text-yellow-600 dark:text-yellow-400">Your Journey to Cynicism</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 20,
            left: -10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" stroke={textColor} />
          <YAxis domain={[1, 10]} stroke={textColor} label={{ value: 'Cynicism Score', angle: -90, position: 'insideLeft', fill: textColor }} />
          <Tooltip 
            contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}` }}
            labelStyle={{ color: tooltipText }}
          />
          <Legend wrapperStyle={{ color: textColor }}/>
          <Line type="monotone" dataKey="score" stroke={lineColor} activeDot={{ r: 8 }} name="Cynicism Level"/>
        </LineChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-2 px-8">
        <span>1: Delusional Optimism</span>
        <span>10: Bulletproof Cynic</span>
      </div>
    </div>
  );
};