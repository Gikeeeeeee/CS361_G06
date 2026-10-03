import { apiClient, ApiError } from '../../../services/api/apiClient';

// Use import.meta.glob to dynamically check if the mock file exists
const mocks: Record<string, any> = import.meta.glob([
  '../mocks/schedule.mock.ts',
  '../../admin-add-schedule/mocks/schedule.mock.ts'
], { eager: true });
const mockModulePaths = Object.keys(mocks);
const hasMock = mockModulePaths.length > 0;

export async function importSchedulesCSV(file: File, dryRun: boolean) {
  // If mock folder/file exists, use the mock implementation
  if (hasMock) {
    const mockModule = mocks[mockModulePaths[0]];
    if (mockModule && mockModule.mockImportSchedulesCSV) {
      console.log(`[ScheduleService] Using MOCK API (Found ${mockModulePaths[0]})`);
      return mockModule.mockImportSchedulesCSV(file, dryRun);
    }
  }

  try {
    const endpoint = `/schedules/imports${dryRun ? "?dry_run=true" : ""}`;

    // ใช้ apiClient.post ที่เราเพิ่งอัปเดตไป
    // (มันจะจัดการ Header 'text/csv' ให้เองอัตโนมัติเพราะเรารู้ว่าเป็น File object)
    const response = await apiClient.post(endpoint, file);

    // ถ้าสำเร็จ: dryRun จะเป็น 200 (Preview), ถ้าบันทึกจริงจะเป็น 201 (Created)
    return { status: dryRun ? 200 : 201, body: response };

  } catch (error: any) {
    // ถ้า API ตอบกลับมาเป็น Error (400, 409) ตัว apiClient จะโยน ApiError ออกมา
    if (error instanceof ApiError) {
      return { status: error.status, body: error.body };
    }

    // กรณี Network พัง หรือ 500
    return { status: 500, body: { error: { message: "ระบบขัดข้อง ลองใหม่อีกครั้ง" } } };
  }
}