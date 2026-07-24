import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { createGeminiReply, createGeminiStreamReply } from '@/lib/gemini';
import { manageContextWindow, searchMemories, injectMemories } from '@/lib/memory';
import { classifyIntent } from '@/lib/intents';

const uri = process.env.MONGO_URL;
const dbName = process.env.DB_NAME || 'jarvis_db';

let clientPromise;

if (uri) {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

async function getDb() {
  if (!clientPromise) {
    throw new Error('MongoDB is not configured. Set MONGO_URL to enable DB-backed logs.');
  }
  const c = await clientPromise;
  return c.db(dbName);
}

const CORS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Persist a conversation turn to MongoDB (if configured).
 * @param {string} sessionId
 * @param {string} user
 * @param {string} jarvis
 */
async function logConversation(sessionId, user, jarvis) {
  if (!clientPromise) return;
  try {
    const db = await getDb();
    await db.collection('jarvis_logs').insertOne({
      id: uuidv4(),
      sessionId,
      user,
      jarvis,
      ts: new Date(),
    });
  } catch {
    // ignore logging failures
  }
}

/**
 * Fetch relevant memories and build memory context for the Gemini request.
 * - Manages the context window (trims oldest history first)
 * - Searches past conversations for relevant memories
 * - Injects relevant memories into the system prompt
 *
 * @param {string} message — current user message
 * @param {Array<{role:string,text:string}>} history — conversation history
 * @returns {Promise<{history:Array, systemPromptOverride:string|null, memories:Array}>}
 */
async function getMemoryContext(message, history) {
  const trimmedHistory = manageContextWindow(history || []);
  if (!clientPromise) {
    return { history: trimmedHistory, systemPromptOverride: null, memories: [] };
  }
  try {
    const db = await getDb();
    const logs = await db
      .collection('jarvis_logs')
      .find({})
      .sort({ ts: -1 })
      .limit(100)
      .toArray();
    const relevantMemories = searchMemories(logs, message);
    const systemPromptOverride = injectMemories('', relevantMemories);
    return { history: trimmedHistory, systemPromptOverride, memories: relevantMemories };
  } catch {
    return { history: trimmedHistory, systemPromptOverride: null, memories: [] };
  }
}

export const runtime = 'nodejs';

export async function GET(request, { params }) {
  const { path } = await params;
  const p = path ?? [];
  const route = Array.isArray(p) ? p.join('/') : (p ? String(p) : '');

  try {
    if (!route) {
      return NextResponse.json({ message: 'JARVIS backend online', version: '2.0.0' }, { headers: CORS });
    }

    if (route === 'status') {
      const telemetry = {
        cpu: 30 + Math.random() * 50,
        memory: 40 + Math.random() * 30,
        network: 400 + Math.random() * 800,
        power: 85 + Math.random() * 10,
        threats: Math.floor(Math.random() * 3),
        uptime: Math.floor(Date.now() / 1000) % 100000,
        temp: 34 + Math.random() * 8,
        satellites: 8 + Math.floor(Math.random() * 5),
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json(telemetry, { headers: CORS });
    }

    if (route === 'logs') {
      if (!clientPromise) {
        return NextResponse.json({ logs: [] }, { headers: CORS });
      }
      const db = await getDb();
      const logs = await db.collection('jarvis_logs').find({}).sort({ ts: -1 }).limit(50).toArray();
      return NextResponse.json({ logs: logs.map(l => ({ ...l, _id: undefined })) }, { headers: CORS });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
  }
}

export async function POST(request, { params }) {
  const { path } = await params;
  const p = path ?? [];
  const route = Array.isArray(p) ? p.join('/') : (p ? String(p) : '');

  try {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (route === 'chat') {
      const { message, sessionId, history } = body;
      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'Invalid message payload' }, { status: 400, headers: CORS });
      }

      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: 'GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in your .env.local.' },
          { status: 400, headers: CORS }
        );
      }

      const sid = sessionId || uuidv4();

      try {
        const { history: trimmedHistory, systemPromptOverride } = await getMemoryContext(message, history);
        const reply = await createGeminiReply(trimmedHistory, message, systemPromptOverride);
        await logConversation(sid, message, reply);
        return NextResponse.json({ reply, sessionId: sid, timestamp: new Date().toISOString() }, { headers: CORS });
      } catch (error) {
        return NextResponse.json(
          { error: error.message, sessionId: sid },
          { status: 500, headers: CORS }
        );
      }
    }

    if (route === 'intent/classify') {
      const { message } = body;
      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'Invalid message payload' }, { status: 400, headers: CORS });
      }
      const result = classifyIntent(message);
      return NextResponse.json({ ...result, message }, { headers: CORS });
    }

    if (route === 'memory/search') {
      const { query } = body;
      if (!clientPromise) {
        return NextResponse.json({ results: [] }, { headers: CORS });
      }
      try {
        const db = await getDb();
        const logs = await db.collection('jarvis_logs').find({}).sort({ ts: -1 }).limit(100).toArray();
        const results = searchMemories(logs, query || '');
        return NextResponse.json({ results: results.map(r => ({ ...r, _id: undefined })) }, { headers: CORS });
      } catch (error) {
        return NextResponse.json({ error: error.message, results: [] }, { status: 500, headers: CORS });
      }
    }

    if (route === 'chat/stream') {
      const { message, sessionId, history } = body;
      if (!message || typeof message !== 'string') {
        return NextResponse.json({ error: 'Invalid message payload' }, { status: 400, headers: CORS });
      }

      if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json(
          { error: 'GEMINI_API_KEY is missing. Please set GEMINI_API_KEY in your .env.local.' },
          { status: 400, headers: CORS }
        );
      }

      const sid = sessionId || uuidv4();

      try {
        const { history: trimmedHistory, systemPromptOverride } = await getMemoryContext(message, history);
        const stream = await createGeminiStreamReply(trimmedHistory, message, sid, systemPromptOverride);

        // Wrap the stream to log the conversation after it completes
        const loggedStream = new ReadableStream({
          async start(controller) {
            const reader = stream.getReader();
            let assistantText = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Capture delta text for logging
                const chunkStr = new TextDecoder().decode(value);
                try {
                  const parsed = JSON.parse(chunkStr.trim());
                  if (parsed.delta) {
                    assistantText += parsed.delta;
                  }
                } catch {
                  // ignore non-JSON chunks
                }

                controller.enqueue(value);
              }

              controller.close();
            } catch (error) {
              controller.error(error);
            } finally {
              await logConversation(sid, message, assistantText);
            }
          },
          cancel() {
            stream.cancel().catch(() => {});
          },
        });

        return new Response(loggedStream, {
          status: 200,
          headers: {
            ...CORS,
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            'X-Accel-Buffering': 'no',
          },
        });
      } catch (error) {
        return NextResponse.json(
          { error: error.message, sessionId: sid },
          { status: 500, headers: CORS }
        );
      }
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
  }
}
