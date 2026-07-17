import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DocumentRecord } from "./types";

interface DocuprosDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentRecord;
    indexes: { "by-updated": number };
  };
  // Kept for users who already upgraded to v2; unused by the UI now.
  colleagues: {
    key: string;
    value: {
      id: string;
      name: string;
      email?: string;
      phone?: string;
      note?: string;
      createdAt: number;
      updatedAt: number;
    };
    indexes: { "by-name": string };
  };
}

const DB_NAME = "docupros";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<DocuprosDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<DocuprosDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const store = db.createObjectStore("documents", { keyPath: "id" });
          store.createIndex("by-updated", "updatedAt");
        }
        if (oldVersion < 2 && !db.objectStoreNames.contains("colleagues")) {
          const colleagues = db.createObjectStore("colleagues", {
            keyPath: "id",
          });
          colleagues.createIndex("by-name", "name");
        }
      },
    });
  }
  return dbPromise;
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const db = await getDb();
  const docs = await db.getAllFromIndex("documents", "by-updated");
  return docs.reverse();
}

export async function getDocument(id: string): Promise<DocumentRecord | undefined> {
  const db = await getDb();
  return db.get("documents", id);
}

export async function saveDocument(doc: DocumentRecord): Promise<void> {
  const db = await getDb();
  await db.put("documents", doc);
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("documents", id);
}
