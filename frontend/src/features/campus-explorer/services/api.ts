// ตัวอย่าง Base URL สามารถปรับเปลี่ยนตามที่ Backend กำหนดได้เลยครับ
const API_BASE_URL = 'http://localhost:8080/api/v1'; // หรือ URL จริงของโปรเจกต์

export async function fetchAllBuildings() {
  try {
    const response = await fetch(`${API_BASE_URL}/buildings`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch buildings:', error);
    throw error;
  }
}