'use client'

import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/data'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/app-context'
import { getBudgetStatus, getWeeklySpending, getMonthlyTransactionCount, getCumulativeTrendData, getCurrentMonthLabel, getTransactionNetExpense } from '@/lib/calculations'

import Link from 'next/link'

const periods = ['1W', '1M', '3M', 'YTD', '1Y', 'ALL']

export function SpendingChart({ selectedMonth, selectedYear }: { selectedMonth?: number; selectedYear?: number }) {
  const { state, isHydrated } = useApp()
  const [activePeriod, setActivePeriod] = useState('1M')
  
  const now = new Date()
  const m = selectedMonth ?? now.getMonth()
  const y = selectedYear ?? now.getFullYear()

  const currentMonthLabel = new Date(y, m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  
  // Base stats for the current selected month context
  const { spent, baseSpent, extraSpent, budget, extraPoolBalance, remaining, percentUsed } = getBudgetStatus(state.transactions, state.accounts, y, m)
  const chartData = getCumulativeTrendData(state.transactions, y, m)

  if (!isHydrated) return null

  // 1. Calculate stats and trend data based on activePeriod dynamically
  let currentChartData: { name: string; amount: number; rawVal: number }[] = []
  let chartTicks: number[] = []
  let formatChartTick = (val: any) => String(val)
  let periodSpent = spent
  let periodExtraSpent = extraSpent
  let periodExtraPool = extraPoolBalance

  if (activePeriod === '1W') {
    // Current Week (Monday to Sunday of the current system week - always show all 7 days)
    const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const currentDay = now.getDay()
    const daysToMonday = currentDay === 0 ? 6 : currentDay - 1
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday)
    monday.setHours(0, 0, 0, 0)

    const weekExpenses = state.transactions.filter(t => {
      if (t.type !== 'expense') return false
      const d = new Date(t.date + 'T00:00:00')
      const nextSunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000)
      return d >= monday && d < nextSunday
    })

    // Calculate totals for this week (only transactions up to today)
    periodSpent = weekExpenses.filter(t => new Date(t.date + 'T00:00:00') <= now).reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    periodExtraSpent = weekExpenses.filter(t => t.fundingSource === 'extra' && new Date(t.date + 'T00:00:00') <= now).reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    
    const weekExtraInflow = state.transactions
      .filter(t => t.type === 'extra_allowance' && new Date(t.date + 'T00:00:00') >= monday && new Date(t.date + 'T00:00:00') <= now)
      .reduce((sum, t) => sum + t.amount, 0)
    periodExtraPool = Math.max(0, weekExtraInflow - periodExtraSpent)

    // Build cumulative weekly array for all 7 days
    const todayIndex = currentDay === 0 ? 6 : currentDay - 1
    let cumulative = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000)
      const dStr = d.toISOString().split('T')[0]
      
      if (i <= todayIndex) {
        const dayAmount = weekExpenses
          .filter(t => t.date === dStr)
          .reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
        cumulative += dayAmount
        currentChartData.push({
          name: weekdayNames[i],
          amount: cumulative,
          rawVal: i
        })
      } else {
        // Future day: include name for layout but omit amount so the line ends
        currentChartData.push({
          name: weekdayNames[i],
          rawVal: i
        } as any)
      }
    }

    chartTicks = [0, 1, 2, 3, 4, 5, 6]
    formatChartTick = (val: number) => weekdayNames[val] || ''
  } 
  else if (activePeriod === '1M') {
    // 1 Month (current selected month - show all calendar days in the month)
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const shortMonth = new Date(y, m).toLocaleDateString('en-IN', { month: 'short' })
    
    let cumulative = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const isFuture = (y === now.getFullYear() && m === now.getMonth() && d > now.getDate())
      
      if (!isFuture) {
        // Find existing amount up to day d
        const existing = chartData.find(pt => pt.day === d)
        if (existing) {
          cumulative = existing.amount
        }
        currentChartData.push({
          name: `${d}`,
          amount: cumulative,
          rawVal: d
        })
      } else {
        // Future day: include in XAxis layout but omit amount so line ends at today
        currentChartData.push({
          name: `${d}`,
          rawVal: d
        } as any)
      }
    }

    chartTicks = [1]
    if (daysInMonth >= 8) chartTicks.push(8)
    if (daysInMonth >= 15) chartTicks.push(15)
    if (daysInMonth >= 22) chartTicks.push(22)
    if (daysInMonth >= 29) chartTicks.push(29)
    if (daysInMonth > 1 && !chartTicks.includes(daysInMonth) && daysInMonth - (chartTicks[chartTicks.length - 1] || 0) > 2) {
      chartTicks.push(daysInMonth)
    }

    formatChartTick = (dayNum: number) => {
      if (dayNum === 1) return `1 ${shortMonth}`
      return `${dayNum}`
    }

    periodSpent = spent
    periodExtraSpent = extraSpent
    periodExtraPool = extraPoolBalance
  } 
  else if (activePeriod === '3M') {
    // 3 Months (ending in the selected month - show the entire range)
    const startDate = new Date(y, m - 2, 1)
    const endDate = new Date(y, m + 1, 0, 23, 59, 59, 999)

    const rangeExpenses = state.transactions.filter(t => {
      if (t.type !== 'expense') return false
      const d = new Date(t.date + 'T00:00:00')
      return d >= startDate && d <= endDate
    })

    // Stats represent transactions up to now in the range
    periodSpent = rangeExpenses.filter(t => new Date(t.date + 'T00:00:00') <= now).reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    periodExtraSpent = rangeExpenses.filter(t => t.fundingSource === 'extra' && new Date(t.date + 'T00:00:00') <= now).reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    
    const rangeExtraInflow = state.transactions
      .filter(t => t.type === 'extra_allowance' && new Date(t.date + 'T00:00:00') >= startDate && new Date(t.date + 'T00:00:00') <= now)
      .reduce((sum, t) => sum + t.amount, 0)
    periodExtraPool = Math.max(0, rangeExtraInflow - periodExtraSpent)

    const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
    let cumulative = 0
    const tickIndices: number[] = []
    const tickLabels: Record<number, string> = {}

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dStr = d.toISOString().split('T')[0]
      const isFuture = d > now

      if (!isFuture) {
        const dayAmount = rangeExpenses
          .filter(t => t.date === dStr)
          .reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
        cumulative += dayAmount

        currentChartData.push({
          name: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          amount: cumulative,
          rawVal: i
        })
      } else {
        // Future day: omit amount
        currentChartData.push({
          name: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          rawVal: i
        } as any)
      }

      // Mark the 1st of each month as a tick mark
      if (d.getDate() === 1) {
        tickIndices.push(i)
        tickLabels[i] = d.toLocaleDateString('en-IN', { month: 'short' })
      }
    }

    chartTicks = tickIndices
    formatChartTick = (val: number) => tickLabels[val] || ''
  } 
  else if (activePeriod === 'YTD') {
    // Year to Date (Jan 1st of selected year to end of selected month, grouped by month)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let cumulative = 0

    const ytdExpenses = state.transactions.filter(t => {
      if (t.type !== 'expense') return false
      const d = new Date(t.date + 'T00:00:00')
      return d.getFullYear() === y && d.getMonth() <= m
    })

    periodSpent = ytdExpenses.reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    periodExtraSpent = ytdExpenses.filter(t => t.fundingSource === 'extra').reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    const ytdExtraInflow = state.transactions
      .filter(t => t.type === 'extra_allowance' && new Date(t.date + 'T00:00:00').getFullYear() === y && new Date(t.date + 'T00:00:00').getMonth() <= m)
      .reduce((sum, t) => sum + t.amount, 0)
    periodExtraPool = Math.max(0, ytdExtraInflow - periodExtraSpent)

    for (let monthIdx = 0; monthIdx <= m; monthIdx++) {
      const monthTx = ytdExpenses.filter(t => new Date(t.date + 'T00:00:00').getMonth() === monthIdx)
      cumulative += monthTx.reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
      currentChartData.push({
        name: monthNames[monthIdx],
        amount: cumulative,
        rawVal: monthIdx
      })
      chartTicks.push(monthIdx)
    }

    formatChartTick = (val: number) => monthNames[val] || ''
  } 
  else if (activePeriod === '1Y') {
    // Last 12 Months (ending in selected month, grouped by month)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let cumulative = 0

    const startDate = new Date(y, m - 11, 1)
    const endDate = new Date(y, m + 1, 0, 23, 59, 59, 999)

    const rangeExpenses = state.transactions.filter(t => {
      if (t.type !== 'expense') return false
      const d = new Date(t.date + 'T00:00:00')
      return d >= startDate && d <= endDate
    })

    periodSpent = rangeExpenses.reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    periodExtraSpent = rangeExpenses.filter(t => t.fundingSource === 'extra').reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    const rangeExtraInflow = state.transactions
      .filter(t => t.type === 'extra_allowance' && new Date(t.date + 'T00:00:00') >= startDate && new Date(t.date + 'T00:00:00') <= endDate)
      .reduce((sum, t) => sum + t.amount, 0)
    periodExtraPool = Math.max(0, rangeExtraInflow - periodExtraSpent)

    const tickLabels: Record<number, string> = {}

    for (let i = 0; i < 12; i++) {
      const d = new Date(y, m - 11 + i, 1)
      const curY = d.getFullYear()
      const curM = d.getMonth()

      const monthTx = rangeExpenses.filter(t => {
        const txD = new Date(t.date + 'T00:00:00')
        return txD.getFullYear() === curY && txD.getMonth() === curM
      })

      cumulative += monthTx.reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
      currentChartData.push({
        name: `${monthNames[curM]} ${curY}`,
        amount: cumulative,
        rawVal: i
      })

      if (i % 2 === 0) {
        chartTicks.push(i)
        tickLabels[i] = monthNames[curM]
      }
    }

    formatChartTick = (val: number) => tickLabels[val] || ''
  } 
  else if (activePeriod === 'ALL') {
    // All time (grouped by month)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let cumulative = 0

    let oldestDate = new Date(y, m, 1)
    if (state.transactions.length > 0) {
      const dates = state.transactions.map(t => new Date(t.date + 'T00:00:00').getTime())
      oldestDate = new Date(Math.min(...dates))
    }

    const startYear = oldestDate.getFullYear()
    const startMonth = oldestDate.getMonth()
    const totalMonths = (y - startYear) * 12 + (m - startMonth) + 1

    const allExpenses = state.transactions.filter(t => {
      if (t.type !== 'expense') return false
      const d = new Date(t.date + 'T00:00:00')
      return d <= new Date(y, m + 1, 0, 23, 59, 59, 999)
    })

    periodSpent = allExpenses.reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    periodExtraSpent = allExpenses.filter(t => t.fundingSource === 'extra').reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
    const allExtraInflow = state.transactions
      .filter(t => t.type === 'extra_allowance' && new Date(t.date + 'T00:00:00') <= new Date(y, m + 1, 0, 23, 59, 59, 999))
      .reduce((sum, t) => sum + t.amount, 0)
    periodExtraPool = Math.max(0, allExtraInflow - periodExtraSpent)

    const tickLabels: Record<number, string> = {}

    for (let i = 0; i < totalMonths; i++) {
      const d = new Date(startYear, startMonth + i, 1)
      const curY = d.getFullYear()
      const curM = d.getMonth()

      const monthTx = allExpenses.filter(t => {
        const txD = new Date(t.date + 'T00:00:00')
        return txD.getFullYear() === curY && txD.getMonth() === curM
      })

      cumulative += monthTx.reduce((sum, t) => sum + getTransactionNetExpense(t), 0)
      
      const labelStr = totalMonths <= 12 ? monthNames[curM] : `'${curY.toString().slice(-2)}`
      currentChartData.push({
        name: `${monthNames[curM]} ${curY}`,
        amount: cumulative,
        rawVal: i
      })

      const step = Math.max(1, Math.ceil(totalMonths / 6))
      if (i % step === 0) {
        chartTicks.push(i)
        tickLabels[i] = labelStr
      }
    }

    formatChartTick = (val: number) => tickLabels[val] || ''
  }

  return (
    <div className="bg-card rounded-2xl p-4 lg:p-6 border border-border dark:card-glow">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Spending Overview</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{currentMonthLabel}</p>
        </div>
        <Link href="/transactions" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          See more
        </Link>
      </div>

      <div className="mt-3 lg:mt-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl lg:text-3xl font-bold text-primary tabular-nums">{formatCurrency(baseSpent)}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          of {formatCurrency(budget)} base budget
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-3 lg:mt-4 mb-4 lg:mb-6">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">{percentUsed}% used</span>
          <span className="text-muted-foreground">{formatCurrency(remaining)} remaining</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>

      {/* Quick stats - responsive grid */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4 mb-4 lg:mb-6">
        <div className="min-w-0">
          <p className="text-[10px] lg:text-[11px] text-muted-foreground font-medium truncate">Total Spent</p>
          <p className="text-base lg:text-lg font-semibold tabular-nums">{formatCurrency(periodSpent)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] lg:text-[11px] text-muted-foreground font-medium truncate">Extra Spent</p>
          <p className="text-base lg:text-lg font-semibold tabular-nums text-orange-500/90">{formatCurrency(periodExtraSpent)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] lg:text-[11px] text-muted-foreground font-medium truncate">Extra Pool</p>
          <p className="text-base lg:text-lg font-semibold tabular-nums text-green-500/90">{formatCurrency(periodExtraPool)}</p>
        </div>
      </div>

      {/* Chart - constrained width */}
      <div className="h-36 lg:h-48 -mx-2 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentChartData} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="rawVal" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              ticks={chartTicks}
              tickFormatter={formatChartTick}
              interval={0}
            />
            <YAxis hide domain={[0, 'dataMax + 2000']} />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataPoint = currentChartData.find(d => d.rawVal === label || d.name === label)
                  const labelText = dataPoint ? dataPoint.name : String(label)
                  
                  let displayLabel = labelText
                  if (activePeriod === '1M') {
                    displayLabel = `${currentMonthLabel.split(' ')[0]} ${labelText}, ${currentMonthLabel.split(' ')[1]}`
                  } else if (activePeriod === '1W') {
                    displayLabel = `This Week — ${labelText}`
                  }
                  
                  return (
                    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg">
                      <p className="text-xs text-muted-foreground">{displayLabel}</p>
                      <p className="text-sm font-semibold">{formatCurrency(payload[0].value as number)}</p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#colorAmount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Period selector - scrollable on mobile */}
      <div className="flex items-center gap-1 mt-3 lg:mt-4 p-1 bg-muted rounded-lg overflow-x-auto scrollbar-hide">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setActivePeriod(period)}
            className={cn(
              'flex-1 min-w-[40px] px-2 lg:px-3 py-1.5 text-xs font-medium rounded-md transition-all-smooth whitespace-nowrap',
              activePeriod === period 
                ? 'bg-card text-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  )
}
