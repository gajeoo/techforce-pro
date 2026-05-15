// ─── Types ──────────────────────────────────────────────────────────────────

export type CatalogProduct = {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  unit?: string;
  description?: string;
};

export type Catalog = {
  id: string;
  name: string;
  type: "product" | "service";
  products: CatalogProduct[];
};

// ─── Defaults ────────────────────────────────────────────────────────────────

export const initialCatalogs: Catalog[] = [
  // ── Products ────────────────────────────────────────────────────────────
  { id: "cat-p1", name: "Breaker Bar", type: "product", products: [
    { id: "p1-1", name: "Breaker Bar — Standard 18\"", sku: "BB-18", price: 24.50, unit: "ea" },
    { id: "p1-2", name: "Breaker Bar — Heavy Duty 24\"", sku: "BB-24", price: 34.00, unit: "ea" },
  ]},
  { id: "cat-p2", name: "Fire Extinguishers", type: "product", products: [
    { id: "p2-1", name: "ABC Dry Chemical 5lb",    sku: "FE-ABC5",   price: 55.00,  unit: "ea" },
    { id: "p2-2", name: "ABC Dry Chemical 10lb",   sku: "FE-ABC10",  price: 78.00,  unit: "ea" },
    { id: "p2-3", name: "ABC Dry Chemical 20lb",   sku: "FE-ABC20",  price: 125.00, unit: "ea" },
    { id: "p2-4", name: "CO2 5lb",                 sku: "FE-CO2-5",  price: 145.00, unit: "ea" },
    { id: "p2-5", name: "CO2 10lb",                sku: "FE-CO2-10", price: 195.00, unit: "ea" },
    { id: "p2-6", name: "Class K Wet Chemical 6L", sku: "FE-K6L",    price: 285.00, unit: "ea" },
    { id: "p2-7", name: "Water 2.5gal",            sku: "FE-W25",    price: 95.00,  unit: "ea" },
  ]},
  { id: "cat-p3", name: "Hose Strap and Knuckle", type: "product", products: [
    { id: "p3-1", name: "Hose Strap — Nylon",       sku: "HS-NYL",  price: 3.50,  unit: "ea"  },
    { id: "p3-2", name: "Hose Knuckle — Brass",     sku: "HK-BRS",  price: 8.25,  unit: "ea"  },
    { id: "p3-3", name: "Hose Strap + Knuckle Kit", sku: "HSK-KIT", price: 10.50, unit: "kit" },
  ]},
  { id: "cat-p4", name: "Link G360", type: "product", products: [
    { id: "p4-1", name: "Link G360 — 165°F", sku: "LG360-165", price: 12.00, unit: "ea" },
    { id: "p4-2", name: "Link G360 — 212°F", sku: "LG360-212", price: 12.00, unit: "ea" },
    { id: "p4-3", name: "Link G360 — 286°F", sku: "LG360-286", price: 14.50, unit: "ea" },
  ]},
  { id: "cat-p5", name: "Link G500", type: "product", products: [
    { id: "p5-1", name: "Link G500 — 165°F", sku: "LG500-165", price: 15.00, unit: "ea" },
    { id: "p5-2", name: "Link G500 — 212°F", sku: "LG500-212", price: 15.00, unit: "ea" },
  ]},
  { id: "cat-p6", name: "Nozzle Cap", type: "product", products: [
    { id: "p6-1", name: "Nozzle Cap — Standard",   sku: "NC-STD", price: 2.25, unit: "ea" },
    { id: "p6-2", name: "Nozzle Cap — Heavy Duty", sku: "NC-HD",  price: 3.75, unit: "ea" },
  ]},
  { id: "cat-p7", name: "O-Ring", type: "product", products: [
    { id: "p7-1", name: "O-Ring — Valve Stem (10pk)", sku: "OR-VS10", price: 8.00,  unit: "pk"  },
    { id: "p7-2", name: "O-Ring — Cylinder Neck",     sku: "OR-CN",   price: 1.50,  unit: "ea"  },
    { id: "p7-3", name: "O-Ring Assortment Kit",      sku: "OR-KIT",  price: 22.00, unit: "kit" },
  ]},
  { id: "cat-p8",  name: "OPEN Extinguisher", type: "product", products: [
    { id: "p8-1", name: "Open — Custom Extinguisher", sku: "OPEN-EXT", price: 0, unit: "ea", description: "Custom / non-standard extinguisher" },
  ]},
  { id: "cat-p9",  name: "OPEN Part", type: "product", products: [
    { id: "p9-1", name: "Open — Misc Part", sku: "OPEN-PRT", price: 0, unit: "ea", description: "Custom / non-standard part" },
  ]},
  { id: "cat-p10", name: "Pull Pin", type: "product", products: [
    { id: "p10-1", name: "Pull Pin — Standard",   sku: "PP-STD",  price: 1.75, unit: "ea" },
    { id: "p10-2", name: "Pull Pin — Ring Style", sku: "PP-RING", price: 2.25, unit: "ea" },
  ]},
  { id: "cat-p11", name: "Service Collar", type: "product", products: [
    { id: "p11-1", name: "Service Collar — 2026", sku: "SC-2026", price: 0.85, unit: "ea" },
    { id: "p11-2", name: "Service Collar — 2025", sku: "SC-2025", price: 0.85, unit: "ea" },
  ]},
  { id: "cat-p12", name: "Tamper Seal", type: "product", products: [
    { id: "p12-1", name: "Tamper Seal — Red (100pk)",    sku: "TS-RED100", price: 12.00, unit: "pk" },
    { id: "p12-2", name: "Tamper Seal — Yellow (100pk)", sku: "TS-YEL100", price: 12.00, unit: "pk" },
  ]},
  { id: "cat-p13", name: "Valve Stem", type: "product", products: [
    { id: "p13-1", name: "Valve Stem — Standard", sku: "VS-STD", price: 6.50, unit: "ea" },
    { id: "p13-2", name: "Valve Stem — Brass",    sku: "VS-BRS", price: 9.00, unit: "ea" },
  ]},

  // ── Services ─────────────────────────────────────────────────────────────
  { id: "cat-s1", name: "6yr", type: "service", products: [
    { id: "s1-1", name: "6-Year Maintenance — Stored Pressure", sku: "6YR-SP",   price: 22.00, unit: "ea" },
    { id: "s1-2", name: "6-Year Maintenance — Cartridge",       sku: "6YR-CART", price: 28.00, unit: "ea" },
    { id: "s1-3", name: "6-Year Maintenance — CO2",             sku: "6YR-CO2",  price: 35.00, unit: "ea" },
  ]},
  { id: "cat-s2", name: "CT", type: "service", products: [
    { id: "s2-1", name: "Conductivity Test", sku: "CT-STD", price: 18.00, unit: "ea" },
  ]},
  { id: "cat-s3", name: "FE Inspection", type: "service", products: [
    { id: "s3-1", name: "Fire Extinguisher Annual Inspection",   sku: "FEI-ANN", price: 25.00, unit: "ea" },
    { id: "s3-2", name: "Fire Extinguisher Monthly Spot Check",  sku: "FEI-MON", price: 8.00,  unit: "ea" },
  ]},
  { id: "cat-s4", name: "Hydro Test", type: "service", products: [
    { id: "s4-1", name: "Hydrostatic Test — Standard",       sku: "HYD-STD", price: 35.00, unit: "ea" },
    { id: "s4-2", name: "Hydrostatic Test — Large Cylinder", sku: "HYD-LG",  price: 55.00, unit: "ea" },
    { id: "s4-3", name: "Hydrostatic Test — CO2",            sku: "HYD-CO2", price: 45.00, unit: "ea" },
  ]},
  { id: "cat-s5", name: "Labor", type: "service", products: [
    { id: "s5-1", name: "Standard Labor — Per Hour",       sku: "LBR-HR",  price: 85.00,  unit: "hr" },
    { id: "s5-2", name: "Emergency / After Hours — Per Hour", sku: "LBR-EM", price: 135.00, unit: "hr" },
    { id: "s5-3", name: "Travel Time — Per Hour",           sku: "LBR-TRV", price: 65.00,  unit: "hr" },
  ]},
  { id: "cat-s6",  name: "OPEN 6yr",     type: "service", products: [{ id: "s6-1",  name: "Open — 6yr Maintenance (Custom)",  sku: "OPEN-6YR",  price: 0, unit: "ea",  description: "Custom 6yr service" }]},
  { id: "cat-s7",  name: "OPEN FE",      type: "service", products: [{ id: "s7-1",  name: "Open — FE Service (Custom)",        sku: "OPEN-FE",   price: 0, unit: "ea",  description: "Custom FE service" }]},
  { id: "cat-s8",  name: "OPEN Hydro",   type: "service", products: [{ id: "s8-1",  name: "Open — Hydro Test (Custom)",        sku: "OPEN-HYD",  price: 0, unit: "ea",  description: "Custom hydro test" }]},
  { id: "cat-s9",  name: "OPEN Labor",   type: "service", products: [{ id: "s9-1",  name: "Open — Labor (Custom)",             sku: "OPEN-LBR",  price: 0, unit: "hr",  description: "Custom labor charge" }]},
  { id: "cat-s10", name: "OPEN MISC",    type: "service", products: [{ id: "s10-1", name: "Open — Miscellaneous (Custom)",     sku: "OPEN-MISC", price: 0, unit: "ea",  description: "Custom misc service" }]},
  { id: "cat-s11", name: "OPEN Recharge",type: "service", products: [{ id: "s11-1", name: "Open — Recharge (Custom)",          sku: "OPEN-RCH",  price: 0, unit: "ea",  description: "Custom recharge" }]},
  { id: "cat-s12", name: "OPEN SS",      type: "service", products: [{ id: "s12-1", name: "Open — SS Service (Custom)",        sku: "OPEN-SS",   price: 0, unit: "ea",  description: "Custom suppression service" }]},
  { id: "cat-s13", name: "Recharge", type: "service", products: [
    { id: "s13-1", name: "Recharge — ABC Dry Chemical", sku: "RCH-ABC", price: 18.00, unit: "lb" },
    { id: "s13-2", name: "Recharge — CO2",              sku: "RCH-CO2", price: 25.00, unit: "lb" },
    { id: "s13-3", name: "Recharge — Class K",          sku: "RCH-K",   price: 35.00, unit: "lb" },
    { id: "s13-4", name: "Recharge — Halotron",         sku: "RCH-HAL", price: 45.00, unit: "lb" },
  ]},
  { id: "cat-s14", name: "SS Inspection", type: "service", products: [
    { id: "s14-1", name: "Suppression System Semi-Annual Inspection", sku: "SSI-SEMI", price: 250.00, unit: "system" },
    { id: "s14-2", name: "Suppression System Annual Inspection",      sku: "SSI-ANN",  price: 450.00, unit: "system" },
  ]},
  { id: "cat-s15", name: "SSC", type: "service", products: [
    { id: "s15-1", name: "Suppression System Certification", sku: "SSC-CERT", price: 150.00, unit: "system" },
  ]},
];

// ─── Persistence ─────────────────────────────────────────────────────────────

const CATALOG_KEY = "tfpro_catalogs_v2";

export function loadCatalogs(): Catalog[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    return raw ? (JSON.parse(raw) as Catalog[]) : initialCatalogs;
  } catch {
    return initialCatalogs;
  }
}

export function saveCatalogs(catalogs: Catalog[]): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalogs));
}

export function resetCatalogsToDefault(): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(initialCatalogs));
}

// ─── Sitewide lookup helpers ──────────────────────────────────────────────────

export function getCatalogItem(sku: string): CatalogProduct | null {
  const catalogs = loadCatalogs();
  for (const cat of catalogs) {
    const found = cat.products.find(p => p.sku === sku);
    if (found) return found;
  }
  return null;
}

export function getCatalogPrice(sku: string): number | null {
  const item = getCatalogItem(sku);
  return item?.price ?? null;
}

export function getAllServiceItems(): CatalogProduct[] {
  return loadCatalogs()
    .filter(c => c.type === "service")
    .flatMap(c => c.products);
}

export function getAllProductItems(): CatalogProduct[] {
  return loadCatalogs()
    .filter(c => c.type === "product")
    .flatMap(c => c.products);
}
