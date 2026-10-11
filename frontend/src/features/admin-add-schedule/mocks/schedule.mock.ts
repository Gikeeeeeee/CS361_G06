export const mockImportSchedulesCSV = async (_file: File, dryRun: boolean) => {
  return new Promise<{ status: number; body: any }>((resolve) => {
    setTimeout(() => {
      if (dryRun) {
        resolve({
          status: 200,
          body: {
            rows: [
              { row: 1, building: 'Engineering', room: 'E101', type: 'Course', title: 'Data Structures' },
              { row: 2, building: 'Science', room: 'S202', type: 'Activity', title: 'Science Camp' },
              { row: 3, building: 'Science', room: 'S303', type: 'Exam', title: 'Biology Midterm' },
            ]
          }
        });
      } else {
        resolve({
          status: 201,
          body: {
            created: 3
          }
        });
      }
    }, 800);
  });
};
