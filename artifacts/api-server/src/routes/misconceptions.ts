import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { db } from "@workspace/db";
import { misconceptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const misconceptionsRouter = Router();

// GET /admin/misconceptions
misconceptionsRouter.get("/admin/misconceptions", authenticate, requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  const { topic, subject } = req.query as Record<string, string>;
  let rows;
  if (topic) {
    rows = await db.select().from(misconceptionsTable).where(eq(misconceptionsTable.topic, topic));
  } else if (subject) {
    rows = await db.select().from(misconceptionsTable).where(eq(misconceptionsTable.subject, subject));
  } else {
    rows = await db.select().from(misconceptionsTable).limit(200);
  }
  res.json(rows);
});

// POST /admin/misconceptions
misconceptionsRouter.post("/admin/misconceptions", authenticate, requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  const { topic, subject, pattern, description, examples, severity } = req.body;
  if (!topic || !subject || !pattern || !description) {
    return res.status(400).json({ error: "topic, subject, pattern, description required" });
  }
  const [row] = await db.insert(misconceptionsTable).values({
    topic, subject, pattern, description,
    examples: examples ?? [],
    severity: severity ?? "medium",
    createdBy: req.userId,
  }).returning();
  res.status(201).json(row);
});

// PUT /admin/misconceptions/:id
misconceptionsRouter.put("/admin/misconceptions/:id", authenticate, requireRole("admin", "teacher"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { topic, subject, pattern, description, examples, severity } = req.body;
  await db.update(misconceptionsTable).set({ topic, subject, pattern, description, examples, severity }).where(eq(misconceptionsTable.id, id));
  res.json({ success: true });
});

// DELETE /admin/misconceptions/:id
misconceptionsRouter.delete("/admin/misconceptions/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  await db.delete(misconceptionsTable).where(eq(misconceptionsTable.id, id));
  res.json({ success: true });
});

// POST /admin/misconceptions/seed — seed default misconceptions
misconceptionsRouter.post("/admin/misconceptions/seed", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const seeds = [
    // Physics
    { topic: "Forces", subject: "Physics", pattern: "Confuses weight and mass", description: "Weight is a force (Newtons), mass is the amount of matter (kg). W = mg.", examples: ["weight = mass", "measured in kg"], severity: "high" },
    { topic: "Energy", subject: "Physics", pattern: "Mixing up kinetic and potential energy", description: "KE = ½mv², GPE = mgh. Objects in motion have KE; objects at height have GPE.", examples: ["kinetic = mgh", "potential = ½mv"], severity: "medium" },
    { topic: "Waves", subject: "Physics", pattern: "Confuses frequency and wavelength", description: "Speed = frequency × wavelength. Higher frequency = shorter wavelength (inverse relationship).", examples: ["frequency × wavelength = constant", "higher frequency = longer"], severity: "medium" },
    { topic: "Electricity", subject: "Physics", pattern: "Forgets to convert units", description: "Always check units: mA → A (÷1000), kΩ → Ω (×1000) before substituting.", examples: ["I = 20 A (should be 0.02 A)", "R = 2.2 kΩ substituted as 2.2"], severity: "high" },
    // Maths
    { topic: "Algebra", subject: "Mathematics", pattern: "Sign errors when expanding brackets", description: "-(a + b) = -a - b, not -a + b. Distribute the negative sign to every term.", examples: ["-(x+3) = -x+3", "-(2x-1) = -2x-1"], severity: "high" },
    { topic: "Fractions", subject: "Mathematics", pattern: "Adding fractions without common denominator", description: "You must find a common denominator before adding: a/b + c/d = (ad+bc)/(bd).", examples: ["1/2 + 1/3 = 2/5", "adding numerators and denominators separately"], severity: "high" },
    { topic: "Geometry", subject: "Mathematics", pattern: "Confuses area and perimeter", description: "Perimeter = total boundary length. Area = space enclosed. Different formulas and units.", examples: ["area of a rectangle = 2(l+w)", "perimeter = l×w"], severity: "medium" },
    { topic: "Trigonometry", subject: "Mathematics", pattern: "Using wrong trig ratio", description: "SOH CAH TOA: Sin=Opp/Hyp, Cos=Adj/Hyp, Tan=Opp/Adj. Always identify the sides first.", examples: ["sin = adj/hyp", "cos = opp/hyp"], severity: "high" },
    // Chemistry
    { topic: "Atomic Structure", subject: "Chemistry", pattern: "Confuses atomic number and mass number", description: "Atomic number = proton count. Mass number = protons + neutrons.", examples: ["atomic number = protons + neutrons", "mass number = protons only"], severity: "medium" },
    { topic: "Reactions", subject: "Chemistry", pattern: "Unbalanced equations", description: "Atoms must be conserved. Check each element on both sides and balance coefficients.", examples: ["H2 + O2 → H2O (unbalanced)", "adding subscripts to balance"], severity: "high" },
    { topic: "Bonding", subject: "Chemistry", pattern: "Confuses ionic and covalent bonding", description: "Ionic: metal + non-metal (electron transfer). Covalent: non-metal + non-metal (electron sharing).", examples: ["NaCl has covalent bonds", "H2O has ionic bonds"], severity: "medium" },
    // Biology
    { topic: "Cell Biology", subject: "Biology", pattern: "Confuses mitosis and meiosis", description: "Mitosis: 2 genetically identical cells (growth). Meiosis: 4 genetically unique cells (reproduction).", examples: ["meiosis for growth", "mitosis produces gametes"], severity: "high" },
    { topic: "Genetics", subject: "Biology", pattern: "Dominant vs recessive phenotype confusion", description: "If one dominant allele is present, the dominant phenotype shows. Recessive only shows when homozygous.", examples: ["Aa shows recessive trait", "aa shows dominant trait"], severity: "medium" },
  ];

  let inserted = 0;
  for (const seed of seeds) {
    try {
      await db.insert(misconceptionsTable).values({
        ...seed,
        createdBy: req.userId,
      }).onConflictDoNothing();
      inserted++;
    } catch { /* skip duplicates */ }
  }
  res.json({ success: true, inserted });
});
