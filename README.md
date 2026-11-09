# Smart Faculty Navigator with Schedule Related Search


## Project Vision

เป็นระบบกลางที่ช่วยให้คนในคณะตอบได้ว่า "ต้องไปที่ไหน เมื่อไร และไปอย่างไร" จากระบบเดียว โดยเริ่มจากข้อมูลสถานที่ (Information Service) แล้วค่อยๆ ขยายไปสู่ข้อมูลตารางเรียน/ตารางสอบ/กิจกรรม การค้นหาตามวัตถุประสงค์ การนำทาง และการเชื่อมกับปฏิทินส่วนตัว

## Primary User

**บุคคลภายในคณะ (Internal Users)**

* นักศึกษา, อาจารย์ และเจ้าหน้าที่ ที่ต้องการเดินทางไปยังห้องหรือจุดบริการที่ตนไม่คุ้นเคย
* ช่วยอำนวยความสะดวกสำหรับผู้มาใหม่ หรือผู้ที่ไม่สะดวกถามข้อมูลจากผู้อื่นโดยตรง

## Problem

**Problem Statement**
บุคคลภายใน/นอกคณะไม่สามารถรู้ล่วงหน้าได้ว่า ห้องหรือจุดบริการที่ตนต้องไปนั้นอยู่บริเวณใด และมีสภาพหรือสิ่งอำนวยความสะดวกอะไรบ้าง ทำให้ต้องพึ่งพาการถามคนอื่นหรือเดินหาหน้างาน และไม่สามารถวางแผนการเดินทางล่วงหน้าได้

**Desired Outcome**
* บุคคลภายในสามารถค้นหาข้อมูลอาคาร ห้อง และจุดบริการได้ด้วยตัวเองตลอดเวลา
* วางแผนล่วงหน้าก่อนออกเดินทางได้ (เช่น รู้ว่าห้องมีแอร์จึงเตรียมเสื้อกันหนาว)
* ลด Workload ของเจ้าหน้าที่ในการตอบคำถามเดิมๆ เรื่องตำแหน่งห้อง


## V1 Goal
- ให้บริการข้อมูลสถานที่และจุดบริการแบบ Read-Only โดยไม่ต้องเข้าสู่ระบบ (No Authentication Required) เพื่อให้ผู้ใช้ (นักศึกษา, อาจารย์, เจ้าหน้าที่) ค้นหาและดูข้อมูลสถานที่จากชื่ออาคาร/ชื่อห้อง และเข้าใจตำแหน่งของจุดหมายได้ด้วยตนเองก่อนเดินทางไปถึง (รองรับภาษา TH / EN)
- ครอบคลุมเฉพาะอาคาร บร.3 (LC3) และ บร.4 (LC4)
- แสดงข้อมูลชื่ออาคาร, ชื่อและรหัสห้อง, รายละเอียดสิ่งอำนวยความสะดวกภายในห้อง (แอร์, พัดลม, โปรเจกเตอร์, ไวท์บอร์ด, คอมพิวเตอร์, ปลั๊กไฟ ฯลฯ), จุดอำนวยความสะดวกของอาคาร (ห้องน้ำ, จุดกดน้ำ, ลิฟต์, บันได), ผังอาคารแต่ละชั้น (Floor Plan) และรูปภาพห้องประกอบ

## V1 Out of Scope
- ระบบรีวิวหรือการให้คะแนนห้อง/สถานที่ (Review / Rating)
- ข้อมูลกิจกรรม ตารางสอบ หรือตารางเรียน (Event / Timetable)
- ระบบสมาชิก ล็อกอิน หรือการแบ่งสิทธิ์ผู้ใช้ (Authentication / Roles)
- ระบบนำทางแบบ Turn-by-Turn หรือ Real-time Indoor Positioning
- การเชื่อมต่อกับปฏิทินส่วนตัว (Calendar Export)
- ระบบ Back-office ให้เจ้าหน้าที่แก้ไขข้อมูลผ่านหน้าจอ (V1 ใช้การนำเข้าข้อมูลแบบ Manual โดยทีมงาน)
- อาคารอื่นๆ นอกเหนือจาก บร.3 และ บร.4

