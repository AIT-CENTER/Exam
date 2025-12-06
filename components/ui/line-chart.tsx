"use client"

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface LineChartProps {
  data: any[]
  dataKey: string
  xAxisKey: string
  title?: string
  className?: string
  color?: string
  strokeWidth?: number
}

export function LineChart({
  data,
  dataKey,
  xAxisKey,
  title,
  className,
  color = "#2f2e2d",
  strokeWidth = 2,
}: LineChartProps) {
  return (
    <Card className={cn("w-full", className)}>
      {title && (
        <CardHeader>
          <CardTitle className="text-lg text-[#252525]">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ebebea" />
              <XAxis dataKey={xAxisKey} stroke="#6d6c6b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#6d6c6b" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fcfcfc",
                  border: "1px solid #ebebea",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={strokeWidth}
                dot={{ fill: color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
