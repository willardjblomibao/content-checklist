import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProductionLogWithRelations } from '../types/database'

export interface LogFilters {
  userId?: string
  clientId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: 'production_date' | 'created_at'
  sortDir?: 'asc' | 'desc'
}

export function useProductionLogs(filters: LogFilters) {
  const [logs, setLogs] = useState<ProductionLogWithRelations[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    const page = filters.page ?? 0
    const pageSize = filters.pageSize ?? 25
    const from = page * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('production_logs')
      .select(
        '*, client:clients(id, name, status), profile:profiles(id, full_name, email)',
        { count: 'exact' }
      )

    if (filters.userId) query = query.eq('user_id', filters.userId)
    if (filters.clientId) query = query.eq('client_id', filters.clientId)
    if (filters.dateFrom) query = query.gte('production_date', filters.dateFrom)
    if (filters.dateTo) query = query.lte('production_date', filters.dateTo)

    query = query
      .order(filters.sortBy ?? 'production_date', { ascending: filters.sortDir === 'asc' })
      .range(from, to)

    const { data, error, count } = await query

    if (error) {
      setError(error.message)
      setLogs([])
    } else {
      setLogs((data ?? []) as unknown as ProductionLogWithRelations[])
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [
    filters.userId,
    filters.clientId,
    filters.dateFrom,
    filters.dateTo,
    filters.page,
    filters.pageSize,
    filters.sortBy,
    filters.sortDir,
  ])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return { logs, total, loading, error, refetch: fetchLogs }
}

export async function deleteProductionLog(id: string) {
  const { error } = await supabase.from('production_logs').delete().eq('id', id)
  return { error: error?.message ?? null }
}
