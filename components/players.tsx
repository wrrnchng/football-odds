"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Search, Star } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Player {
  id: number
  name: string
  team: string | null
  position: string | null
  league: string | null
  leagueDb?: string | null
  goals: number
  shotsOnTarget: number
  appearances: number
  rating: number
}

interface PlayerRecentMatch {
  id: number
  opponent: string
  score: string
  result: "win" | "draw" | "loss"
  date: string
  isHome: boolean
  shotsOnTarget: number | null
}

export function Players() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedLeague, setSelectedLeague] = useState<string>("Premier League (England)")
  const [players, setPlayers] = useState<Player[]>([])
  const [allLeagues, setAllLeagues] = useState<string[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [recentMatches, setRecentMatches] = useState<PlayerRecentMatch[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null)

  // Fetch all leagues on mount to populate the selector
  useEffect(() => {
    const fetchAllLeagues = async () => {
      try {
        const response = await fetch("/api/players")
        if (!response.ok) throw new Error("Failed to fetch leagues")
        const data = await response.json()
        const leagues = new Set<string>()
        data.forEach((player: Player) => {
          if (player.league) {
            leagues.add(player.league)
          }
        })
        setAllLeagues(Array.from(leagues).sort())
      } catch (err) {
        console.error("Error fetching leagues:", err)
      }
    }
    fetchAllLeagues()
  }, [])

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true)
        setError(null)
        const url = selectedLeague === "All Leagues" 
          ? "/api/players"
          : `/api/players?league=${encodeURIComponent(selectedLeague)}`
        const response = await fetch(url)
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
  }, [selectedLeague])

  // Get all unique leagues from all players (for selector)
  const availableLeagues = useMemo(() => {
    return allLeagues
  }, [allLeagues])

  // Major leagues that should appear in the top subgroup (in specific order)
  const majorLeaguesDisplay = [
    "Premier League (England)",
    "La Liga (Spain)",
    "Bundesliga (Germany)",
    "Serie A (Italy)",
    "Ligue 1 (France)",
    "Ligue 2 (France)",
    "Liga Professional (Argentina)",
  ]

  // Separate major leagues from other leagues
  const { majorLeaguesAvailable, otherLeagues } = useMemo(() => {
    const major: string[] = []
    const other: string[] = []
    
    availableLeagues.forEach((league) => {
      if (majorLeaguesDisplay.includes(league)) {
        major.push(league)
      } else {
        other.push(league)
      }
    })
    
    return {
      majorLeaguesAvailable: major.sort(),
      otherLeagues: other.sort(),
    }
  }, [availableLeagues, majorLeaguesDisplay])

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left side: League selector and search */}
        <div className="lg:col-span-1 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2.5">
                Select League
              </label>
              <Select
                value={selectedLeague}
                onValueChange={(value) => {
                  setSelectedLeague(value)
                  setSelectedPlayer(null) // Clear selected player when league changes
                }}
              >
                <SelectTrigger className="w-full h-11 bg-white border-slate-200">
                  <SelectValue placeholder="Select a league" />
                </SelectTrigger>
                <SelectContent>
                  {/* All Leagues Option - Always show at the top */}
                  {availableLeagues.length > 0 && (
                    <SelectItem value="All Leagues">All Leagues</SelectItem>
                  )}
                  
                  {/* Major Leagues Subgroup - Always show all major leagues */}
                  <SelectGroup>
                    <SelectLabel>Major Leagues</SelectLabel>
                    {majorLeaguesDisplay.map((league) => {
                      const isAvailable = majorLeaguesAvailable.includes(league)
                      return (
                        <SelectItem 
                          key={league} 
                          value={league}
                          disabled={!isAvailable}
                          className={!isAvailable ? "opacity-50" : ""}
                        >
                          {league}
                          {!isAvailable && " (No players)"}
                        </SelectItem>
                      )
                    })}
                  </SelectGroup>
                  
                  {/* Other Leagues */}
                  {otherLeagues.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Other Leagues</SelectLabel>
                      {otherLeagues.map((league) => (
                        <SelectItem key={league} value={league}>
                          {league}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200"
              />
            </div>
          </div>

          {/* Player count */}
          {!loading && !error && (
            <div className="text-xs text-slate-500 px-1">
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} found
            </div>
          )}
        </div>

        {/* Right side: Player list */}
        <div className="lg:col-span-2">

          {filteredPlayers.length === 0 ? (
            <div className="text-center py-16 text-slate-600">
              <p className="text-sm">
                {searchTerm
                  ? "No players found matching your search."
                  : `No players found in ${selectedLeague}.`}
              </p>
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
                        {player.league && ` • ${player.league}`}
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
                <div className="mt-6 pt-6 border-t border-slate-200 space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-emerald-50 rounded-lg p-4 sm:p-5 text-center">
                      <p className="text-sm text-slate-600 mb-2">Goals</p>
                      <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{player.goals}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 sm:p-5 text-center">
                      <p className="text-sm text-slate-600 mb-2">Shots on Target</p>
                      <p className="text-2xl sm:text-3xl font-bold text-blue-600">{player.shotsOnTarget}</p>
                    </div>
                    <div className="bg-slate-100 rounded-lg p-4 sm:p-5 text-center">
                      <p className="text-sm text-slate-600 mb-2">Appearances</p>
                      <p className="text-2xl sm:text-3xl font-bold text-slate-900">{player.appearances}</p>
                    </div>
                  </div>

                  {/* Recent Matches */}
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Last 10 Matches</h3>
                    {loadingMatches ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
                      </div>
                    ) : recentMatches.length === 0 ? (
                      <p className="text-slate-600 text-center py-6 text-sm">No recent matches found.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {recentMatches.map((match) => (
                          <div
                            key={match.id}
                            className={`rounded-lg border cursor-pointer transition-all ${
                              match.result === "win"
                                ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                                : match.result === "draw"
                                  ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                                  : "bg-red-50 border-red-200 hover:bg-red-100"
                            }`}
                            onClick={() => setExpandedMatch(expandedMatch === match.id ? null : match.id)}
                          >
                            <div className="flex items-center justify-between p-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm sm:text-base text-slate-900 truncate">{match.opponent}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                                    match.isHome 
                                      ? "bg-blue-100 text-blue-700" 
                                      : "bg-slate-100 text-slate-700"
                                  }`}>
                                    {match.isHome ? "H" : "A"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600">{match.date}</p>
                              </div>
                              <div className="text-right ml-4 flex-shrink-0">
                                <p className="text-lg font-bold text-slate-900">{match.score}</p>
                                <p
                                  className={`text-xs font-semibold mt-0.5 ${
                                    match.result === "win"
                                      ? "text-emerald-600"
                                      : match.result === "draw"
                                        ? "text-blue-600"
                                        : "text-red-600"
                                  }`}
                                >
                                  {match.result.toUpperCase()}
                                </p>
                              </div>
                            </div>
                            {expandedMatch === match.id && (
                              <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white/50">
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mt-2">
                                  <p className="text-xs text-slate-600 mb-1">Shots on Target</p>
                                  <p className="text-xl font-bold text-blue-600">
                                    {match.shotsOnTarget !== null ? match.shotsOnTarget : "N/A"}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
              </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
