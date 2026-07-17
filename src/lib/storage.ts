import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Colleague, DocumentRecord } from "./types";

interface DocuprosDB extends DBSchema {
  documents: {
    key: string;
    value: DocumentRecord;
    indexes: { "by-updated": number };
  };
  colleagues: {
    key: string;
    value: Colleague;
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

export async function listColleagues(): Promise<Colleague[]> {
  const db = await getDb();
  const items = await db.getAllFromIndex("colleagues", "by-name");
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getColleague(id: string): Promise<Colleague | undefined> {
  const db = await getDb();
  return db.get("colleagues", id);
}

export async function saveColleague(colleague: Colleague): Promise<void> {
  const db = await getDb();
  await db.put("colleagues", colleague);
}

export async function deleteColleague(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("colleagues", id);
}
