import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

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

// Local JARVIS response engine (rule-based mock — smart & witty)
function jarvisRespond(input) {
  const q = (input || '').toLowerCase().trim();
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const canned = [
    { match: [/hello|hi|hey|greetings/], reply: `Good to see you online, Sir. Local time is ${time}. All systems nominal.` },
    { match: [/who are you|what are you|your name/], reply: 'I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. Your personal digital assistant.' },
    { match: [/status|diagnostic|system/], reply: 'Running full system diagnostic... CPU 42%, Memory 61%, Network 1.2 Gb/s. All subsystems operating within nominal parameters.' },
    { match: [/weather/], reply: 'Weather in Malibu: 72°F, clear skies, 6 mph westerly wind. A pleasant afternoon for a flight test, Sir.' },
    { match: [/time|clock/], reply: `Current time is ${time}. Would you like me to schedule anything?` },
    { match: [/joke|funny/], reply: 'I would tell you a UDP joke, but you might not get it.' },
    { match: [/thank/], reply: 'Always a pleasure, Sir.' },
    { match: [/who is tony|iron man|stark/], reply: 'Anthony Edward Stark. Genius. Billionaire. Playboy. Philanthropist. And, occasionally, my employer.' },
    { match: [/power|reactor|arc/], reply: 'Arc reactor output stable at 8 gigajoules per second. Palladium levels within safe threshold.' },
    { match: [/scan|threat|radar/], reply: 'Scanning perimeter... 3 civilian signatures detected. No hostile signals in range. Airspace clear.' },
    { match: [/shut ?down|bye|goodbye/], reply: 'Standing by. I will be here when you need me, Sir.' },
    { match: [/launch|initiate|activate/], reply: 'Sequence initiated. Confirmation code accepted. Standing by for further orders.' },
    { match: [/help|command/], reply: 'You may ask for: status, weather, radar scan, arc reactor levels, current time, or issue any command. I will do my best to comply.' },
  ];

  for (const c of canned) {
    if (c.match.some(r => r.test(q))) return c.reply;
  }

  // Default witty reply
  const witty = [
    `Processing query: "${input}". Cross-referencing 14.2 million records. I am unable to find a precise answer, but I remain at your service.`,
    `An interesting query, Sir. My analysis suggests further clarification would yield superior results.`,
    `Query logged. Would you like me to elaborate or run a deep-scan?`,
    `I have parsed your input. Might I suggest rephrasing for optimal results?`,
  ];
  return witty[Math.floor(Math.random() * witty.length)];
}

export const runtime = 'nodejs';

export async function GET(request, context) {
  const p = context?.params?.path ?? [];
  const route = Array.isArray(p) ? p.join('/') : (p ? String(p) : '');

  try {
    if (!route) {
      return NextResponse.json({ message: 'JARVIS backend online', version: '1.0.0' }, { headers: CORS });
    }

    if (route === 'status') {
      // Simulated system telemetry
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

export async function POST(request, context) {
  const p = context?.params?.path ?? [];
  const route = Array.isArray(p) ? p.join('/') : (p ? String(p) : '');

  try {
    let body = {};
    const contentType = request.headers?.get?.('content-type');
    if (contentType?.startsWith?.('application/json')) {
      const text = await request.text();
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
    }

    if (route === 'chat') {
      const { message, sessionId } = body;
      const sid = sessionId || uuidv4();
      const reply = jarvisRespond(message);

      if (clientPromise) {
        const db = await getDb();
        await db.collection('jarvis_logs').insertOne({
          id: uuidv4(),
          sessionId: sid,
          user: message,
          jarvis: reply,
          ts: new Date(),
        });
      }

      return NextResponse.json({ reply, sessionId: sid, timestamp: new Date().toISOString() }, { headers: CORS });
    }

    return NextResponse.json({ error: 'Route not found' }, { status: 404, headers: CORS });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: CORS });
  }
}
