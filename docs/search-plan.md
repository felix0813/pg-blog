# 博客相关性搜索方案

## 目标

在现有 PostgreSQL 架构中实现混合搜索：

- 全站关键词搜索：标题、摘要、正文、分类与标签。
- 文章详情页的相关文章推荐。
- 语义搜索：理解相近问题和不同表述。
- 严格沿用文章可见性规则：未登录仅已发布文章；登录用户额外可见自己的草稿与归档文章。

## 架构

```text
文章保存/更新
  → 提取纯文本、中文分词、计算内容哈希
  → 更新全文检索文档
  → 创建异步向量索引任务
  → 生成 embedding 并写入 pgvector
  → 全文 Top 50 + 向量 Top 50
  → 权限过滤 + RRF 融合
  → 搜索页与相关文章
```

Redis 只能作为可快速失败的缓存，不能成为搜索或文章写入的必要依赖。

## 数据模型

### post_search_documents

每篇文章一条全文检索文档：

- `post_id`：主键，引用 `posts.id`。
- `user_id`、`status`：用于权限筛选。
- `search_text`：规范化文本。
- `search_tsv`：PostgreSQL `tsvector`。
- `content_hash`：内容变更检测。
- `embedding_model`、`embedding_status`、`indexed_at`、`last_error`。

字段权重：标题 A；标签与分类 A/B；摘要 B；正文 C。对 `search_tsv` 建立 GIN 索引；公开文章使用 `status='published'` 的部分索引。

### post_search_chunks

每篇文章切分为多个语义分块：

- `id`、`post_id`、`user_id`、`status`、`chunk_no`。
- `content`、`content_hash`。
- `embedding vector(N)`。
- `created_at`、`updated_at`。

分块约 400–800 个中文字符，保留 80–120 字重叠；标题和摘要作为块前缀。向量维度与最终选定的 embedding 模型固定绑定。

### search_index_jobs

异步索引任务：

- 状态：`pending`、`processing`、`completed`、`failed`。
- 使用 `FOR UPDATE SKIP LOCKED` 拉取任务。
- 指数退避重试并保留失败原因。
- `content_hash` 未变时跳过重复 embedding。

## 中文全文检索

使用应用层中文分词，标题、摘要、正文、标签统一处理，再使用 PostgreSQL `simple` 文本配置生成 `tsvector`。查询词走同一分词链路，使用 `websearch_to_tsquery` 与 `ts_rank_cd` 排序。

该设计保留英文、数字、技术词和 API 名称，且不依赖数据库服务器是否安装中文分词扩展。

## 向量检索

启用 PostgreSQL `pgvector`：

- 余弦距离。
- HNSW 索引。
- 首版对 `published` 文章建立向量索引；登录用户自身的小量非公开文章可精确补充查询。
- 模型名称、维度、批量大小配置化，模型升级时新建向量版本并重建。

## 检索和排序

每次搜索并行召回：

1. 全文检索 Top 50。
2. 向量检索 Top 50 个分块，聚合为文章级结果。
3. 在两路 SQL 中先做状态和用户权限过滤。
4. 使用 Reciprocal Rank Fusion（初始 `k=60`）合并结果。
5. 标题精确命中、标签命中和轻量时间衰减作为额外加权。

## 接口

- `GET /api/search?q=&page_size=&cursor=&category=&tag=`
- `GET /api/posts/:id/related?limit=6`
- `POST /api/admin/search/reindex`
- `GET /api/admin/search/jobs`

搜索使用 cursor 分页。结果只包含调用者可读取文章的标题、摘要、高亮片段、分类、标签与时间。

## 前端

- 搜索页：`/search?q=...`。
- 顶栏搜索入口，支持 Ctrl/Cmd + K。
- 输入防抖 250–300ms，至少两个字符后查询。
- 结果显示关键词/语义匹配提示。
- 详情页显示 3–6 篇相关文章。
- 所有请求通过 `baseURL='/myblog'`，例如 `/myblog/api/search`。

## 上线步骤

1. 建全文文档表、任务表、权限测试和索引。
2. 回填历史文章并上线关键词搜索。
3. 安装 pgvector，建分块表和 HNSW 索引。
4. 接入 embedding 任务消费者，小批量回填历史文章。
5. 上线相关文章。
6. 启用混合搜索和 RRF，按点击与零结果日志调权重。

## 验收标准

- 关键词搜索 P95 小于 300ms。
- 混合搜索 P95 小于 800ms。
- 全文索引延迟小于 5 秒；向量索引延迟小于 2 分钟。
- 不泄露其他用户草稿或归档文章。
- embedding 故障时关键词检索、写作和发布仍可用。

## 实施前决策

需确认 embedding 提供商，随后锁定模型名称、向量维度、成本上限和环境变量。推荐首版使用兼容 OpenAI Embeddings API 的服务，并保留模型/维度配置化能力。


## 模型决策

首版固定使用阿里云百炼 `text-embedding-v4`，输出维度设为 **1024**。该模型针对中文、多语言和代码检索表现较好，并支持维度配置；1024 维在效果、索引容量和检索延迟之间取得平衡。

数据库 `post_search_chunks.embedding` 固定为 `vector(1024)`，公开文章以余弦距离建立 HNSW 索引。后续如切换模型或维度，采用新向量版本和独立迁移重建，禁止混用不同维度的向量。


## 模型更新

首版模型调整为阿里云百炼 `qwen3.7-text-embedding`，维度仍固定为 **1024**。现有 `vector(1024)` 列和 HNSW 余弦索引保持兼容，无需重建。
