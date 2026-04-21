# Agent 开发手册

## 1. 什么是 Agent

Agent（智能体）是一个能够自主感知环境、做出决策并执行动作的系统。与传统的 LLM 调用不同，Agent 具备以下核心能力：

- **感知**：接收用户输入、外部工具返回结果等
- **推理**：基于当前状态决定下一步行动
- **行动**：调用工具、返回结果或向用户提问
- **记忆**：维护对话历史和上下文状态

## 2. Agent 核心架构

```
用户输入 → Agent（LLM + Prompt + Tools）→ 工具调用 → 观察结果 → 继续推理或返回
```

典型循环：

1. Agent 接收输入
2. LLM 决定是否调用工具
3. 如果调用工具，执行工具并将结果返回给 Agent
4. Agent 根据结果继续推理
5. 直到得出最终答案返回给用户

## 3. LangChain Agent 开发

### 3.1 基础 Agent 创建

LangChain v1.0.x 提供了 `create_agent` 方法快速创建 Agent：

```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent

llm = ChatOpenAI(model="gpt-4o", temperature=0)
agent = create_agent(llm, tools=[], prompt="你是一个智能助手")
```

### 3.2 工具定义

工具是 Agent 与外部世界交互的桥梁。定义工具的两种方式：

**方式一：使用 @tool 装饰器**

```python
from langchain_core.tools import tool

@tool
def get_current_time() -> str:
    """获取当前时间"""
    from datetime import datetime
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@tool
def calculate(expression: str) -> str:
    """计算数学表达式，例如 '2 + 3 * 4'"""
    try:
        return str(eval(expression))
    except Exception as e:
        return f"计算错误: {e}"
```

**方式二：使用 StructuredTool**

```python
from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

class SearchInput(BaseModel):
    query: str = Field(description="搜索关键词")
    max_results: int = Field(default=5, description="最大结果数")

def search_func(query: str, max_results: int = 5) -> str:
    return f"搜索 '{query}' 返回 {max_results} 条结果"

search_tool = StructuredTool.from_function(
    func=search_func,
    name="web_search",
    description="网络搜索工具",
    args_schema=SearchInput,
)
```

### 3.3 工具选择最佳实践

- 每个工具的描述要清晰、具体，LLM 依赖描述来决定调用哪个工具
- 工具参数使用 Pydantic Schema 定义，提供类型和描述
- 避免功能重叠的工具，防止 LLM 选择混乱
- 工具数量建议控制在 5-10 个以内

## 4. 流式输出

Agent 支持流式输出，提升用户体验：

```python
# 同步流式
for chunk in agent.stream({"messages": [{"role": "user", "content": "你好"}]}):
    print(chunk, end="", flush=True)

# 异步流式
async for chunk in agent.astream({"messages": [{"role": "user", "content": "你好"}]}):
    print(chunk, end="", flush=True)
```

## 5. LangGraph 工作流

LangGraph 提供了更灵活的 Agent 编排能力，支持有状态工作流。

### 5.1 StateGraph 基础

```python
from langgraph.graph import StateGraph, START, END
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    next_action: str

def plan_node(state: AgentState) -> AgentState:
    # 规划节点
    return {**state, "next_action": "search"}

def search_node(state: AgentState) -> AgentState:
    # 搜索节点
    return {**state, "next_action": "summarize"}

graph = StateGraph(AgentState)
graph.add_node("plan", plan_node)
graph.add_node("search", search_node)
graph.add_edge(START, "plan")
graph.add_edge("plan", "search")
graph.add_edge("search", END)

app = graph.compile()
```

### 5.2 条件边

根据状态动态决定下一步：

```python
def should_continue(state: AgentState) -> str:
    if state["next_action"] == "search":
        return "search"
    elif state["next_action"] == "answer":
        return "answer"
    return "end"

graph.add_conditional_edges("plan", should_continue)
```

### 5.3 检查点持久化

使用检查点保存工作流状态，支持断点续传和人机交互：

```python
from langgraph.checkpoint.sqlite import SqliteSaver

checkpointer = SqliteSaver.from_conn_string("checkpoints.db")
app = graph.compile(checkpointer=checkpointer)

# 带 thread_id 执行，支持断点续传
config = {"configurable": {"thread_id": "session-1"}}
result = app.invoke(input_data, config)
```

## 6. 多智能体协作（DeepAgents）

复杂任务可以拆分给多个子智能体协作完成：

| 子智能体 | 职责 | 典型工具 |
|---------|------|---------|
| WebResearcher | 网络信息搜集 | 搜索、网页抓取 |
| DocAnalyst | 文档分析与提取 | 文件读取、RAG 检索 |
| ReportWriter | 报告撰写与整合 | 文件写入、格式化 |

协作流程：

1. 主 Agent 接收任务，生成研究计划
2. 将子任务分派给对应子智能体
3. 子智能体独立执行，返回结果
4. 主 Agent 汇总结果，生成最终输出

