import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { schedule } = await req.json()

    // Mock implementation - Supabase removed
    console.log("Mock creating schedule:", schedule)

    return NextResponse.json({
      success: true,
      scheduleId: "mock-schedule-id-" + Date.now(),
    })
  } catch (error) {
    console.error("Error creating schedule:", error)
    return NextResponse.json({ error: "Erro ao criar cronograma" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    // Mock implementation - Supabase removed
    return NextResponse.json([])
  } catch (error) {
    console.error("Error fetching schedules:", error)
    return NextResponse.json({ error: "Erro ao buscar cronogramas" }, { status: 500 })
  }
}
