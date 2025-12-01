import { auth } from "@/lib/firebase";

const API_BASE = "/api";

export async function getAuthToken(): Promise<string | null> {
    if (!auth || !auth.currentUser) return null;
    return auth.currentUser.getIdToken();
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
    const token = await getAuthToken();

    const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (token) {
        (headers as any)["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        if (response.status === 401) {
            if (typeof window !== 'undefined') {
                window.location.href = "/auth/login";
            }
            throw new Error("Session expired. Please login again.");
        }
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response.json();
}
