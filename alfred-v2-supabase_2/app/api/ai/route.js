export async function POST(request) {
  var body = await request.json();
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500 });
  }
  try {
    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1024, system: body.system || "", messages: body.messages || [] }),
    });
    var data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: "Failed to call AI" }, { status: 500 });
  }
}
