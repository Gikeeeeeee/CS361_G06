import { apiClient, ApiError } from '../../../services/api/apiClient';

/**
 * US1: Import Schedules from CSV File
 * @param file - CSV File object
 * @param dryRun - true for Preview (200), false for actual Create (201)
 */
export async function importSchedulesCSV(file: File, dryRun: boolean) {
  try {
    const endpoint = `/api/v1/schedules/imports${dryRun ? '?dry_run=true' : ''}`;
    const response = await apiClient.post(endpoint, file);
    return { status: dryRun ? 200 : 201, body: response };
  } catch (error: any) {
    if (error instanceof ApiError) {
      return { status: error.status, body: error.body };
    }
    return {
      status: 500,
      body: { error: { message: error?.message || 'Network error, please try again.' } },
    };
  }
}
