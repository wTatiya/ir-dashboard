# Incident Dashboard (Thai)

โครงงานนี้เป็นแดชบอร์ดอุบัติการณ์ที่รันบน **GitHub Pages** และใช้ไฟล์ CSV ภายใน repo เป็นฐานข้อมูล

## โครงสร้างไฟล์
```
/
├─ index.html               # หน้าแดชบอร์ดภาษาไทย
└─ data/
   └─ incidents.csv         # ข้อมูลเหตุการณ์ (อัปเดตด้วยการแทนที่ไฟล์นี้)
```

## การใช้งาน
1) เปิด Settings → Pages ของ repository แล้วตั้ง Source เป็น `main` และโฟลเดอร์ `/(root)`
2) Commit/Push ไฟล์ทั้งหมดในโครงสร้างด้านบน
3) เปิด URL GitHub Pages เพื่อใช้งาน

## การอัปเดตข้อมูล
- ส่งออกข้อมูลจาก Google Sheets เป็น CSV แล้วตั้งชื่อ `incidents.csv`
- แทนที่ไฟล์ในโฟลเดอร์ `data/` แล้ว commit
- หน้าเว็บจะดึง CSV ใหม่อัตโนมัติเมื่อ refresh

## ระบบเข้าสู่ระบบแบบง่าย
ภายใน `index.html` มีตัวแปร `EMPLOYEE_IDS` สำหรับ whitelist รหัสพนักงาน 7 หลัก
แก้ไขรายการใน array ดังนี้:
```js
const EMPLOYEE_IDS = [
  "1234567",
  "7654321"
];
```
