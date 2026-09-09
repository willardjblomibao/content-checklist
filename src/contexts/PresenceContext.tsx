import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface PresenceContextValue {
  /** ids of profiles currently connected to the app, including yourself */
  onlineUserIds: Set<string>
  isOnline: (userId: string) => boolean
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set(),
  isOnline: () => false,
})

/**
 * Wraps the authenticated part of the app. Every signed-in user (admin or
 * assistant) joins a shared Supabase Realtime "presence" channel for as
 * long as they have the app open, so anyone reading `onlineUserIds` — e.g.
 * the admin's Team page — gets a live view of who's currently connected.
 * Presence is per-tab-session only: nothing is written to the database,
 * and a user drops off the list within seconds of closing the tab or
 * losing connection (no stale "online" flag to worry about).
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!profile) {
      setOnlineUserIds(new Set())
      return
    }

    const channel = supabase.channel('online-users', {
      config: { presence: { key: profile.id } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            full_name: profile.full_name,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [profile?.id, profile?.full_name])

  return (
    <PresenceContext.Provider
      value={{ onlineUserIds, isOnline: (userId: string) => onlineUserIds.has(userId) }}
    >
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence(): PresenceContextValue {
  return useContext(PresenceContext)
}
