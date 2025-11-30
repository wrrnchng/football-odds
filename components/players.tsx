"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Star } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Player {
  id: number
  name: string
  team: string | null
  position: string | null
  goals: number
  assists: number
  appearances: number
  rating: number
}

export function Players() {
  const [searchTerm, setSearchTerm] = useState("")
  const [players, setPlayers] = useState<Player[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/players")
        if (!response.ok) throw new Error("Failed to fetch players")
        const data = await response.json()
        setPlayers(data)
      } catch (err) {
        console.error("Error fetching players:", err)
        setError("Failed to load players. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    fetchPlayers()
  }, [])

  const filteredPlayers = useMemo(() => {
    return players.filter(
      (player) =>
        player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.team?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.position?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
  }, [searchTerm, players])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">Players</h1>
          <p className="text-base text-slate-600">Search player statistics and performance</p>
        </div>
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">Players</h1>
        <p className="text-base text-slate-600">Search player statistics and performance</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
        <Input
          placeholder="Search by player name, team, or position..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 bg-white border-slate-200"
        />
      </div>

      {filteredPlayers.length === 0 ? (
        <div className="text-center py-16 text-slate-600">
          <p className="text-base">No players found.</p>
        </div>
      ) : (

      <div className="grid gap-4 sm:gap-5">
        {filteredPlayers.map((player) => (
          <Card
            key={player.id}
            className="cursor-pointer border-slate-200 hover:shadow-lg transition-all hover:border-emerald-300"
            onClick={() => setSelectedPlayer(selectedPlayer?.id === player.id ? null : player)}
          >
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                      {player.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base sm:text-lg text-slate-900 leading-tight truncate">{player.name}</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        {player.team || "Unknown Team"} • {player.position || "Unknown Position"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-600 uppercase tracking-wide mb-1">Rating</p>
                    <p className="flex items-center gap-1.5 text-xl sm:text-2xl font-bold text-emerald-600">
                      <Star className="w-5 h-5 sm:w-6 sm:h-6 fill-emerald-600" />
                      {player.rating > 0 ? player.rating.toFixed(1) : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {selectedPlayer?.id === player.id && (
                <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-3 gap-4">
                  <div className="bg-emerald-50 rounded-lg p-4 sm:p-5 text-center">
                    <p className="text-sm text-slate-600 mb-2">Goals</p>
                    <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{player.goals}</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 sm:p-5 text-center">
                    <p className="text-sm text-slate-600 mb-2">Assists</p>
                    <p className="text-2xl sm:text-3xl font-bold text-blue-600">{player.assists}</p>
                  </div>
                  <div className="bg-slate-100 rounded-lg p-4 sm:p-5 text-center">
                    <p className="text-sm text-slate-600 mb-2">Matches (Avg)</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900">14</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      )}
    </div>
  )
}
