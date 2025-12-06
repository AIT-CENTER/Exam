"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { TrendingUp } from "lucide-react"
import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

const enrollmentData = [
  { month: "JAN", value: 1180 },
  { month: "FEB", value: 1195 },
  { month: "MAR", value: 1210 },
  { month: "APR", value: 1225 },
  { month: "MAY", value: 1238 },
  { month: "JUN", value: 1247 },
  { month: "JUL", value: 1250 },
  { month: "AUG", value: 1255 },
  { month: "SEP", value: 1260 },
  { month: "OCT", value: 1265 },
  { month: "NOV", value: 1270 },
  { month: "DEC", value: 1275 },
]

const chartConfig = {
  value: {
    label: "Students",
    color: "#2f2e2d",
  },
} satisfies ChartConfig

// Custom Tooltip
interface TooltipProps {
  active?: boolean
  payload?: Array<{
    dataKey: string
    value: number
    color: string
  }>
  label?: string
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <>
        <div className="rounded-lg bg-[#2f2e2d] text-white p-3 shadow-lg">
          <div className="text-xs font-medium mb-1">Total Students:</div>
          <div className="text-sm font-semibold">{payload[0].value.toLocaleString()}</div>
        </div>
      </>
    )
  }
  return null
}

// Period configuration
const PERIODS = {
  "6m": {
    key: "6m",
    label: "6 months",
    dateRange: "Jul 01 - Dec 31, 2024",
  },
  "12m": {
    key: "12m",
    label: "12 months",
    dateRange: "Jan 01 - Dec 31, 2024",
  },
  "2y": {
    key: "2y",
    label: "2 years",
    dateRange: "Jan 01, 2023 - Dec 31, 2024",
  },
} as const

type PeriodKey = keyof typeof PERIODS

export default function LineChart2() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("12m")

  // Filter data based on selected period
  const getFilteredData = () => {
    switch (selectedPeriod) {
      case "6m":
        return enrollmentData.slice(-6)
      case "12m":
        return enrollmentData
      case "2y":
        // Simulate 2 years data by duplicating and modifying the current year
        const previousYear = enrollmentData.map((item) => ({
          month: `${item.month} '23`,
          value: Math.round(item.value * 0.85), // 15% lower for previous year
        }))
        const currentYear = enrollmentData.map((item) => ({
          month: `${item.month} '24`,
          value: item.value,
        }))
        return [...previousYear, ...currentYear]
      default:
        return enrollmentData
    }
  }

  const filteredData = getFilteredData()

  // Get current period configuration
  const currentPeriod = PERIODS[selectedPeriod]

  // Calculate total and percentage based on filtered data
  const totalStudents = filteredData.reduce((sum, item) => sum + item.value, 0)
  const lastValue = filteredData[filteredData.length - 1]?.value || 0
  const previousValue = filteredData[filteredData.length - 2]?.value || 0
  const percentageChange = previousValue > 0 ? ((lastValue - previousValue) / previousValue) * 100 : 0

  return (
    <Card className="w-full shadow-sm border-border bg-card">
      <CardHeader className="border-0 min-h-auto pt-6 pb-4">
        <CardTitle className="text-lg font-semibold text-[#252525]">Student Enrollment Trends</CardTitle>
        <CardToolbar>
          <Select value={selectedPeriod} onValueChange={(value) => setSelectedPeriod(value as PeriodKey)}>
            <SelectTrigger>{currentPeriod.label}</SelectTrigger>
            <SelectContent align="end">
              {Object.values(PERIODS).map((period) => (
                <SelectItem key={period.key} value={period.key}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardToolbar>
      </CardHeader>

      <CardContent className="px-0">
        {/* Stats Section */}
        <div className="px-5 mb-8">
          <div className="text-xs font-medium text-[#6d6c6b] tracking-wide mb-2">{currentPeriod.dateRange}</div>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl font-bold text-[#252525]">{lastValue.toLocaleString()}</div>
            <Badge className="bg-green-100 text-green-700">
              <TrendingUp className="size-3" />
              {Math.abs(percentageChange).toFixed(2)}%
            </Badge>
          </div>
        </div>

        {/* Chart */}
        <div className="relative">
          <ChartContainer
            config={chartConfig}
            className="h-[300px] w-full ps-1.5 pe-2.5 overflow-visible [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
          >
            <ComposedChart
              data={filteredData}
              margin={{
                top: 25,
                right: 25,
                left: 0,
                bottom: 25,
              }}
              style={{ overflow: "visible" }}
            >
              {/* Gradient */}
              <defs>
                <linearGradient id="enrollmentGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartConfig.value.color} stopOpacity={0.15} />
                  <stop offset="100%" stopColor={chartConfig.value.color} stopOpacity={0} />
                </linearGradient>
                <filter id="dotShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
                </filter>
              </defs>

              <CartesianGrid
                strokeDasharray="4 12"
                stroke="#ebebea"
                strokeOpacity={1}
                horizontal={true}
                vertical={false}
              />

              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6d6c6b" }}
                tickMargin={12}
                dy={10}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6d6c6b" }}
                tickFormatter={(value) => `${value}`}
                domain={["dataMin - 10", "dataMax + 10"]}
                tickCount={6}
                tickMargin={12}
              />

              <ChartTooltip
                content={<CustomTooltip />}
                cursor={{
                  stroke: chartConfig.value.color,
                  strokeWidth: 1,
                  strokeDasharray: "none",
                }}
              />

              {/* Gradient area */}
              <Area
                type="linear"
                dataKey="value"
                stroke="transparent"
                fill="url(#enrollmentGradient)"
                strokeWidth={0}
                dot={false}
              />

              {/* Main enrollment line */}
              <Line
                type="linear"
                dataKey="value"
                stroke={chartConfig.value.color}
                strokeWidth={3}
                dot={(props) => {
                  const { cx, cy, payload } = props
                  if (payload.month === "JUN" || payload.month === "NOV") {
                    return (
                      <circle
                        key={`dot-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={chartConfig.value.color}
                        stroke="white"
                        strokeWidth={2}
                        filter="url(#dotShadow)"
                      />
                    )
                  }
                  return <g key={`dot-${cx}-${cy}`} /> // Return empty group for other points
                }}
                activeDot={{
                  r: 6,
                  fill: chartConfig.value.color,
                  stroke: "white",
                  strokeWidth: 2,
                  filter: "url(#dotShadow)",
                }}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
