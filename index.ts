import type {
  FlashSessionData,
  SessionStorage,
  SessionIdStorageStrategy,
  SessionData,
} from "@remix-run/server-runtime"
import { createSessionStorage } from "@remix-run/cloudflare"

interface RemixD1SessionStorageOptions {
  cookie?: SessionIdStorageStrategy["cookie"]
  d1: D1Database
}

export function createD1SessionStorage<
  Data = SessionData,
  FlashData = Data
>({
  cookie,
  d1,
}: RemixD1SessionStorageOptions): SessionStorage<Data, FlashData> {
  return createSessionStorage({
    cookie,
    async createData(data, expires) {
      const sessionExpires = expires ? Math.round(expires.getTime() / 1000) : null
      const newSession = await d1.prepare("INSERT INTO sessions (data, expires) VALUES (?, ?)").bind(data, sessionExpires).first()

      if (!newSession) {
        throw new Error("Failed to create session")
      }

      return newSession['id'] as string
    },
    async readData(id) {
      const sessionExpires = Math.round(Date.now() / 1000)
      const session = await d1.prepare("SELECT data FROM sessions WHERE id = ? AND (expires IS NULL OR expires >= ?)").bind(id, sessionExpires).first()

      if (!session) {
        return null
      }

      return session['data'] as FlashSessionData<Data, FlashData>
    },
    async updateData(id, data, expires) {
      const sessionExpires = expires ? Math.round(expires.getTime() / 1000) : null
      await d1.prepare("UPDATE sessions SET data = ?, expires = ? WHERE id = ?").bind(data, sessionExpires, id).run()
    },
    async deleteData(id) {
      await d1.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run()
    },
  }) as SessionStorage<Data, FlashData>;
}
