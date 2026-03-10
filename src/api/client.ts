import axios from 'axios';
import type { ChatRequest, ChatResponse, YoloDetectRequest, YoloDetectRtspRequest, YoloJobResponse, ContextData, ContextResponse, CameraData, CreateCameraData, UpdateCameraData } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add access token
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) {
                    throw new Error("No refresh token");
                }

                const { data } = await axios.post(
                    `${API_BASE_URL}/api/v1/auth/refresh`,
                    { refresh_token: refreshToken }
                );

                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);

                originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export const api = {
    // Auth
    signup: async (data: any) => {
        const response = await apiClient.post('/api/v1/auth/signup', data);
        return response.data;
    },
    login: async (data: any) => {
        const response = await apiClient.post('/api/v1/auth/login', data);
        return response.data;
    },
    me: async () => {
        const response = await apiClient.get('/api/v1/auth/me');
        return response.data;
    },
    logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
    },

    // LLM
    chat: async (payload: ChatRequest): Promise<ChatResponse> => {
        const response = await apiClient.post<ChatResponse>('/api/v1/llm/chat', payload);
        return response.data;
    },

    // YOLO Vision
    detectYoutube: async (url: string, sceneContext?: string): Promise<YoloJobResponse> => {
        const payload: YoloDetectRequest = {
            youtube_url: url,
            scene_context: sceneContext
        };
        const response = await apiClient.post<YoloJobResponse>('/api/v1/vision/detect-youtube', payload);
        return response.data;
    },

    detectRtsp: async (url: string, sceneContext?: string): Promise<YoloJobResponse> => {
        const payload: YoloDetectRtspRequest = {
            rtsp_url: url,
            scene_context: sceneContext
        };
        const response = await apiClient.post<YoloJobResponse>('/api/v1/vision/detect-rtsp', payload);
        return response.data;
    },

    getJobStatus: async (jobId: string): Promise<YoloJobResponse> => {
        const response = await apiClient.get<YoloJobResponse>(`/api/v1/vision/jobs/${jobId}`);
        return response.data;
    },

    stopJob: async (jobId: string): Promise<void> => {
        await apiClient.post(`/api/v1/vision/jobs/${jobId}/stop`);
    },

    // Context API
    getContext: async (): Promise<ContextResponse> => {
        const response = await apiClient.get<ContextResponse>('/api/v1/context/');
        return response.data;
    },

    createContext: async (payload: ContextData): Promise<ContextResponse> => {
        const response = await apiClient.post<ContextResponse>('/api/v1/context/', payload);
        return response.data;
    },

    updateContext: async (payload: ContextData): Promise<ContextResponse> => {
        const response = await apiClient.put<ContextResponse>('/api/v1/context/', payload);
        return response.data;
    },

    // Cameras API
    getCameras: async (): Promise<CameraData[]> => {
        const response = await apiClient.get<CameraData[]>('/api/v1/cameras/');
        return response.data;
    },

    createCamera: async (payload: CreateCameraData): Promise<CameraData> => {
        const response = await apiClient.post<CameraData>('/api/v1/cameras/', payload);
        return response.data;
    },

    updateCamera: async (cameraId: string, payload: UpdateCameraData): Promise<CameraData> => {
        const response = await apiClient.put<CameraData>(`/api/v1/cameras/${cameraId}`, payload);
        return response.data;
    },
};