## 7. Guardrails 安全机制

Agent 系统需要安全防护，防止 Prompt Injection、敏感信息泄露等问题。

### 7.1 输入验证

- 检测 Prompt Injection 攻击
- 过滤恶意指令（如忽略之前指令、越权操作）
- 敏感信息检测与脱敏

### 7.2 输出验证

- 结构化输出校验（Pydantic Schema）
- 内容安全过滤
- 人工审核机制

### 7.3 安全等级

| 等级 | 说明 | 处理方式 |
|------|------|---------|
| SAFE | 安全内容 | 正常通过 |
| WARNING | 可疑内容 | 记录日志，允许通过但标记 |
| UNSAFE | 危险内容 | 拦截，返回安全提示 |

## 8. RAG 增强检索

将 RAG 与 Agent 结合，让 Agent 能够检索私有知识库：

```python
from rag import IndexManager, get_embeddings, create_retriever

# 加载已有索引
manager = IndexManager()
embeddings = get_embeddings()
vector_store = manager.load_index("my_docs", embeddings)

# 创建检索工具
retriever = create_retriever(vector_store, k=4)

# 将检索器作为工具提供给 Agent
from langchain_core.tools import tool

@tool
def search_knowledge_base(query: str) -> str:
    """搜索知识库获取相关信息"""
    docs = retriever.invoke(query)
    return "\n".join(doc.page_content for doc in docs)
```

## 9. 开发最佳实践

### 9.1 Prompt 设计

- 明确 Agent 的角色和能力边界
- 列出可用工具及其使用时机
- 提供示例对话（Few-shot）
- 设定失败处理策略

### 9.2 错误处理

- 工具调用失败时提供友好的降级响应
- 设置最大迭代次数防止死循环
- 捕获异常并记录详细日志

### 9.3 性能优化

- 减少不必要的工具调用
- 使用流式输出降低首字延迟
- 合理设置 Agent 的 max_iterations
- 对频繁调用的工具结果做缓存

### 9.4 测试策略

- 单元测试：测试每个工具的独立功能
- 集成测试：测试 Agent 的完整推理链路
- 端到端测试：模拟真实用户场景
- 回归测试：确保新功能不影响已有逻辑

## 10. 常见问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Agent 不调用工具 | 工具描述不清晰 | 优化工具的 description 和参数说明 |
| Agent 陷入循环 | 推理逻辑有缺陷 | 设置 max_iterations，添加终止条件 |
| 工具返回格式不一致 | 缺乏输出约束 | 使用 Pydantic Schema 约束输出 |
| 响应速度慢 | 工具调用链过长 | 优化工具数量，使用流式输出 |
| Prompt Injection | 输入未过滤 | 使用 Guardrails 输入验证 |

## 11. Agent 开发前景

### 11.1 技术趋势

- **多模态 Agent**：融合文本、图像、语音、视频等多种输入输出，实现更自然的人机交互
- **自主规划 Agent**：从被动执行指令进化为主动制定计划、分解任务、自我纠错
- **长时记忆 Agent**：结合向量数据库和知识图谱，让 Agent 拥有持久化的长期记忆
- **协作式多 Agent**：多个 Agent 组成团队，分工协作完成复杂项目，类似人类组织
- **Agent 即服务（Agent-as-a-Service）**：Agent 能力标准化封装，通过 API 按需调用

### 11.2 行业应用

| 领域 | 应用场景 | Agent 角色 |
|------|---------|-----------|
| 客服 | 智能工单处理、多轮对话 | 自主判断、转人工、知识检索 |
| 金融 | 投研分析、风险评估 | 数据搜集、报告生成、合规审查 |
| 医疗 | 辅助诊断、文献检索 | 知识推理、多源信息整合 |
| 教育 | 个性化学习、智能出题 | 学习规划、进度跟踪、自适应调整 |
| 编程 | 代码生成、自动调试 | 需求理解、代码编写、测试验证 |
| 运维 | 故障排查、自动修复 | 日志分析、根因定位、执行修复 |

### 11.3 关键挑战

- **可靠性**：Agent 的决策不可预测，需要更强的约束和验证机制
- **成本控制**：多轮 LLM 调用和工具执行的 token 成本较高
- **安全性**：Prompt Injection、越权操作、数据泄露等风险
- **可解释性**：Agent 的推理链路复杂，难以追溯决策依据
- **评测体系**：缺少标准化的 Agent 能力评估基准

### 11.4 开发者建议

1. 从单工具 Agent 入手，逐步扩展到多工具、多步骤
2. 优先解决具体业务问题，不要为了用 Agent 而用 Agent
3. 重视可观测性，记录 Agent 每一步的推理和动作
4. 做好成本预算，监控 token 用量和工具调用频次
5. 建立安全防线，输入输出都要做校验和过滤
6. 关注开源社区，LangChain、LangGraph 等框架迭代很快
