import { NextRequest, NextResponse } from "next/server";
import { isFubProxyAuthorized } from "../../../../lib/fub/auth";
import { extractItems, fubGet } from "../../../../lib/fub/client";

export async function GET(request: NextRequest) {
  if (!isFubProxyAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await fubGet("/people", { limit: 1 });
    const items = extractItems(payload);
    return NextResponse.json({
      ok: true,
      message: "Follow Up Boss connection successful",
      sampleCount: items.length
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to connect to Follow Up Boss"
      },
      { status: 500 }
    );
  }
}
