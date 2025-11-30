"use client"

import { useState } from "react"
import { Dashboard } from "@/components/dashboard"
import { Teams } from "@/components/teams"
import { Players } from "@/components/players"
import { Predict } from "@/components/predict"
import { Navigation } from "@/components/navigation"

type Tab = "dashboard" | "teams" | "players" | "predict"

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard")

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-slate-50 to-background">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="pt-20 px-4 md:px-6 max-w-7xl mx-auto pb-12">
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "teams" && <Teams />}
        {activeTab === "players" && <Players />}
        {activeTab === "predict" && <Predict />}
      </main>
    </div>
  )
}
