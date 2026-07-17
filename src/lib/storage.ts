import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { DocumentRecord } from "./types";

interface DocuprosDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentRecord;
    indexes: { "by-updated": number };
  };
}

const DB_NAME = "docupros";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<DocuprosDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<DocuprosDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("documents", { keyPath: "id" });
        store.createIndex("by-updated", "updatedAt");
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
