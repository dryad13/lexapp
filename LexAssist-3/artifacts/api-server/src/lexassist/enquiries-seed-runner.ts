import { storage } from "./storage";
import { SEED_ENQUIRIES, STANDARD_ENQUIRIES } from "./enquiries-seed";

export async function seedEnquiriesLibrary() {
  const existing = await storage.getEnquiriesLibrary();
  const existingTitles = new Set(existing.map(i => i.title));

  const allItems = [...SEED_ENQUIRIES, ...STANDARD_ENQUIRIES];
  const toInsert = allItems.filter(item => !existingTitles.has(item.title));

  if (toInsert.length === 0) {
    console.log(`Enquiries library up to date (${existing.length} items)`);
    return;
  }

  console.log(`Seeding ${toInsert.length} new enquiries library items (${existing.length} existing)...`);
  for (const item of toInsert) {
    await storage.createEnquiriesLibraryItem(item);
  }
  console.log(`Enquiries library seeded successfully (now ${existing.length + toInsert.length} items)`);
}
