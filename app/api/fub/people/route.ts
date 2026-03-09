import { NextRequest, NextResponse } from "next/server";
import { isFubProxyAuthorized } from "../../../../lib/fub/auth";
import { extractItems, fubGet } from "../../../../lib/fub/client";

function intFromQuery(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  if (!isFubProxyAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = intFromQuery(searchParams.get("page"), 1);
    const limit = intFromQuery(searchParams.get("limit"), 25);
    const offset = intFromQuery(searchParams.get("offset"), Math.max(0, (page - 1) * limit));
    const updatedSince = searchParams.get("updatedSince") || undefined;

    const payload = await fubGet("/people", {
      offset,
      limit,
      updatedSince
    });
    const items = extractItems(payload);

    return NextResponse.json({
      ok: true,
      page,
      offset,
      limit,
      count: items.length,
      people: items
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch people from Follow Up Boss"
      },
      { status: 500 }
    );
  }
}
