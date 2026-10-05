const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const API_VERSION = import.meta.env.VITE_API_VERSION || '/api/v1';

import { ApiCache } from './apiCache';

export class ApiError extends Error {
  status: number;
  body?: any; // เพิ่มตัวแปรเก็บรายละเอียด Error จาก Backend

  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body; // เก็บไว้เพื่อให้ UI ดึง error.details ไปใช้ต่อได้
    this.name = 'ApiError';
  }
}

// เพิ่ม options พิเศษสำหรับ cache
interface CustomRequestInit extends RequestInit {
  cacheTtl?: number; // ระบุ TTL เองได้ (ms)
  skipCache?: boolean; // บังคับให้ fetch ใหม่
}

// ฟังก์ชันกลาง (request) เพื่อรองรับทุก HTTP Method (GET, POST, PUT, DELETE)
async function request<T>(endpoint: string, options: CustomRequestInit = {}): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // ต่อ API_VERSION (เช่น /api/v1) เข้าไปอัตโนมัติ ตามที่เพื่อนในทีมเซ็ตไว้
  const url = BASE_URL.endsWith(API_VERSION) 
    ? `${BASE_URL}${cleanEndpoint}`
    : `${BASE_URL}${API_VERSION}${cleanEndpoint}`;

  // ตั้งค่า Headers พื้นฐาน (แต่ยอมให้เขียนทับได้)
  const headers = new Headers({
    'Accept': 'application/json',
  });

  // ถ้าไม่ได้ส่ง body เป็นไฟล์ดิบ ให้ใช้ JSON เป็นค่าเริ่มต้น
  if (!(options.body instanceof File)) {
    headers.set('Content-Type', 'application/json');
  }

  // รวม Header ที่ส่งเข้ามาทับ Header พื้นฐาน
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value as string);
    });
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // กรณีเกิด Error (4xx, 5xx)
  if (!response.ok) {
    let errorBody;
    try {
      // พยายามอ่าน JSON Body ที่ Backend ส่งมา (ที่มี code, message, details)
      errorBody = await response.json();
    } catch {
      errorBody = { error: { message: response.statusText } };
    }
    
    // โยน ApiError ออกไปพร้อมกับรายละเอียด (body) 
    throw new ApiError(
      response.status,
      errorBody?.error?.message || `API request failed: ${response.statusText}`,
      errorBody
    );
  }

  // กรณีสำเร็จ แต่ไม่มีข้อมูลตอบกลับ (เช่น 201, 204 บางกรณี) ป้องกัน JSON parse error
  const text = await response.text();
  if (!text) return {} as T;
  
  return JSON.parse(text);
}

export const apiClient = {
  request,

  // GET Method เดิม
  async get<T>(endpoint: string, options: CustomRequestInit = {}): Promise<T> {
    const cacheKey = `GET_${endpoint}`;
    
    // หากไม่ต้องการข้ามแคช ให้ลองดึงจากแคชก่อน
    if (!options.skipCache) {
      const cachedData = ApiCache.get<T>(cacheKey, options.cacheTtl);
      if (cachedData) {
        return cachedData;
      }
    }

    const data = await request<T>(endpoint, { ...options, method: 'GET' });
    
    // บันทึกข้อมูลลงแคช
    if (!options.skipCache) {
      ApiCache.set(cacheKey, data);
    }
    
    return data;
  },

  // POST Method ที่เพิ่มใหม่ (รองรับทั้ง JSON และการส่งไฟล์ดิบ)
  async post<T>(endpoint: string, data?: any, options: CustomRequestInit = {}): Promise<T> {
    const isFile = data instanceof File;
    
    // Invalidate related cache based on the base endpoint (e.g. /schedules)
    const basePath = endpoint.split('?')[0].split('/')[1] || endpoint.split('?')[0];
    ApiCache.invalidate(basePath);

    return request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFile ? data : JSON.stringify(data), // ถ้าเป็นไฟล์ให้ส่งดิบๆ ถ้าเป็น object ให้แปลงเป็น JSON string
      headers: {
        ...(isFile ? { 'Content-Type': 'text/csv' } : {}), // บังคับ Content-Type ให้ไฟล์ CSV
        ...options.headers,
      },
    });
  },

  // PUT Method
  async put<T>(endpoint: string, data?: any, options: CustomRequestInit = {}): Promise<T> {
    const basePath = endpoint.split('?')[0].split('/')[1] || endpoint.split('?')[0];
    ApiCache.invalidate(basePath);
    
    return request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
      headers: {
        ...options.headers,
      },
    });
  },

  // DELETE Method
  async delete<T>(endpoint: string, options: CustomRequestInit = {}): Promise<T> {
    const basePath = endpoint.split('?')[0].split('/')[1] || endpoint.split('?')[0];
    ApiCache.invalidate(basePath);
    
    return request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  },
};