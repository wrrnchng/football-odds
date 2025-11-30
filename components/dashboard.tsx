"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, MapPin, RefreshCw } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { fetchScoreboard } from "@/lib/api/espn"
import { transformEventsToMatches } from "@/lib/utils/espn-transform"
import type { DashboardMatch } from "@/lib/types/espn"

export function Dashboard() {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)
  const [matches, setMatches] = useState<DashboardMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMatches = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchScoreboard()
      const allMatches = transformEventsToMatches(response.events || [])
      // Filter for upcoming/live matches: not completed and date is in future or currently live
      const now = new Date()
      const upcomingMatches = allMatches.filter((m) => {
        const matchDate = new Date(m.time)
        return (
          m.status === "scheduled" || 
          m.status === "upcoming" || 
          m.status === "live" ||
          (m.status !== "completed" && matchDate >= now)
        )
      })
      setMatches(upcomingMatches)
    } catch (err) {
      console.error("Error fetching matches:", err)
      setError("Failed to load matches. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [])

  const leagues = useMemo(() => {
    const leagueSet = new Set(matches.map((m) => m.league))
    return Array.from(leagueSet)
  }, [matches])

  const filteredMatches = useMemo(() => {
    return selectedLeague ? matches.filter((m) => m.league === selectedLeague) : matches
  }, [selectedLeague, matches])

  const formatTime = (timeString: string) => {
    const date = new Date(timeString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Match Dashboard</h1>
          <p className="text-slate-600">Upcoming matches</p>
        </div>
        <Button
          onClick={fetchMatches}
          disabled={loading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      )}

      {/* League Filter */}
      {!loading && !error && (
        <>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedLeague(null)}
              className={`px-4 py-2 rounded-full font-medium transition-all ${
                selectedLeague === null
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Leagues
            </button>
            {leagues.map((league) => (
              <button
                key={league}
                onClick={() => setSelectedLeague(league)}
                className={`px-4 py-2 rounded-full font-medium transition-all ${
                  selectedLeague === league
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {league}
              </button>
            ))}
          </div>

          {/* Matches Grid */}
          {filteredMatches.length === 0 ? (
            <div className="text-center py-12 text-slate-600">
              <p>No upcoming matches found.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMatches.map((match) => (
                <Card key={match.id} className="border-slate-200 hover:shadow-lg transition-shadow overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary" className="bg-slate-100">
                        {match.league}
                      </Badge>
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Clock className="w-4 h-4" />
                        {formatTime(match.time)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {match.venue}
                    </div>
                  </div>

                  <CardContent className="p-6">
                    {/* Teams */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-center flex-1">
                        <p className="font-semibold text-slate-900">{match.homeTeam}</p>
                        <p className="text-sm text-slate-500">Home</p>
                        {match.homeScore !== null && (
                          <p className="text-lg font-bold text-emerald-600 mt-1">{match.homeScore}</p>
                        )}
                      </div>
                      <div className="px-4 py-2 bg-slate-100 rounded-lg font-bold text-slate-900">vs</div>
                      <div className="text-center flex-1">
                        <p className="font-semibold text-slate-900">{match.awayTeam}</p>
                        <p className="text-sm text-slate-500">Away</p>
                        {match.awayScore !== null && (
                          <p className="text-lg font-bold text-emerald-600 mt-1">{match.awayScore}</p>
                        )}
                      </div>
                    </div>

                    {/* Odds */}
                    {(match.homeOdds || match.drawOdds || match.awayOdds) && (
                      <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Match Odds</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white rounded p-3 text-center border border-slate-200">
                            <p className="text-xs text-slate-600">Home Win</p>
                            <p className="font-bold text-emerald-600">
                              {match.homeOdds ? match.homeOdds.toFixed(2) : "N/A"}
                            </p>
                          </div>
                          <div className="bg-white rounded p-3 text-center border border-slate-200">
                            <p className="text-xs text-slate-600">Draw</p>
                            <p className="font-bold text-blue-600">
                              {match.drawOdds ? match.drawOdds.toFixed(2) : "N/A"}
                            </p>
                          </div>
                          <div className="bg-white rounded p-3 text-center border border-slate-200">
                            <p className="text-xs text-slate-600">Away Win</p>
                            <p className="font-bold text-orange-600">
                              {match.awayOdds ? match.awayOdds.toFixed(2) : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
