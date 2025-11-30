"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Trophy } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"

interface Team {
  id: number
  name: string
  abbreviation?: string
  logoUrl?: string
  league?: string | null
  leagueDb?: string | null // Original database league name
  wins: number
  draws: number
  losses: number
  goalsScored: number
  goalsConceded: number
  points: number
  shotsOnTarget: number
  corners: number
}

interface RecentMatch {
  id: number
  opponent: string
  score: string
  result: "win" | "draw" | "loss"
  date: string
  isHome: boolean
  shotsOnTarget: number | null
  corners: number | null
  yellowCards: number | null
  redCards: number | null
}

interface HeadToHeadMatch {
  id: number
  date: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  team1Score: number
  team2Score: number
  team1IsHome: boolean
  team1ShotsOnTarget: number | null
  team1Corners: number | null
  team1YellowCards: number | null
  team1RedCards: number | null
  team2ShotsOnTarget: number | null
  team2Corners: number | null
  team2YellowCards: number | null
  team2RedCards: number | null
}

interface HeadToHead {
  team1Wins: number
  team2Wins: number
  draws: number
  matches: HeadToHeadMatch[]
}

export function Teams() {
  const [searchTerm, setSearchTerm] = useState("")
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedLeague, setSelectedLeague] = useState<string>("All Leagues")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [activeTab, setActiveTab] = useState<"stats" | "h2h">("stats")
  const [h2hTeam2, setH2hTeam2] = useState<Team | null>(null)
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([])
  const [headToHead, setHeadToHead] = useState<HeadToHead | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null)
  const [expandedH2hMatch, setExpandedH2hMatch] = useState<number | null>(null)

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/teams")
        if (!response.ok) throw new Error("Failed to fetch teams")
        const data = await response.json()
        setTeams(data)
      } catch (err) {
        console.error("Error fetching teams:", err)
        setError("Failed to load teams. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    fetchTeams()
  }, [])

  useEffect(() => {
    if (!selectedTeam) {
      setRecentMatches([])
      return
    }

    const fetchRecentMatches = async () => {
      try {
        setLoadingMatches(true)
        const response = await fetch(`/api/teams/${selectedTeam.id}/recent-matches`)
        if (!response.ok) throw new Error("Failed to fetch recent matches")
        const data = await response.json()
        setRecentMatches(data)
      } catch (err) {
        console.error("Error fetching recent matches:", err)
      } finally {
        setLoadingMatches(false)
      }
    }
    fetchRecentMatches()
  }, [selectedTeam])

  useEffect(() => {
    if (!selectedTeam || !h2hTeam2) {
      setHeadToHead(null)
      return
    }

    const fetchHeadToHead = async () => {
      try {
        const response = await fetch(`/api/teams/${selectedTeam.id}/${h2hTeam2.id}/head-to-head`)
        if (!response.ok) throw new Error("Failed to fetch head-to-head")
        const data = await response.json()
        setHeadToHead(data)
      } catch (err) {
        console.error("Error fetching head-to-head:", err)
      }
    }
    fetchHeadToHead()
  }, [selectedTeam, h2hTeam2])

  // Reverse mapping for filtering (display name -> database name)
  const displayToDbMapping: Record<string, string> = {
    "Premier League (England)": "Premier League",
    "La Liga (Spain)": "La Liga",
    "Bundesliga (Germany)": "Bundesliga",
    "Serie A (Italy)": "Serie A",
    "Ligue 1 (France)": "Ligue 1",
    "Ligue 2 (France)": "Ligue 2",
    "Eredivisie": "Eredivisie",
    "Liga Professional (Argentina)": "Liga Professional",
  }

  // Major leagues that should appear in the top subgroup (display names)
  const majorLeaguesDisplay = [
    "Premier League (England)",
    "La Liga (Spain)",
    "Bundesliga (Germany)",
    "Serie A (Italy)",
    "Ligue 1 (France)",
    "Ligue 2 (France)",
    "Liga Professional (Argentina)",
  ].sort()

  // Get all unique leagues from teams (already in display format from API)
  const availableLeagues = useMemo(() => {
    const leagues = new Set<string>()
    teams.forEach((team) => {
      if (team.league) {
        leagues.add(team.league)
      }
    })
    return Array.from(leagues).sort()
  }, [teams])

  // Separate major leagues from other leagues (using display names)
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

  // Reset selected league if it's not available (default to "All Leagues")
  useEffect(() => {
    if (teams.length > 0 && availableLeagues.length > 0) {
      if (selectedLeague !== "All Leagues" && !availableLeagues.includes(selectedLeague)) {
        // Default to "All Leagues" if selected league is not available
        setSelectedLeague("All Leagues")
        // Clear selected team when league changes
        setSelectedTeam(null)
      }
    }
  }, [teams, availableLeagues, selectedLeague])

  // Filter teams by selected league and search term
  const filteredTeams = useMemo(() => {
    let filtered = teams.filter((team) => {
      // Filter by league
      if (selectedLeague === "All Leagues") {
        // Show all teams
        return true
      }
      // Teams already have league in display format from API, so direct comparison
      return team.league === selectedLeague
    })

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (team) =>
          team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          team.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Sort teams by points (descending), then goal difference
    filtered.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points
      }
      const diffA = a.goalsScored - a.goalsConceded
      const diffB = b.goalsScored - b.goalsConceded
      return diffB - diffA
    })

    return filtered
  }, [teams, selectedLeague, searchTerm])

  const getGoalDiff = (team: Team) => team.goalsScored - team.goalsConceded

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Teams</h1>
          <p className="text-slate-600">Search and view team statistics</p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">Teams</h1>
        <p className="text-base text-slate-600">Search and view team statistics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left side: League selector, search and team list */}
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
                  setSelectedTeam(null) // Clear selected team when league changes
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
                          {!isAvailable && " (No teams)"}
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
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-white border-slate-200"
              />
            </div>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredTeams.length === 0 ? (
              <p className="text-slate-600 text-center py-6 text-sm">
                {searchTerm
                  ? "No teams found matching your search."
                  : `No teams found in ${selectedLeague}.`}
              </p>
            ) : (
              <>
                <div className="text-xs text-slate-500 mb-3 px-1.5">
                  {filteredTeams.length} team{filteredTeams.length !== 1 ? "s" : ""} found
                </div>
                {filteredTeams.map((team) => (
                  <Card
                    key={team.id}
                    className={`cursor-pointer transition-all border-2 ${
                      selectedTeam?.id === team.id
                        ? "border-emerald-500 bg-emerald-50 shadow-md"
                        : "border-slate-200 hover:border-emerald-300"
                    }`}
                    onClick={() => {
                      setSelectedTeam(team)
                      setActiveTab("stats")
                    }}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm sm:text-base text-slate-900 leading-tight">{team.name}</p>
                          {team.abbreviation && (
                            <p className="text-xs text-slate-500 mt-1">{team.abbreviation}</p>
                          )}
                        </div>
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0 ml-2" />
                      </div>
                      <div className="grid grid-cols-3 gap-2.5 mt-4 text-center">
                        <div>
                          <p className="font-bold text-base text-emerald-600">{team.wins}</p>
                          <p className="text-xs text-slate-600 mt-0.5">W</p>
                        </div>
                        <div>
                          <p className="font-bold text-base text-blue-600">{team.draws}</p>
                          <p className="text-xs text-slate-600 mt-0.5">D</p>
                        </div>
                        <div>
                          <p className="font-bold text-base text-red-600">{team.losses}</p>
                          <p className="text-xs text-slate-600 mt-0.5">L</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right side: Team stats panel - visible immediately when selected */}
        <div className="lg:col-span-2">
          {selectedTeam ? (
            <div className="space-y-5">
              <div className="flex gap-1 border-b border-slate-200">
                <button
                  onClick={() => setActiveTab("stats")}
                  className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 ${
                    activeTab === "stats"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Team Stats
                </button>
                <button
                  onClick={() => setActiveTab("h2h")}
                  className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 ${
                    activeTab === "h2h"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Head-to-Head
                </button>
              </div>

              {/* Team Stats Tab */}
              {activeTab === "stats" && (
                <Card className="border-slate-200 bg-gradient-to-br from-emerald-50 to-blue-50">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl sm:text-2xl text-slate-900 leading-tight">{selectedTeam.name}</CardTitle>
                        <p className="text-sm text-slate-600 mt-1">{selectedTeam.league}</p>
                      </div>
                      <button
                        onClick={() => setSelectedTeam(null)}
                        className="text-slate-400 hover:text-slate-600 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">Total Goals</p>
                        <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{selectedTeam.goalsScored}</p>
                      </div>
                      <div className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">Goals Conceded</p>
                        <p className="text-2xl sm:text-3xl font-bold text-red-600">{selectedTeam.goalsConceded}</p>
                      </div>
                      <div className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">Points</p>
                        <p className="text-2xl sm:text-3xl font-bold text-blue-600">{selectedTeam.points}</p>
                      </div>
                      <div className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">Matches Played</p>
                        <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                          {selectedTeam.wins + selectedTeam.draws + selectedTeam.losses}
                        </p>
                      </div>
                      <div className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">Shots on Target</p>
                        <p className="text-2xl sm:text-3xl font-bold text-purple-600">{selectedTeam.shotsOnTarget}</p>
                      </div>
                      <div className="bg-white rounded-lg p-5 border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2">Total Corners</p>
                        <p className="text-2xl sm:text-3xl font-bold text-orange-600">{selectedTeam.corners}</p>
                      </div>
                    </div>

                    {/* Recent Matches */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Last 10 Matches</h3>
                      {loadingMatches ? (
                        <div className="flex items-center justify-center py-10">
                          <Spinner className="w-6 h-6" />
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
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                                    <p className="text-xs text-slate-600 mb-1">Shots on Target</p>
                                    <p className="text-xl font-bold text-purple-600">
                                      {match.shotsOnTarget !== null ? match.shotsOnTarget : "N/A"}
                                    </p>
                                  </div>
                                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                                    <p className="text-xs text-slate-600 mb-1">Corners</p>
                                    <p className="text-xl font-bold text-orange-600">
                                      {match.corners !== null ? match.corners : "N/A"}
                                    </p>
                                  </div>
                                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                                    <p className="text-xs text-slate-600 mb-1">Yellow Cards</p>
                                    <p className="text-xl font-bold text-yellow-600">
                                      {match.yellowCards !== null ? match.yellowCards : "N/A"}
                                    </p>
                                  </div>
                                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                                    <p className="text-xs text-slate-600 mb-1">Red Cards</p>
                                    <p className="text-xl font-bold text-red-600">
                                      {match.redCards !== null ? match.redCards : "N/A"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Head-to-Head Tab */}
              {activeTab === "h2h" && (
                <Card className="border-slate-200">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl sm:text-2xl text-slate-900 leading-tight">Head-to-Head Comparison</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Compare {selectedTeam.name} against another team</p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-2.5">Compare with</label>
                      <select
                        value={h2hTeam2?.id || ""}
                        onChange={(e) => {
                          const team = teams.find((t) => t.id === Number.parseInt(e.target.value))
                          setH2hTeam2(team || null)
                        }}
                        className="w-full h-11 px-3 border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="">Choose a team...</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id} disabled={team.id === selectedTeam.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {h2hTeam2 && (
                      <div className="mt-6 p-5 sm:p-6 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-5 gap-4">
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate flex-1">{selectedTeam.name}</h3>
                          <span className="text-sm font-semibold text-slate-600 flex-shrink-0 px-2">vs</span>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate flex-1 text-right">{h2hTeam2.name}</h3>
                        </div>

                        {!headToHead ? (
                          <div className="flex items-center justify-center py-4">
                            <Spinner className="w-6 h-6" />
                          </div>
                        ) : headToHead.team1Wins === 0 && headToHead.team2Wins === 0 && headToHead.draws === 0 ? (
                          <p className="text-slate-600 text-center py-4">
                            No head-to-head data available for these teams.
                          </p>
                        ) : (
                          <div className="space-y-5">
                            <div className="grid grid-cols-3 gap-4">
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <p className="text-2xl sm:text-3xl font-bold text-emerald-600">{headToHead.team1Wins}</p>
                                <p className="text-xs text-slate-600 mt-1.5">Wins</p>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{headToHead.draws}</p>
                                <p className="text-xs text-slate-600 mt-1.5">Draws</p>
                              </div>
                              <div className="text-center p-4 bg-white rounded-lg border border-slate-200">
                                <p className="text-2xl sm:text-3xl font-bold text-red-600">{headToHead.team2Wins}</p>
                                <p className="text-xs text-slate-600 mt-1.5">Wins</p>
                              </div>
                            </div>
                            
                            {/* Last 5 Matches */}
                            {headToHead.matches && headToHead.matches.length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-sm font-semibold text-slate-900 mb-4">Last 5 Matches</h4>
                                <div className="space-y-2.5">
                                  {headToHead.matches.map((match) => {
                                    // team1Score is always for selectedTeam, team2Score is always for h2hTeam2
                                    const selectedTeamWon = match.team1Score > match.team2Score;
                                    const opponentWon = match.team2Score > match.team1Score;
                                    const isDraw = match.team1Score === match.team2Score;
                                    
                                    return (
                                      <div
                                        key={match.id}
                                        className="rounded-lg border border-slate-200 cursor-pointer transition-all hover:bg-slate-50"
                                        onClick={() => setExpandedH2hMatch(expandedH2hMatch === match.id ? null : match.id)}
                                      >
                                        <div className="p-4">
                                          <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className={`text-sm font-semibold truncate ${
                                                  selectedTeamWon ? "text-emerald-600" : opponentWon ? "text-red-600" : "text-slate-900"
                                                }`}>
                                                  {selectedTeam.name}
                                                </span>
                                                <span className="text-xs text-slate-500 flex-shrink-0">vs</span>
                                                <span className={`text-sm font-semibold truncate ${
                                                  opponentWon ? "text-emerald-600" : selectedTeamWon ? "text-red-600" : "text-slate-900"
                                                }`}>
                                                  {h2hTeam2.name}
                                                </span>
                                                {match.team1IsHome && (
                                                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                                                    H
                                                  </span>
                                                )}
                                                {!match.team1IsHome && (
                                                  <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 flex-shrink-0">
                                                    A
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-xs text-slate-500">{match.date}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                              <span className={`text-lg font-bold ${
                                                selectedTeamWon ? "text-emerald-600" : opponentWon ? "text-red-600" : "text-slate-900"
                                              }`}>
                                                {match.team1Score}
                                              </span>
                                              <span className="text-slate-400">-</span>
                                              <span className={`text-lg font-bold ${
                                                opponentWon ? "text-emerald-600" : selectedTeamWon ? "text-red-600" : "text-slate-900"
                                              }`}>
                                                {match.team2Score}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        {expandedH2hMatch === match.id && (
                                          <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-slate-50/50">
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                <p className="text-xs text-slate-600 mb-1 font-semibold">{selectedTeam.name}</p>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                  <div className="bg-purple-50 rounded p-2 border border-purple-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Shots on Target</p>
                                                    <p className="text-base font-bold text-purple-600">
                                                      {match.team1ShotsOnTarget !== null ? match.team1ShotsOnTarget : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="bg-orange-50 rounded p-2 border border-orange-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Corners</p>
                                                    <p className="text-base font-bold text-orange-600">
                                                      {match.team1Corners !== null ? match.team1Corners : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="bg-yellow-50 rounded p-2 border border-yellow-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Yellow Cards</p>
                                                    <p className="text-base font-bold text-yellow-600">
                                                      {match.team1YellowCards !== null ? match.team1YellowCards : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="bg-red-50 rounded p-2 border border-red-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Red Cards</p>
                                                    <p className="text-base font-bold text-red-600">
                                                      {match.team1RedCards !== null ? match.team1RedCards : "N/A"}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="bg-white rounded-lg p-3 border border-slate-200">
                                                <p className="text-xs text-slate-600 mb-1 font-semibold">{h2hTeam2.name}</p>
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                  <div className="bg-purple-50 rounded p-2 border border-purple-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Shots on Target</p>
                                                    <p className="text-base font-bold text-purple-600">
                                                      {match.team2ShotsOnTarget !== null ? match.team2ShotsOnTarget : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="bg-orange-50 rounded p-2 border border-orange-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Corners</p>
                                                    <p className="text-base font-bold text-orange-600">
                                                      {match.team2Corners !== null ? match.team2Corners : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="bg-yellow-50 rounded p-2 border border-yellow-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Yellow Cards</p>
                                                    <p className="text-base font-bold text-yellow-600">
                                                      {match.team2YellowCards !== null ? match.team2YellowCards : "N/A"}
                                                    </p>
                                                  </div>
                                                  <div className="bg-red-50 rounded p-2 border border-red-200">
                                                    <p className="text-xs text-slate-600 mb-0.5">Red Cards</p>
                                                    <p className="text-base font-bold text-red-600">
                                                      {match.team2RedCards !== null ? match.team2RedCards : "N/A"}
                                                    </p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 bg-gradient-to-br from-emerald-50 to-blue-50 rounded-lg border-2 border-dashed border-slate-200 p-6">
              <p className="text-slate-600 text-center text-sm sm:text-base">Select a team to view stats and head-to-head comparisons</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
