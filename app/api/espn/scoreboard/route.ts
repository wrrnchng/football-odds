import { NextRequest, NextResponse } from "next/server";

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dates = searchParams.get("dates");

    let url = ESPN_API_BASE;
    if (dates) {
      url += `?dates=${dates}`;
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
      },
    });
  } catch (error) {
    console.error("Error fetching ESPN scoreboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch scoreboard data" },
      { status: 500 }
    );
  }
}

