"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  PieChart,
  Pie,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Types corresponding to your real DB response
type RangeKey = "week" | "month" | "year";

type AnalyticsResponse = {
  range: RangeKey;
  from: string;
  to: string;
  passThresholdPct: number;
  summary: {
    totalSubmissions: number;
    successCount: number;
    failureCount: number;
    successRatePct: number;
    failureRatePct: number;
    avgScorePct: number;
  };
  series: Array<{
    key: string;
    label: string;
    submissions: number;
    successRatePct: number;
    avgScorePct: number;
    riskEvents: number;
    avgRiskCount: number;
  }>;
  riskByType: Array<{ event_type: string; count: number }>;
};

// SHADCN CHART CONFIGS
const donutConfig = {
  value: { label: "Count" },
  Success: { label: "Success", color: "#93c5fd" },
  Failure: { label: "Failure", color: "#2563eb" },
} satisfies ChartConfig;

const barConfig = {
  submissions: { label: "Submissions", color: "#3b82f6" },
} satisfies ChartConfig;

const radarConfig = {
  count: { label: "Events", color: "#2563eb" },
} satisfies ChartConfig;

function DashboardSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[200px] w-full bg-transparent">
      <style>{`
        .spinner-svg {
          animation: spinner-rotate 2s linear infinite;
        }
        .spinner-circle {
          stroke-dasharray: 1, 200;
          stroke-dashoffset: 0;
          animation: spinner-stretch 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }
        @keyframes spinner-rotate {
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes spinner-stretch {
          0% {
            stroke-dasharray: 1, 200;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -35px;
          }
          100% {
            stroke-dasharray: 90, 200;
            stroke-dashoffset: -124px;
          }
        }
      `}</style>

      <svg
        className="h-10 w-10 text-zinc-800 dark:text-zinc-200 spinner-svg"
        viewBox="25 25 50 50"
      >
        <circle
          className="spinner-circle"
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

// Custom Cursor to ensure the gray hover background perfectly wraps the narrow bar width
const CustomCursor = (props: any) => {
  const { x, y, width, height, payload } = props;
  
  // Hide the cursor background if hovering over an empty padding slot
  if (payload && payload[0]?.payload?.isEmpty) return null;

  // Calculate matching exact bar width (matches maxBarSize={16})
  const actualBarWidth = Math.min(16, width);
  const centeredX = x + (width - actualBarWidth) / 2;

  return (
    <rect
      x={centeredX}
      y={y}
      width={actualBarWidth}
      height={height}
      fill="hsl(var(--muted))"
      opacity={0.5}
      rx={4} // Softly rounds the gray hover rectangle
    />
  );
};

