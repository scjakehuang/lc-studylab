/**
 * RAG API 客户端
 * 对应后端 /rag/* 接口
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface RagIndexInfo {
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  num_documents: number;
  store_type: string;
  embedding_model: string;
}

export interface RagSearchResult {
  content: string;
  metadata: Record<string, unknown>;
  score: number | null;
}

export interface RagQueryResponse {
  answer: string;
  sources: string[];
  retrieved_documents: Array<{
    content: string;
    metadata: Record<string, unknown>;
  }>;
}

export interface CreateIndexParams {
  name: string;
  directory_path: string;
  description?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  overwrite?: boolean;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .catch(() => ({ detail: res.statusText }));
    throw new Error(
      typeof detail.detail === "string"
        ? detail.detail
        : `HTTP ${res.status}`
    );
  }
  return res.json();
}

export const ragApi = {
  listIndexes: () => http<RagIndexInfo[]>("/rag/index/list"),

  getIndex: (name: string) =>
    http<RagIndexInfo>(`/rag/index/${encodeURIComponent(name)}`),

  createIndex: (params: CreateIndexParams) =>
    http<RagIndexInfo>("/rag/index", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  deleteIndex: (name: string) =>
    http<{ message: string }>(`/rag/index/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),

  query: (params: {
    index_name: string;
    query: string;
    k?: number;
    return_sources?: boolean;
  }) =>
    http<RagQueryResponse>("/rag/query", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  search: (params: {
    index_name: string;
    query: string;
    k?: number;
    score_threshold?: number;
  }) =>
    http<RagSearchResult[]>("/rag/search", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  health: () =>
    http<{ status: string; indexes_count: number; base_path: string }>(
      "/rag/health"
    ),
};

export const RAG_API_BASE_URL = API_BASE_URL;

