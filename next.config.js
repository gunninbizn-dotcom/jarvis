import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || "jarvis_db";

let clientPromise = null;

if (uri) {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

async function getDb() {
  if (!clientPromise) return null;
  const client = await clientPromise;
  return client.db(dbName);
}

const CORS = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGINS || "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS,
  });
}

function jarvisRespond(input = "") {
  const q = input.toLowerCase();

  if (q.includes("hello") || q.includes("hi"))
    return "Hello Sir. JARVIS online.";

  if (q.includes("time"))
    return `Current time: ${new Date().toLocaleTimeString()}`;

  if (q.includes("status"))
    return "All systems are operational.";

  return "Command received, Sir.";
}

export async function GET(request, { params }) {
  const route = Array.isArray(params?.path)
    ? params.path.join("/")
    : params?.path || "";

  if (!route) {
    return NextResponse.json(
      {
        message: "JARVIS backend online",
        version: "1.0.0",
      },
      { headers: CORS }
    );
  }

  if (route === "status") {
    return NextResponse.json(
      {
        cpu: 45,
        memory: 63,
        network: 850,
        timestamp: new Date().toISOString(),
      },
      { headers: CORS }
    );
  }

  if (route === "logs") {
    const db = await getDb();

    if (!db) {
      return NextResponse.json({ logs: [] }, { headers: CORS });
    }

    const logs = await db
      .collection("jarvis_logs")
      .find({})
      .sort({ ts: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ logs }, { headers: CORS });
  }

  return NextResponse.json(
    { error: "Route not found" },
    {
      status: 404,
      headers: CORS,
    }
  );
}

export async function POST(request, { params }) {
  const route = Array.isArray(params?.path)
    ? params.path.join("/")
    : params?.path || "";

  let body = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (route === "chat") {
    const sessionId = body.sessionId || uuidv4();
    const reply = jarvisRespond(body.message || "");

    const db = await getDb();

    if (db) {
      await db.collection("jarvis_logs").insertOne({
        id: uuidv4(),
        sessionId,
        user: body.message || "",
        jarvis: reply,
        ts: new Date(),
      });
    }

    return NextResponse.json(
      {
        reply,
        sessionId,
        timestamp: new Date().toISOString(),
      },
      { headers: CORS }
    );
  }

  return NextResponse.json(
    { error: "Route not found" },
    {
      status: 404,
      headers: CORS,
    }
  );
}