## V1 Known Issues (V1 KI)
- **การแสดงข้อมูลอาคารและผังชั้น:** มีการแสดงรายการชั้น แต่ไม่มีการแสดงรายละเอียดผังอาคาร (Floor Plan) บนหน้าข้อมูลอาคาร, ไม่มีชื่ออาคารภาษาไทย/อังกฤษอย่างเป็นทางการ (มีเฉพาะชื่อย่อ), ไม่มีข้อมูล Landmark และคำอธิบายประวัติอาคาร (Description)
- **ระบบค้นหา:** หน้าแรกค้นหาได้เฉพาะอาคารและชื่อย่อห้อง, การค้นหาในระดับชั้นรองรับเฉพาะ name / number / type ยังไม่รองรับการค้นหาด้วยเงื่อนไขคุณสมบัติอื่นๆ ของห้อง
- **โครงสร้างข้อมูลและฐานข้อมูล:** การจัดเก็บข้อมูลโครงสร้างอาคารเป็น JSON ไฟล์เดียวบน S3 มีขนาดใหญ่เกินไป (2,000–2,500 บรรทัด) ทำให้ยากต่อการดูแลรักษา ค้นหาช้า ขาดระบบดัชนี (Index) และเสี่ยงต่อการเกิด Lost Updates เมื่อมีการแก้ไขข้อมูลพร้อมกัน จึงจำเป็นต้องย้ายไประบบ Database ในเวอร์ชันถัดไป
- **API & Architecture Contract:** มีปัญหา API/Domain Model Mismatch ระหว่าง Frontend และ Backend, ขาดการกำหนด Prefix `/api/v1` บน Endpoint ร่วมกันตั้งแต่ต้น และยังไม่มี Automated Test Suite ใน Repository สำหรับตรวจสอบความถูกต้องของระบบโดยอัตโนมัติ


## V2 Goal
- User สามารถได้รับข้อมูล Location ที่ครบถ้วนมากยิ่งขึ้นได้แก่ ข้อมูล อาคาร, ชั้น, ห้อง, และ Schedule กิจกรรม เวลาเรียน คาบสอบ ที่จะเกิดขึ้นในห้อง
- ผู้ใช้สามารถ Add, Edit, Delete หรือ Bulk Import ข้อมูล Schedule ของห้องได้
- ผู้ใช้สามารถ Search on purpose ได้ด้วย ชื่อรายวิชา การสอบ กิจกรรม

## V2 Out of Scope
- Authentication/Authorization
- Complexity Search เช่น หาตึกห้องที่จะสอบวิชานี้ในช่วงเวลาจุดนี้ถึงจุดนี้
- Bulk import schedule จะรองรับเฉพาะ csv และ Column ตามที่ App กำหนดเท่านั้น


## V3 Goal
- ระบบยืนยันตัวตนและการจัดการสิทธิ์ผู้ใช้งาน (User Authentication & Role Management) ผ่าน Supabase (PostgreSQL) โดยแบ่งกลุ่มผู้ใช้ตามบทบาท (Role-Based Access Control: RBAC) ได้แก่ STUDENT, TEACHER, STAFF, ADMIN
- ระบบบันทึกสถานที่และตารางที่สนใจ (User Bookmarks - US2) เพื่อให้ผู้ใช้สามารถบันทึกห้องเรียนหรือกิจกรรมโปรดไว้ดูย้อนหลังได้ในบัญชีของตนเอง
- ระบบส่งออกกำหนดการเข้าสู่ปฏิทินส่วนตัว (Calendar Export - US3) เพื่อดาวน์โหลดกำหนดการ/ตารางเรียนในรูปแบบไฟล์มาตรฐาน iCalendar (.ics)
- ระบบสร้าง Token เพื่อแชร์ตำแหน่งสถานที่และกำหนดการ (Share Location / Schedule Token - US4) ให้ผู้อื่นสามารถเปิดดูพิกัดได้จากภายนอก
- กระบวนการสร้างและอนุมัติเผยแพร่ตารางกิจกรรม (Schedule Publishing Workflow): เจ้าหน้าที่ (Staff) เป็นผู้สร้างร่างกำหนดการ และผู้ดูแลระบบ (Admin) เป็นผู้อนุมัติเพื่อเผยแพร่ (Publish) แสดงผลสู่สาธารณะ

## V3 Out of Scope
- การจัดการสิทธิ์ผู้ใช้งานระดับย่อยผ่านหน้าจอเว็บ (Granular Permissions UI: แอดมินจัดการสิทธิ์ผ่าน Supabase Dashboard โดยตรง)
- การสร้างบทบาท (Custom Role) เพิ่มเติมนอกเหนือจาก 4 บทบาทหลักที่ระบบกำหนด


