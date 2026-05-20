'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/data'
import { useApp } from '@/lib/app-context'
import { getBudgetStatus, getMonthTransactions, getCategoryBreakdown } from '@/lib/calculations'
import Link from 'next/link'

export function BudgetDonut({ selectedMonth, selectedYear }: { selectedMonth?: number; selectedYear?: number }) {
  const { state, isHydrated } = useApp()
  
  const now = new Date()
  const m = selectedMonth ?? now.getMonth()
  const y = selectedYear ?? now.getFullYear()

  const currentMonthLabel = new Date(y, m).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const monthTx = getMonthTransactions(state.transactions, y, m)

  const { spent } = getBudgetStatus(state.transactions, state.accounts, y, m)
  const categoryData = getCategoryBreakdown(monthTx).slice(0, 5) // Show top 5

  const colors = [
    '#8B5CF6', // Vivid Violet
    '#EC4899', // Vivid Pink
    '#10B981', // Vivid Emerald
    '#F59E0B', // Vivid Amber
    '#3B82F6', // Vivid Blue
  ]

  const data = categoryData.map((cat, index) => ({
    name: cat.name,
    value: cat.amount,
    color: colors[index % colors.length],
    icon: cat.icon
  }))

  // Add "Other" if there are more categories
  const allCategories = getCategoryBreakdown(monthTx)
  if (allCategories.length > 5) {
    const otherSum = allCategories.slice(5).reduce((sum, cat) => sum + cat.amount, 0)
    data.push({
      name: 'Other',
      value: otherSum,
      color: 'var(--muted)',
      icon: '📦'
    })
  }

  if (!isHydrated) return null

  return (
    <div className="bg-card rounded-2xl p-4 lg:p-6 border border-border dark:card-glow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">Category Breakdown</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{currentMonthLabel}</p>
        </div>
        <Link href="/cards" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          Manage budget
        </Link>
      </div>

      {/* Chart and legend layout */}
      <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-6">
        {/* Donut chart */}
        <div className="relative w-40 h-40 lg:w-48 lg:h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="75%"
                outerRadius="100%"
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '12px' }}
                itemStyle={{ color: 'var(--foreground)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] lg:text-[11px] text-muted-foreground font-medium">Spent</span>
            <span className="text-xl lg:text-2xl font-bold text-foreground tabular-nums">{formatCurrency(spent)}</span>
          </div>
        </div>

        {/* Legend - horizontal on mobile, vertical on larger */}
        <div className="flex flex-row sm:flex-col gap-4 sm:gap-3 flex-wrap justify-center sm:justify-start max-h-[160px] sm:max-h-[200px] overflow-y-auto scrollbar-hide w-full sm:w-auto">
          {data.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center w-full">No expenses yet</div>
          ) : data.map((item, index) => (
            <div key={index} className="flex items-center gap-2 min-w-[120px] sm:min-w-0">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-xs lg:text-sm text-muted-foreground truncate max-w-[90px] sm:max-w-[120px]">{item.name}</span>
              <span className="text-xs lg:text-sm font-medium tabular-nums ml-auto sm:ml-2 shrink-0">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
