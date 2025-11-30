import { NextRequest, NextResponse } from "next/server";
import { fetchScoreboard } from "@/lib/api/espn";
import { storeEvents } from "@/lib/services/match-storage";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (YYYYMMDD format)" },
        { status: 400 }
      );
    }

    const dates = `${startDate}-${endDate}`;
    const response = await fetchScoreboard({ dates });

    if (!response.events || response.events.length === 0) {
      return NextResponse.json({
        message: "No events found for the specified date range",
        stored: 0,
      });
    }

    await storeEvents(response.events);

    return NextResponse.json({
      message: "Successfully stored past games",
      stored: response.events.length,
    });
  } catch (error) {
    console.error("Error fetching and storing past games:", error);
    return NextResponse.json(
      { error: "Failed to fetch and store past games" },
      { status: 500 }
    );
  }
}

