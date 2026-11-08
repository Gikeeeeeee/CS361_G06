import { apiClient, ApiError } from '../../../services/api/apiClient';
import { ApiCache } from '../../../services/api/apiCache';

const IMPORTS = '/api/v1/schedules/imports';
const POLL_MS = 2000;
// Worker lease (330 s) + one retry window: after this the backend reports FAILED.
const GIVE_UP_MS = 12 * 60 * 1000;

interface ImportJob {
  job_id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  result: any;
  error: any;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * US1: Import Schedules from CSV File (#241: runs as a background job)
 *
 * POST answers 202 {job_id}; we poll GET /imports/{jobId} until it finishes.
 * Callers keep the old contract: 200 (preview) / 201 (created) with the
 * result as body, or the error status with { error: {code, message, details} }.
 * @param file - CSV File object
 * @param dryRun - true for Preview (200), false for actual Create (201)
 */
export async function importSchedulesCSV(file: File, dryRun: boolean) {
  try {
    const submitted = await apiClient.post<{ data: ImportJob }>(
      `${IMPORTS}${dryRun ? '?dry_run=true' : ''}`,
      file,
    );
    const deadline = Date.now() + GIVE_UP_MS;

    for (;;) {
      await sleep(POLL_MS);
      const { data: job } = await apiClient.get<{ data: ImportJob }>(
        `${IMPORTS}/${submitted.data.job_id}`,
        { skipCache: true },
      );

      if (job.status === 'COMPLETED') {
        if (!dryRun) ApiCache.invalidate('schedules'); // the worker wrote new rows
        return { status: dryRun ? 200 : 201, body: job.result };
      }
      if (job.status === 'FAILED') {
        return { status: job.error?.code === 'SCHEDULE_CONFLICT' ? 409 : 400, body: { error: job.error } };
      }
      if (Date.now() > deadline) {
        return {
          status: 504,
          body: { error: { message: 'Import is still running. Check the schedules again in a few minutes.' } },
        };
      }
    }
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
