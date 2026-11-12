/**
 * POST /api/simulate — salle de contrôle (EF-12) :
 *   tick     : un cycle de vie de la ville (arrivées/départs/pannes) ;
 *   rush     : mode heure de pointe {mode: auto|on|off} ;
 *   break    : provoque une panne capteur (démonstration de fiabilité) ;
 *   heal     : répare tous les capteurs ;
 *   reset    : réamorce l'occupation pour une nouvelle démonstration.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { simState } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import {
  breakRandomSensor,
  getSimState,
  healAllSensors,
  runTick,
  setRushMode,
} from "@/lib/simulation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureSeeded();
  let body: { action?: string; mode?: "auto" | "on" | "off" };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Requête illisible" }, { status: 400 });
  }

  switch (body.action) {
    case "tick": {
      const summary = await runTick();
      return Response.json({ ok: true, summary });
    }
    case "rush": {
      const mode = body.mode ?? "auto";
      await setRushMode(mode);
      const s = await getSimState();
      return Response.json({ ok: true, rushMode: s.rushMode });
    }
    case "break": {
      const code = await breakRandomSensor();
      return Response.json({ ok: true, broken: code });
    }
    case "heal": {
      const n = await healAllSensors();
      return Response.json({ ok: true, healed: n });
    }
    case "reset": {
      // réamorce une ville « neuve » : occupation aléatoire, capteurs sains
      await db.execute(sql`
        UPDATE parking_spots
        SET status = CASE WHEN random() < 0.32 THEN 'occupied' ELSE 'free' END,
            sensor_ok = true,
            sensor_fault_reason = NULL,
            last_heartbeat = now(),
            updated_at = now()
        WHERE status != 'reserved'
      `);
      const s = await getSimState();
      await db.update(simState).set({ lastTickAt: new Date() }).execute();
      const summary = await runTick();
      return Response.json({ ok: true, tickBefore: s.tick, summary });
    }
    default:
      return Response.json({ error: "Action inconnue" }, { status: 400 });
  }
}