## V4 Goal
- พัฒนาระบบนำทางภายในอาคาร (Indoor Navigation - US1) โดยใช้โครงสร้างข้อมูลแบบกราฟตามแนวคิด Corridor-Spine Routing (ตาราง Navigation_Node และ Corridor_Edge) เพื่อคำนวณหาเส้นทางที่สั้นที่สุด (Shortest Path) ด้วยอัลกอริทึม Dijkstra บน In-Memory RAM
- ระบบจัดการสถานะจุดและเส้นทางแบบไดนามิก (Dynamic Status Management - US2) รองรับสถานะ ACTIVE, BLOCKED, CLOSED, MAINTENANCE เพื่อให้อัลกอริทึมคำนวณและปรับเปลี่ยนเส้นทางหลบเลี่ยงพื้นที่ปิดปรับปรุงหรือลิฟต์/บันไดที่ชำรุดได้แบบ Real-time
- คำนวณตำแหน่งห้องเทียบกับโถงทางเดิน (side: LEFT / RIGHT, sequence_order) และสร้างชุดคำสั่งแนะนำการก้าวเดิน (Turn-by-turn text instructions)
- แสดงผลเส้นทางและจุด Checkpoint บนไฟล์แผนที่ SVG ผ่านพิกัดที่แม่นยำ (svg_x, svg_y)

## V4 Out of Scope
- ระบบเสียงนำทางแบบ Real-time (Turn-by-turn Voice Guidance)
- ระบบตรวจจับตำแหน่งอัตโนมัติภายในอาคาร (Real-time Indoor Positioning ผ่าน Wi-Fi, Bluetooth Beacons หรือ UWB โดยใน V4 ใช้การสแกน QR Code เพื่อระบุจุดตั้งต้น start_node)
- การนำทางแบบต่อเนื่องภายนอกอาคารถึงภายในอาคารแบบไร้รอยต่อ (Seamless Outdoor-to-Indoor Navigation)


## V5 Goal
- พัฒนาระบบ Automation สำหรับ CI/CD Pipeline และ Deployment Hardening บน GitHub Actions เพื่อให้กระบวนการตรวจสอบและปล่อยระบบมีความปลอดภัย ทำซ้ำได้ และตรวจสอบย้อนกลับได้ (Reproducible & Verifiable)
- แบ่งแยกสถาปัตยกรรมโครงสร้างพื้นฐาน (Infrastructure as Code: IaC) ผ่าน Terraform ออกเป็น 2 Stacks ชัดเจน ได้แก่ Frontend Stack (`terraform/frontend` สำหรับ S3 และ CloudFront) และ Backend Stack (`terraform/terraform-backend` สำหรับ API Gateway, Lambda, DynamoDB และ OpenSearch)
- กำหนดนโยบายการปล่อยระบบเฉพาะบนกิ่งหลัก (Main-only CD) โดยทุก Pull Request ต้องผ่านการตรวจสอบ Automated CI (Linting, TypeScript build, Security audit และ Terraform validate) ทั้งสอง Stacks
- สร้างกลไกความปลอดภัยในการ Deploy ฝั่ง Backend ด้วยสคริปต์ตรวจสอบความปลอดภัย (`deployment_guard.py`) และการจำลองผลลัพธ์ล่วงหน้า (Backend Dry-run) เพื่อป้องกันการทำลายข้อมูลจริงหรือการแทนที่ Resource บน AWS โดยไม่เจตนา
- เพิ่มขั้นตอนการตรวจสอบความถูกต้องของไฟล์ SVG ผังอาคารก่อนการ Deploy Frontend (`frontend_release.py`) และขั้นตอนทดสอบการทำงานของ API อัตโนมัติหลังการปล่อยระบบ (Post-Deployment Smoke Tests: `smoke_test.py`)

## V5 Out of Scope
- การทำ Automatic Production Apply สำหรับ Backend Stack (กำหนดให้ผ่านการรัน Dry-run และ Manual Verification ก่อนเพื่อความปลอดภัยขั้นสูงสุด)
- การทำ Multi-Region Disaster Recovery หรือ Active-Active High Availability
- การทำ Canary หรือ Blue-Green Deployment ในระดับ Cloud Infrastructure
