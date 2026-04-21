"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RefreshCw,
  Database,
  Search,
  MessageSquare,
  FileText,
  Loader2,
} from "lucide-react";
import {
  ragApi,
  type RagIndexInfo,
  type RagQueryResponse,
  type RagSearchResult,
} from "@/lib/api-rag";

export default function RagPage() {
  // ---------------- 索引列表 ----------------
  const [indexes, setIndexes] = useState<RagIndexInfo[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);

  // ---------------- 创建索引对话框 ----------------
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newIndex, setNewIndex] = useState({
    name: "",
    directory_path: "data/documents/test",
    description: "",
    chunk_size: 1000,
    chunk_overlap: 200,
    overwrite: false,
  });

  // ---------------- 查询/检索 ----------------
  const [query, setQuery] = useState("");
  const [k, setK] = useState(4);
  const [tab, setTab] = useState<"query" | "search">("query");
  const [running, setRunning] = useState(false);
  const [queryResult, setQueryResult] = useState<RagQueryResponse | null>(null);
  const [searchResult, setSearchResult] = useState<RagSearchResult[]>([]);

  // ---------------- 加载索引列表 ----------------
  const fetchIndexes = useCallback(async () => {
    setLoadingList(true);
    try {
      const list = await ragApi.listIndexes();
      setIndexes(list);
      if (list.length > 0 && !selectedIndex) {
        setSelectedIndex(list[0].name);
      }
      if (selectedIndex && !list.some((i) => i.name === selectedIndex)) {
        setSelectedIndex(list[0]?.name ?? null);
      }
    } catch (e) {
      toast.error("加载索引列表失败", {
        description: (e as Error).message,
      });
    } finally {
      setLoadingList(false);
    }
  }, [selectedIndex]);

  useEffect(() => {
    fetchIndexes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- 创建索引 ----------------
  const handleCreate = async () => {
    if (!newIndex.name.trim() || !newIndex.directory_path.trim()) {
      toast.error("名称和文档目录不能为空");
      return;
    }
    setCreating(true);
    try {
      await ragApi.createIndex(newIndex);
      toast.success(`索引 "${newIndex.name}" 创建成功`);
      setCreateOpen(false);
      setNewIndex({
        ...newIndex,
        name: "",
        description: "",
      });
      await fetchIndexes();
      setSelectedIndex(newIndex.name);
    } catch (e) {
      toast.error("创建索引失败", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  // ---------------- 删除索引 ----------------
  const handleDelete = async (name: string) => {
    if (!confirm(`确定删除索引 "${name}"？此操作不可恢复。`)) return;
    try {
      await ragApi.deleteIndex(name);
      toast.success(`索引 "${name}" 已删除`);
      if (selectedIndex === name) setSelectedIndex(null);
      await fetchIndexes();
    } catch (e) {
      toast.error("删除失败", { description: (e as Error).message });
    }
  };

  // ---------------- 查询 / 检索 ----------------
  const handleRun = async () => {
    if (!selectedIndex) {
      toast.error("请先选择一个索引");
      return;
    }
    if (!query.trim()) {
      toast.error("请输入问题");
      return;
    }
    setRunning(true);
    setQueryResult(null);
    setSearchResult([]);
    try {
      if (tab === "query") {
        const res = await ragApi.query({
          index_name: selectedIndex,
          query,
          k,
          return_sources: true,
        });
        setQueryResult(res);
      } else {
        const res = await ragApi.search({
          index_name: selectedIndex,
          query,
          k,
        });
        setSearchResult(res);
      }
    } catch (e) {
      toast.error("请求失败", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  };

  const currentIndex = indexes.find((i) => i.name === selectedIndex);

  return (
    <AppLayout>
      <div className="flex h-full overflow-hidden">
        {/* ============== 左侧：索引列表 ============== */}
        <aside className="w-72 shrink-0 border-r bg-muted/20 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="font-semibold">索引列表</span>
              <Badge variant="secondary">{indexes.length}</Badge>
            </div>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={fetchIndexes}
                disabled={loadingList}
                title="刷新"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`}
                />
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" title="新建索引">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>新建 RAG 索引</DialogTitle>
                    <DialogDescription>
                      从指定目录加载文档并建立向量索引
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">索引名称 *</label>
                      <Input
                        placeholder="my_docs"
                        value={newIndex.name}
                        onChange={(e) =>
                          setNewIndex({ ...newIndex, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">
                        文档目录 *（相对 backend/）
                      </label>
                      <Input
                        placeholder="data/documents/test"
                        value={newIndex.directory_path}
                        onChange={(e) =>
                          setNewIndex({
                            ...newIndex,
                            directory_path: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">描述</label>
                      <Input
                        placeholder="可选"
                        value={newIndex.description}
                        onChange={(e) =>
                          setNewIndex({
                            ...newIndex,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm font-medium">
                          chunk_size
                        </label>
                        <Input
                          type="number"
                          value={newIndex.chunk_size}
                          onChange={(e) =>
                            setNewIndex({
                              ...newIndex,
                              chunk_size: Number(e.target.value) || 1000,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">
                          chunk_overlap
                        </label>
                        <Input
                          type="number"
                          value={newIndex.chunk_overlap}
                          onChange={(e) =>
                            setNewIndex({
                              ...newIndex,
                              chunk_overlap: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newIndex.overwrite}
                        onChange={(e) =>
                          setNewIndex({
                            ...newIndex,
                            overwrite: e.target.checked,
                          })
                        }
                      />
                      覆盖已存在索引
                    </label>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setCreateOpen(false)}
                      disabled={creating}
                    >
                      取消
                    </Button>
                    <Button onClick={handleCreate} disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          构建中...
                        </>
                      ) : (
                        "创建"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {indexes.length === 0 && !loadingList && (
                <div className="text-center text-sm text-muted-foreground py-12 px-4">
                  暂无索引
                  <br />
                  点击右上角 + 新建
                </div>
              )}
              {indexes.map((idx) => (
                <button
                  key={idx.name}
                  onClick={() => setSelectedIndex(idx.name)}
                  className={`w-full text-left rounded-md px-3 py-2 hover:bg-accent transition-colors group ${
                    selectedIndex === idx.name ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">
                      {idx.name}
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      className="opacity-0 group-hover:opacity-100 cursor-pointer p-1 hover:bg-destructive/20 rounded inline-flex items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(idx.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(idx.name);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {idx.num_documents} chunks
                  </div>
                  {idx.description && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {idx.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* ============== 右侧：查询 & 结果 ============== */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selectedIndex ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              请从左侧选择或新建一个索引
            </div>
          ) : (
            <>
              {/* 当前索引信息 */}
              <div className="border-b px-6 py-4">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold">{currentIndex?.name}</h2>
                  <Badge variant="outline">
                    {currentIndex?.num_documents} 文档块
                  </Badge>
                  <Badge variant="outline">{currentIndex?.store_type}</Badge>
                  <Badge variant="outline">{currentIndex?.embedding_model}</Badge>
                </div>
                {currentIndex?.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {currentIndex.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  创建于 {currentIndex?.created_at} · 更新于{" "}
                  {currentIndex?.updated_at}
                </p>
              </div>

              {/* 查询输入区 */}
              <div className="px-6 py-4 border-b space-y-3">
                <Tabs
                  value={tab}
                  onValueChange={(v) => setTab(v as "query" | "search")}
                >
                  <TabsList>
                    <TabsTrigger value="query">
                      <MessageSquare className="h-4 w-4 mr-1" />
                      RAG 问答
                    </TabsTrigger>
                    <TabsTrigger value="search">
                      <Search className="h-4 w-4 mr-1" />
                      纯检索
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="flex gap-2">
                  <Textarea
                    placeholder={
                      tab === "query"
                        ? "提出基于知识库的问题，例如：什么是机器学习？"
                        : "输入检索关键词，例如：神经网络"
                    }
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    rows={2}
                    className="flex-1 resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleRun();
                      }
                    }}
                  />
                  <div className="flex flex-col gap-2 w-32">
                    <div className="text-xs text-muted-foreground">Top-K</div>
                    <Input
                      type="number"
                      value={k}
                      min={1}
                      max={20}
                      onChange={(e) => setK(Number(e.target.value) || 4)}
                    />
                    <Button
                      onClick={handleRun}
                      disabled={running}
                      className="mt-auto"
                    >
                      {running ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          运行
                        </>
                      ) : (
                        "运行"
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  快捷键：⌘/Ctrl + Enter 运行
                </p>
              </div>

              {/* 结果区 */}
              <ScrollArea className="flex-1">
                <div className="px-6 py-4 space-y-4">
                  {tab === "query" && queryResult && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            回答
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                            {queryResult.answer}
                          </div>
                        </CardContent>
                      </Card>

                      {queryResult.retrieved_documents.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              引用文档（
                              {queryResult.retrieved_documents.length}）
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {queryResult.retrieved_documents.map((doc, i) => (
                              <div
                                key={i}
                                className="border rounded-md p-3 bg-muted/30"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="secondary">#{i + 1}</Badge>
                                  {doc.metadata?.source ? (
                                    <span className="text-xs text-muted-foreground truncate">
                                      {String(doc.metadata.source)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="text-sm whitespace-pre-wrap line-clamp-6">
                                  {doc.content}
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}

                  {tab === "search" && searchResult.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          检索结果（{searchResult.length}）
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {searchResult.map((r, i) => (
                          <div
                            key={i}
                            className="border rounded-md p-3 bg-muted/30"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary">#{i + 1}</Badge>
                              {r.score !== null && (
                                <Badge variant="outline">
                                  score: {r.score.toFixed(4)}
                                </Badge>
                              )}
                              {r.metadata?.source ? (
                                <span className="text-xs text-muted-foreground truncate">
                                  {String(r.metadata.source)}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">
                              {r.content}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {!running &&
                    !queryResult &&
                    searchResult.length === 0 && (
                      <div className="text-center text-sm text-muted-foreground py-12">
                        在上方输入问题开始
                      </div>
                    )}
                </div>
              </ScrollArea>
            </>
          )}
        </main>
      </div>
    </AppLayout>
  );
}

