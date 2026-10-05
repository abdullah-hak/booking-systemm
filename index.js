const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = 3000;
const MAX_SEATS = 200;

app.use(express.json());

// لوج بسيط يشخّص أي طلب يوصل للخادم
app.use((req, _res, next) => { console.log("→", req.method, req.url); next(); });

// يخدم ملفات الواجهة من مجلد public
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// مسار تجريبي لتجربة الحجز
app.post('/book', (req, res) => {
  console.log('تم استقبال طلب حجز:', req.body);
  res.json({ message: 'تم استلام الحجز بنجاح ✅' });
});

const db = new sqlite3.Database("./booking.db");

// إنشاء جدول الحجوزات إن لم يكن موجودًا
db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname  TEXT NOT NULL,
    nationalId TEXT NOT NULL,
    phone      TEXT NOT NULL,
    category   TEXT NOT NULL,
    seat       INTEGER NOT NULL,
    UNIQUE(category, seat)
  )
`);

// فحص صحة الخادم
app.get("/health", (_req, res) => res.json({ ok: true }));

// POST /book — إنشاء الحجز (تخصيص مقعد عشوائي غير محجوز)
app.post("/book", (req, res) => {
  const { fullname, nationalId, phone, category } = req.body || {};
  if (!fullname || !nationalId || !phone || !category) {
    return res.status(400).json({ message: "الرجاء تعبئة جميع الحقول" });
  }

  // اجلب المقاعد المحجوزة في هذه الفئة
  db.all(`SELECT seat FROM bookings WHERE category = ?`, [category], (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error", error: err.message });

    if (rows.length >= MAX_SEATS) {
      return res.status(409).json({ message: "تم حجز جميع المقاعد في هذه الفئة" });
    }

    const taken = rows.map(r => r.seat);

    // اختر مقعدًا عشوائيًا غير محجوز
    let seat;
    do { seat = Math.floor(Math.random() * MAX_SEATS) + 1; } while (taken.includes(seat));

    // أدخل الحجز
    db.run(
      `INSERT INTO bookings (fullname, nationalId, phone, category, seat) VALUES (?, ?, ?, ?, ?)`,
      [fullname, nationalId, phone, category, seat],
      function (err2) {
        if (err2) return res.status(500).json({ message: "DB insert error", error: err2.message });
        res.json({ id: this.lastID, fullname, nationalId, phone, category, seat });
      }
    );
  });
});

// (اختياري) عرض الحجوزات كـ JSON
app.get("/bookings", (_req, res) => {
  db.all(`SELECT * FROM bookings ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error", error: err.message });
    res.json(rows);
  });
});
app.use(express.json()); // يسمح بقراءة البيانات بصيغة JSON

// مسار استقبال الحجز
app.post('/book', (req, res) => {
  const data = req.body;
  console.log('تم استلام الحجز:', data);

  // رد بسيط مؤقت للتجربة
  res.json({ message: 'تم استلام الحجز بنجاح 🎟' });
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));