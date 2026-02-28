import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("parking.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS spaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    status TEXT DEFAULT 'available', -- available, occupied, reserved
    type TEXT DEFAULT 'normal' -- normal, package
  );

  CREATE TABLE IF NOT EXISTS package_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT UNIQUE,
    has_package BOOLEAN DEFAULT 0,
    entry_time DATETIME,
    exit_time DATETIME,
    space_id INTEGER,
    FOREIGN KEY(space_id) REFERENCES spaces(id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plate_number TEXT,
    action TEXT, -- entry, exit
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    amount REAL DEFAULT 0,
    duration_half_days INTEGER DEFAULT 0
  );
`);

// Seed data if empty
const spaceCount = db.prepare("SELECT COUNT(*) as count FROM spaces").get() as { count: number };
if (spaceCount.count === 0) {
  const insertSpace = db.prepare("INSERT INTO spaces (code, type) VALUES (?, ?)");
  for (let i = 1; i <= 50; i++) {
    const type = i <= 15 ? 'package' : 'normal'; // 15 spaces reserved for packages
    insertSpace.run(`A-${i.toString().padStart(3, '0')}`, type);
  }

  // Seed Whitelist
  const insertWhitelist = db.prepare("INSERT INTO package_whitelist (plate_number, notes) VALUES (?, ?)");
  const whitelistPlates = [
    ['粤B88888', 'VIP游客 - 张先生'],
    ['京A00001', '长期合作旅行社'],
    ['沪C66666', '景区合作伙伴'],
    ['浙A12345', '家庭套餐 - 李女士']
  ];
  whitelistPlates.forEach(([plate, notes]) => insertWhitelist.run(plate, notes));

  // Seed some vehicles currently in the lot
  const now = new Date('2026-02-27T22:33:18-08:00');
  const insertVehicle = db.prepare("INSERT INTO vehicles (plate_number, has_package, entry_time, space_id) VALUES (?, ?, ?, ?)");
  const updateSpace = db.prepare("UPDATE spaces SET status = 'occupied' WHERE id = ?");
  const insertLog = db.prepare("INSERT INTO logs (plate_number, action, timestamp, amount, duration_half_days) VALUES (?, ?, ?, ?, ?)");

  const activeVehicles = [
    { plate: '粤B88888', hasPkg: 1, spaceId: 1, entryOffset: 2 }, // Entered 2 hours ago
    { plate: '京A00001', hasPkg: 1, spaceId: 2, entryOffset: 5 }, // Entered 5 hours ago
    { plate: '苏E99999', hasPkg: 0, spaceId: 16, entryOffset: 1 }, // Entered 1 hour ago
    { plate: '川A77777', hasPkg: 0, spaceId: 17, entryOffset: 8 }  // Entered 8 hours ago
  ];

  activeVehicles.forEach(v => {
    const entryTime = new Date(now.getTime() - v.entryOffset * 60 * 60 * 1000).toISOString();
    insertVehicle.run(v.plate, v.hasPkg, entryTime, v.spaceId);
    updateSpace.run(v.spaceId);
    insertLog.run(v.plate, 'entry', entryTime, 0, 0);
  });

  // Seed some historical logs
  const historicalLogs = [
    { plate: '粤B12345', action: 'entry', offset: 24 },
    { plate: '粤B12345', action: 'exit', offset: 12, amount: 20, duration: 1 },
    { plate: '京A88888', action: 'entry', offset: 48 },
    { plate: '京A88888', action: 'exit', offset: 36, amount: 40, duration: 2 },
    { plate: '沪A66666', action: 'entry', offset: 10 },
    { plate: '沪A66666', action: 'exit', offset: 2, amount: 20, duration: 1 }
  ];

  historicalLogs.forEach(l => {
    const timestamp = new Date(now.getTime() - l.offset * 60 * 60 * 1000).toISOString();
    insertLog.run(l.plate, l.action, timestamp, l.amount || 0, l.duration || 0);
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/stats", (req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM spaces").get() as any;
    const occupied = db.prepare("SELECT COUNT(*) as count FROM spaces WHERE status = 'occupied'").get() as any;
    const reserved = db.prepare("SELECT COUNT(*) as count FROM spaces WHERE status = 'reserved'").get() as any;
    const revenue = db.prepare("SELECT SUM(amount) as total FROM logs").get() as any;
    const whitelistCount = db.prepare("SELECT COUNT(*) as count FROM package_whitelist").get() as any;
    
    res.json({
      totalSpaces: total.count,
      occupiedSpaces: occupied.count,
      reservedSpaces: reserved.count,
      availableSpaces: total.count - occupied.count - reserved.count,
      totalRevenue: revenue.total || 0,
      whitelistCount: whitelistCount.count
    });
  });

  app.get("/api/whitelist", (req, res) => {
    const list = db.prepare("SELECT * FROM package_whitelist ORDER BY created_at DESC").all();
    res.json(list);
  });

  app.post("/api/whitelist", (req, res) => {
    const { plateNumber, notes } = req.body;
    try {
      db.prepare("INSERT INTO package_whitelist (plate_number, notes) VALUES (?, ?)").run(plateNumber, notes);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "该车牌已在套餐白名单中" });
    }
  });

  app.delete("/api/whitelist/:plate", (req, res) => {
    db.prepare("DELETE FROM package_whitelist WHERE plate_number = ?").run(req.params.plate);
    res.json({ success: true });
  });

  app.get("/api/spaces", (req, res) => {
    const spaces = db.prepare("SELECT * FROM spaces").all();
    res.json(spaces);
  });

  app.post("/api/reserve", (req, res) => {
    const { spaceId, status } = req.body;
    db.prepare("UPDATE spaces SET status = ? WHERE id = ?").run(status, spaceId);
    res.json({ success: true });
  });

  app.get("/api/vehicles", (req, res) => {
    const vehicles = db.prepare(`
      SELECT v.*, s.code as space_code 
      FROM vehicles v 
      LEFT JOIN spaces s ON v.space_id = s.id 
      WHERE v.exit_time IS NULL
    `).all();
    res.json(vehicles);
  });

  app.post("/api/entry", (req, res) => {
    const { plateNumber } = req.body;
    
    // Check if plate is in whitelist (Requirement 1: Visitor center registration)
    const whitelistEntry = db.prepare("SELECT * FROM package_whitelist WHERE plate_number = ?").get() as any;
    const hasPackage = !!whitelistEntry;

    // Find an available space
    // If package user, try to find a 'package' type space first
    let space;
    if (hasPackage) {
      space = db.prepare("SELECT id FROM spaces WHERE status = 'available' AND type = 'package' LIMIT 1").get() as any;
    }
    
    // Fallback to any available space if no package space or if normal user
    if (!space) {
      space = db.prepare("SELECT id FROM spaces WHERE status = 'available' LIMIT 1").get() as any;
    }
    
    if (!space) {
      return res.status(400).json({ error: "停车场已满，无可用车位" });
    }

    const entryTime = new Date().toISOString();
    db.prepare("INSERT INTO vehicles (plate_number, has_package, entry_time, space_id) VALUES (?, ?, ?, ?)")
      .run(plateNumber, hasPackage ? 1 : 0, entryTime, space.id);
    
    db.prepare("UPDATE spaces SET status = 'occupied' WHERE id = ?").run(space.id);
    
    db.prepare("INSERT INTO logs (plate_number, action, timestamp) VALUES (?, 'entry', ?)")
      .run(plateNumber, entryTime);

    res.json({ success: true, spaceId: space.id, hasPackage });
  });

  app.post("/api/exit", (req, res) => {
    const { plateNumber } = req.body;
    const vehicle = db.prepare("SELECT * FROM vehicles WHERE plate_number = ? AND exit_time IS NULL").get() as any;
    
    if (!vehicle) {
      return res.status(404).json({ error: "未找到该车辆在场记录" });
    }

    const exitTime = new Date().toISOString();
    const entryTime = new Date(vehicle.entry_time);
    const durationMs = new Date(exitTime).getTime() - entryTime.getTime();
    
    // Requirement 4: Charge per half-day (12 hours)
    const halfDayMs = 1000 * 60 * 60 * 12;
    const halfDays = Math.ceil(durationMs / halfDayMs);
    
    let amount = 0;
    if (!vehicle.has_package) {
      amount = halfDays * 20; // 20 units per half day
    }

    db.prepare("UPDATE vehicles SET exit_time = ? WHERE id = ?").run(exitTime, vehicle.id);
    db.prepare("UPDATE spaces SET status = 'available' WHERE id = ?").run(vehicle.space_id);
    
    db.prepare("INSERT INTO logs (plate_number, action, timestamp, amount, duration_half_days) VALUES (?, 'exit', ?, ?, ?)")
      .run(plateNumber, exitTime, amount, halfDays);

    res.json({ 
      success: true, 
      amount, 
      durationHalfDays: halfDays,
      hasPackage: !!vehicle.has_package,
      entryTime: vehicle.entry_time,
      exitTime
    });
  });

  app.get("/api/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50").all();
    res.json(logs);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