export default function AnalyticsClient() {
  const [range, setRange] = useState<RangeKey>("month");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load analytics");
      setData(json as AnalyticsResponse);
      setLoading(false);
    } catch (e) {
      console.error("[analytics]", e);
      setLoading(false);
      toast.error("Failed to load analytics");
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // SMART FORMATTER: Converts number/dates to Month Words ("Jan 13", "Mar", etc)
  const formatXAxisTick = (tickItem: any) => {
    if (!tickItem) return "";
    const str = String(tickItem);
    const months =["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Detect format YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      return `${months[m - 1]} ${d}`;
    }

    // Detect format YYYY-MM
    const ymMatch = str.match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      const m = parseInt(ymMatch[2], 10);
      return months[m - 1];
    }

    // If we are strictly in "year" mode, convert numbers 1-12 to Jan-Dec
    if (range === "year" && /^0?[1-9]$|^1[0-2]$/.test(str)) {
      return months[parseInt(str, 10) - 1];
    }

    // Attempt standard JS Date fallback if it contains slashes/dashes
    if (str.includes('-') || str.includes('/')) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return range === "year" ? months[d.getMonth()] : `${months[d.getMonth()]} ${d.getDate()}`;
      }
    }

    return str; // Fallback string return
  };

  // Data mapping for Shadcn Pie Chart
  const donutData = useMemo(() => {
    if (!data) return [];
    return[
      {
        name: "Success",
        value: data.summary.successCount,
        fill: "var(--color-Success)",
      },
      {
        name: "Failure",
        value: data.summary.failureCount,
        fill: "var(--color-Failure)",
      },
    ];
  }, [data]);

  // Data mapping for Shadcn Bar Chart
  // PADDING LOGIC: Invisibly pads the chart data so that 1 or 2 entries
  // naturally start on the far left rather than awkwardly floating in the center.
  const displayBarData = useMemo(() => {
    const series = data?.series ?? [];
    if (!series.length) return[];
    
    const expectedLengths: Record<RangeKey, number> = {
      week: 7,
      month: 30,
      year: 12,
    };
    
    const MIN_BARS = expectedLengths[range] || 10;
    const padded = [...series];
    
    while (padded.length < MIN_BARS) {
      padded.push({
        key: `empty-${padded.length}`,
        label: "", // Invisible label
        submissions: 0,
        successRatePct: 0,
        avgScorePct: 0,
        riskEvents: 0,
        avgRiskCount: 0,
        isEmpty: true, // Marker flag so tooltip ignores this completely
      });
    }
    return padded;
  },[data, range]);

  // Data mapping for Shadcn Radar Chart
  const radarData = useMemo(
    () =>
      (data?.riskByType ??[]).map((r) => ({
        label: r.event_type,
        count: r.count,
      })),
    [data]
  );

  // Custom tick for Radar Chart to match the exact "stacked label" look
  const CustomRadarTick = ({ x, y, payload }: any) => {
    const dataItem = radarData.find((d) => d.label === payload.value);
    if (!dataItem) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={-5}
          dy={0}
          textAnchor="middle"
          fill="currentColor"
          className="text-sm font-bold text-foreground"
        >
          {dataItem.count}
        </text>
        <text
          x={0}
          y={12}
          dy={0}
          textAnchor="middle"
          fill="currentColor"
          className="text-xs text-muted-foreground"
        >
          {payload.value}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
          <TabsList>
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="year">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={fetchAnalytics}>
          Refresh
        </Button>
      </div>

      {loading && !data ? (
        <DashboardSpinner />
      ) : !data ? (
        <p className="text-muted-foreground">No analytics data available.</p>
      ) : (
        <>
          {/* TOP SUMMARY CARDS */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total submissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {data.summary.totalSubmissions}
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Success rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">
                  {data.summary.successRatePct}%
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Failure rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {data.summary.failureRatePct}%
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{data.summary.avgScorePct}%</p>
              </CardContent>
            </Card>
          </div>

          {/* MAIN CHARTS LAYOUT */}
          <div className="grid gap-4 lg:grid-cols-2">
            
            {/* SHADCN BAR CHART (Full Width Row) */}
            <Card className="shadow-sm lg:col-span-2 flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Submissions over time</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 mt-4">
                <ChartContainer config={barConfig} className="w-full h-[250px]">
                  <BarChart
                    key={range}
                    data={displayBarData}
                    margin={{ top: 10, right: 10, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="label"
                      tickFormatter={formatXAxisTick} // Formats the bottom axis labels
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      minTickGap={12} // Reduced gap so monthly days don't get hidden
                      className="text-xs text-muted-foreground"
                    />
                    {/* RESTORED SHADCN TOOLTIP + CUSTOM CURSOR */}
                    <ChartTooltip 
                      cursor={<CustomCursor />} 
                      content={(props) => {
                        // Prevent the tooltip box from showing if hovering over an empty padding slot
                        if (!props.payload?.length || props.payload[0]?.payload?.isEmpty) {
                          return null;
                        }
                        return (
                          <ChartTooltipContent 
                            {...props} 
                            labelFormatter={(lbl) => formatXAxisTick(lbl)} // Formats the text inside tooltip header
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="submissions"
                      fill="var(--color-submissions)"
                      radius={[6, 6, 0, 0]} // Heavily rounded tops
                      maxBarSize={16}       // Fixed skinny bar width
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* SHADCN DONUT CHART (Half Width Row) */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader className="pb-0 text-center">
                <CardTitle className="text-base">Success vs Failure</CardTitle>
                <CardDescription>
                  Current {range} overview
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-0">
                <ChartContainer
                  config={donutConfig}
                  className="mx-auto aspect-square max-h-[280px]"
                >
                  <PieChart>
                    <ChartTooltip 
                      cursor={false} 
                      content={<ChartTooltipContent hideLabel />} 
                    />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={65}
                      outerRadius={100}
                      strokeWidth={0}
                    />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* SHADCN RADAR CHART (Half Width Row) */}
            <Card className="shadow-sm flex flex-col">
              <CardHeader className="items-center pb-4 text-center">
                <CardTitle className="text-base">Risk by event type</CardTitle>
                <CardDescription>
                  Showing risk volume for the selected period
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 pb-0">
                <ChartContainer
                  config={radarConfig}
                  className="mx-auto aspect-square max-h-[300px]"
                >
                  <RadarChart data={radarData}>
                    <ChartTooltip 
                      cursor={false} 
                      content={<ChartTooltipContent />} 
                    />
                    <PolarGrid className="fill-muted opacity-20" />
                    <PolarAngleAxis
                      dataKey="label"
                      tick={<CustomRadarTick />}
                    />
                    <Radar
                      dataKey="count"
                      fill="var(--color-count)"
                      fillOpacity={0.6}
                      stroke="var(--color-count)"
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ChartContainer>
              </CardContent>
            </Card>

          </div>
        </>
      )}
    </div>
  );
}