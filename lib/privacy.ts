import type { Connection } from './portfolio';

// Only this allowlist crosses the server/browser boundary. Never spread a DB row.
export function redactAddresses(text: string): string {
  return text.replace(/0x[a-fA-F0-9]{40}/g, '[private wallet]');
}

export function publicConnection(row: {
  id: string; type: Connection['type']; label: string; status: string;
  error: string | null; last_sync: string | null;
}): Connection {
  return {
    id: row.id, type: row.type, label: redactAddresses(row.label),
    status: row.status, error: row.error ? redactAddresses(row.error) : null,
    lastSync: row.last_sync,
  };
}
