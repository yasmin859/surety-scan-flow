import type { MerchantRecord } from "./risk-engine";

const KEY = "risk-engine-records-v1";

export function loadRecords(): MerchantRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MerchantRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: MerchantRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(records));
}

export function upsertRecord(record: MerchantRecord) {
  const records = loadRecords();
  const i = records.findIndex((r) => r.id === record.id);
  if (i >= 0) records[i] = record;
  else records.unshift(record);
  saveRecords(records);
}

export function getRecord(id: string): MerchantRecord | undefined {
  return loadRecords().find((r) => r.id === id);
}

export function deleteRecord(id: string) {
  saveRecords(loadRecords().filter((r) => r.id !== id));
}
