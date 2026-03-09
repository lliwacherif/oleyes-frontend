export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ContextData {
    id?: string;
    user_id?: string;
    business_type?: string;
    business_name?: string;
    short_description?: string;
    number_of_locations?: string;
    estimated_number_of_cameras?: string;
    business_size?: string;
    camera_type?: string;
    theft_detection?: boolean;
    suspicious_behavior_detection?: boolean;
    loitering_detection?: boolean;
    employee_monitoring?: boolean;
    customer_behavior_analytics?: boolean;
    context_text?: string;
    environment_type?: string;
    created_at?: string;
    updated_at?: string;
}

export type ContextResponse = ContextData;

export interface CameraData {
    id: string;
    user_id: string;
    name: string;
    rtsp_url: string;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreateCameraData {
    name: string;
    rtsp_url: string;
    is_active: boolean;
}

export interface UpdateCameraData {
    name?: string;
    rtsp_url?: string;
    is_active?: boolean;
}

export interface ChatRequest {
    messages: Message[];
    max_tokens?: number;
    temperature?: number;
    top_p?: number;
    presence_penalty?: number;
    scene_context?: string;
}

export interface ChatResponse {
    model: string;
    content: string;
}

export interface YoloDetectRequest {
    youtube_url: string;
    callback_url?: string;
    scene_context?: string;
}

export interface YoloJobResponse {
    job_id: string;
    status: 'queued' | 'running' | 'done' | 'failed' | 'error';
    detail: string;
    result: YoloJobResult | null;
    error: string | null;
}

export interface YoloJobResult {
    frames: number;
    detections: number;
    data?: any;
}

// Stream specific types
export interface YoloDetection {
    class_id: number;
    class_name: string;
    confidence: number;
    xyxy: [number, number, number, number];
}

export interface YoloFrameEvent {
    frame_index: number;
    timestamp: number;
    vectors?: number[][];
    frame_jpeg_b64?: string;
    scene_text?: string;
}

export interface YoloEvent {
    // Single event fields (legacy/backwards compat)
    frame_index?: number;
    timestamp?: number;
    vectors?: number[][];
    detections?: YoloDetection[];
    frame_jpeg_b64?: string;

    // Batch support
    batch?: YoloFrameEvent[];
}

export interface LogicObject {
    track_id: number;
    speed: number;
    zone: string;
    loiter_seconds: number;
}

export interface LogicOutput {
    high_priority: boolean;
    threat_score: number;
    summary_text: string;
    scene_text?: string;
    objects: LogicObject[];
    armed_subjects: string[]; // e.g. "Subject #1 (Gun)"
    fighting_pairs: string[]; // e.g. "Subject #2 vs #3"
}

export interface YoloStreamMessage {
    status: 'running' | 'done' | 'error' | 'failed';
    frames: number;
    detections: number;
    last_event?: YoloEvent;
    logic?: LogicOutput;
    analysis?: {
        text: string;
    };
}
