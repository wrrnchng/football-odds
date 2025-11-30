"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Zap, TrendingUp } from "lucide-react"

export function Predict() {
  const [query, setQuery] = useState("")
  const [prediction, setPrediction] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handlePredict = async () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => {
      setPrediction({
        query: query,
        homeWinProb: 55,
        drawProb: 25,
        awayWinProb: 20,
        predictedScore: "2-1",
        confidence: 78,
        topScorer: "Erling Haaland",
        keyStats: [
          "Expected possession: 62%",
          "Expected shots on target: 5-6",
          "Likely winner: Home team",
          "Over 2.5 goals probability: 68%",
        ],
      })
      setLoading(false)
    }, 800)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Match Predictions</h1>
        <p className="text-slate-600">AI-powered predictions for upcoming matches</p>
      </div>

      {/* Prediction Input */}
      <Card className="border-slate-200 bg-gradient-to-br from-emerald-50 to-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-600" />
            Ask for a Prediction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="E.g., Manchester City vs Liverpool, Real Madrid vs Barcelona..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handlePredict()}
            className="h-11 bg-white border-slate-200"
          />
          <Button
            onClick={handlePredict}
            disabled={!query || loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
          >
            {loading ? "Analyzing..." : "Get Prediction"}
          </Button>
        </CardContent>
      </Card>

      {/* Prediction Results */}
      {prediction && (
        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-slate-900">{prediction.query}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Win Probabilities */}
              <div>
                <p className="text-sm font-semibold text-slate-600 mb-4 uppercase tracking-wide">Win Probability</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-900">Home Team Win</span>
                      <span className="text-lg font-bold text-emerald-600">{prediction.homeWinProb}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2 rounded-full"
                        style={{ width: `${prediction.homeWinProb}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-900">Draw</span>
                      <span className="text-lg font-bold text-blue-600">{prediction.drawProb}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full"
                        style={{ width: `${prediction.drawProb}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-slate-900">Away Team Win</span>
                      <span className="text-lg font-bold text-orange-600">{prediction.awayWinProb}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full"
                        style={{ width: `${prediction.awayWinProb}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prediction Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
                <div className="bg-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Predicted Score</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{prediction.predictedScore}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-sm text-slate-600">Confidence</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{prediction.confidence}%</p>
                </div>
                <div className="bg-slate-100 rounded-lg p-4 text-center md:col-span-2">
                  <p className="text-sm text-slate-600">Top Scorer Prediction</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{prediction.topScorer}</p>
                </div>
              </div>

              {/* Key Stats */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-600 mb-3 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Key Statistics
                </p>
                <ul className="space-y-2">
                  {prediction.keyStats.map((stat: string, i: number) => (
                    <li key={i} className="flex items-center gap-3 text-slate-700">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                      {stat}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
