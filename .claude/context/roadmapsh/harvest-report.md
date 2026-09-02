# roadmap.sh link harvest — report

**Source repo:** `github.com/nilbuild/developer-roadmap` (the org name in the brief resolved fine — no
fallback to `kamranahmedse` was needed). Shallow sparse clone at commit `64d2a72`, *"chore: sync content
to repo (#10261)"*, 2026-09-01.

**Compared against:** `/Users/mac/Projects/personal/ai-solutions-engineer-roadmap/roadmap-data.js`
— 15 stages, 107 topics, **199 resources**. Nothing in that repo was modified.

**Not done, on purpose:** no URL was opened, fetched or curl'd. Liveness is a separate browser step that
needs explicit approval. Everything below is extraction and set arithmetic only.

## Files

| File | What's in it |
|---|---|
| `all-links.json` | all 1693 parsed links, each tagged `status` = `candidate` / `duplicate` / `filtered` plus `reason`, `normalizedUrl`, `suggestedTopic` |
| `new-links.json` | 1382 unique candidates grouped by our topic id, stage-ordered; unmapped group last |
| `near-duplicates.json` | 182 same-host pairs (candidate ↔ existing site resource) for human judgement |
| `REPORT.md` | this file |

Working scripts are in the same directory and re-runnable with
`node parse.mjs && node pipeline.mjs` (needs the sparse clone at `../developer-roadmap`):
`parse.mjs` extracts, `pipeline.mjs` normalises/dedupes/filters/maps, `map-rules.mjs` is the topic rule table.

## Counts per roadmap

| Roadmap | Nodes with links | Links parsed | Filtered | Exact dup of site | Unique new candidates |
|---|--:|--:|--:|--:|--:|
| `ai-engineer` | 191 | 487 | 9 | 2 | 419 |
| `ai-agents` | 101 | 305 | 9 | 0 | 234 |
| `mlops` | 61 | 283 | 25 | 2 | 247 |
| `prompt-engineering` | 46 | 89 | 2 | 3 | 67 |
| `data-engineer` | 166 | 405 | 35 | 2 | 307 |
| `datastructures-and-algorithms` | 47 | 124 | 5 | 0 | 108 |
| **total** | **612** | **1693** | **85** | **9** | **1382** |

Totals: **1693 links parsed** from 700 content files (612 of them carried at least one link).
Link types: article 810, video 385, official 346, roadmap 47, opensource 39, course 33, feed 24, book 9.

After filtering and de-duplication: **1599 candidate links → 1382 unique URLs** (161 links were the same
URL appearing in more than one node/roadmap; each candidate carries `timesSeen` and `alsoIn` so you can
see where else it was used).

## What was dropped

### Exact duplicates of a resource we already have — 9

Normalisation before comparing: lower-cased host, `www.` stripped, `http`/`https` treated as one,
trailing slash and `#fragment` removed, tracking params (`utm_*`, `ref`, `source`, `fbclid`, …) removed,
`youtu.be/<id>` rewritten to `youtube.com/watch?v=<id>`, and one upstream typo repaired
(`ttps://collabnix.com/...` → `https://…`, which then collapsed onto its correct twin).

| Their link | Already on our site under |
|---|---|
| `ai.google.dev/gemini-api/docs` (twice: ai-engineer, prompt-engineering) | stage-6-apis — "Gemini API — документация" |
| `developers.openai.com/api/docs` | stage-6-apis — "OpenAI — документация для разработчиков" |
| `platform.claude.com/docs/en/agents-and-tools/tool-use/overview` | stage-6-tools — "Claude — Tool use (overview)" |
| `docs.ragas.io/en/stable/` | stage-6-evals — "Ragas — оценка RAG-систем" |
| `airflow.apache.org/docs` | track-ml-e1 — "Apache Airflow — документация" |
| `docs.github.com/en/actions` (twice: mlops, data-engineer) | stage-1-git — "GitHub Actions — документация" |
| `docs.streamlit.io/` | track-ds-d5 — "Streamlit — документация" |

Only 9 collisions out of 1693 is itself a finding: our site and roadmap.sh barely overlap. Ours leans on
Khan Academy, StatQuest, 3Blue1Brown, inria/scikit-learn and Russian-friendly primary docs; roadmap.sh
leans on YouTube, IBM/AWS/Google explainer pages and vendor docs.

### Filtered as noise — 85 links

| Reason | Links | Why |
|---|--:|---|
| `own-roadmap` | 53 | point back at roadmap.sh's own roadmap pages (all 47 `@roadmap@` links plus 6 stray article/course/official ones). Circular — we *are* the roadmap. |
| `paid-platform` | 29 (25 unique URLs) | paywalled course platforms with no free lesson behind the link. Listed in full below rather than silently dropped. |
| `marketing` | 2 | `forbes.com/councils/...ai-agent-pricing...` (Forbes Council contributor slot — sales content) and `internetsearchinc.com/ai-pricing-...` (agency lead-gen page). |
| `unstable-host` | 1 | `http://103.203.175.90:81/.../MLOps Engineering at Scale - Carl Osipov (Manning, 2022).pdf` — a bare-IP file server hosting a pirated Manning book. |

No social-profile links existed in the six roadmaps (checked x/twitter, linkedin, facebook, instagram,
discord, t.me), and only 4 URLs anywhere matched a pricing/contact/signup path — two of which
(`openai.com/api/pricing`) are genuine reference price lists and were **kept**, mapped to `stage-6-ops`.

#### The 29 paid-platform links, with the reason each is a judgement call

| Host | Link title | Their node |
|---|---|---|
| coursera.org | What is an ML Engineer? | `ai-engineer` / AI Engineer vs ML Engineer |
| coursera.org | What Is an AI Context Window? | `ai-engineer` / Context |
| datacamp.com | What Is Faiss (Facebook AI Similarity Search)? | `ai-engineer` / FAISS |
| packtpub.com | Everything you need to know about Pinecone | `ai-engineer` / Pinecone |
| datacamp.com | Vertex AI Tutorial: A Comprehensive Guide For Beginners | `ai-engineer` / Vertex AI |
| simplilearn.com | How to Become an AI Engineer: Duties, Skills, and Salary | `ai-engineer` / What is an AI Engineer? |
| datacamp.com | Evaluate LLMs Effectively Using DeepEval: A Practical Guide | `ai-agents` / DeepEval |
| udacity.com | AI Agents with LangChain and LangGraph | `ai-agents` / LangChain |
| pluralsight.com | Cloud AI vs. On-premises AI | `ai-agents` / Remote / Cloud |
| datacamp.com | What is Tokenization? Types, Use Cases, Implementation | `ai-agents` / Tokenization |
| datacamp.com | What is Prompt Engineering? A Detailed Guide For 2025 | `ai-agents` / What is Prompt Engineering |
| datacamp.com | The Complete Guide to Data Version Control With DVC | `mlops` / DVC |
| udemy.com | What Is Edge Computing? | `mlops` / Edge AI |
| datacamp.com | Explainable AI - Understanding and Trusting Machine Learning Models | `mlops` / LIME |
| datacamp.com | Streamline Your Machine Learning Workflow with MLFlow | `mlops` / MLflow |
| datacamp.com | An Introduction to Data Orchestration: Process and Benefits | `mlops` / Orchestration |
| datacamp.com | MLOps vs DevOps: Differences, Overlaps, and Use Cases | `mlops` / What is MLOps? |
| oreilly.com | Fundamentals of Data Engineering | `data-engineer` / Choosing the Right Technologies |
| coursera.org | Introduction to Data Analytics | `data-engineer` / Data Analytics |
| coursera.org | Microsoft Azure - Data Factory | `data-engineer` / Data Factory (ETL) |
| datacamp.com | WData Mart vs Data Warehouse: a Detailed Comparison | `data-engineer` / Data Mart |
| coursera.org | Coursera - Unix Courses | `data-engineer` / Linux Basics |
| edx.org | Databases and SQL | `data-engineer` / Relational Databases |
| udacity.com | Intro To Relational Databases | `data-engineer` / Relational Databases |
| simplilearn.com | Top Data Engineer Skills and Responsibilities | `data-engineer` / Skills and Responsibilities |

Judgement notes on that list:

- **datacamp.com (12)** and **simplilearn.com (2)** — blog-style tutorials that render a teaser and gate
  the rest behind a subscription. Dropped.
- **coursera.org (5)** — 2 are `/articles/...` marketing explainers, 3 are full courses. Coursera courses
  are *audit-free* (video + reading, no certificate), so if you want any of them back, take
  "Introduction to Data Analytics" and "Databases and SQL" — but our site already covers both subjects
  with free primary sources.
- **oreilly.com (1)** — *Fundamentals of Data Engineering* (Reis & Housley). This is the standard book for
  the subject and is genuinely worth buying; it just isn't a free link.
- **udacity / udemy / pluralsight / packtpub / edx (6)** — paid landing pages, no free path.

### Near-duplicates — 182 pairs, NOT dropped

These are candidate ↔ existing-resource pairs on the same host. They are judgement calls, listed in
`near-duplicates.json` with both URLs, our topic, and a `tier`:

- `same-host-same-section` (104) — host **and** first path segment match, e.g. our
  `platform.claude.com/docs/en/home` vs their `platform.claude.com/docs/en/build-with-claude/...`.
- `same-host-other-section` (78) — same host, different first segment. Added because the strict rule
  missed real overlaps, e.g. our `genai.owasp.org/llm-top-10/` vs their
  `genai.owasp.org/llmrisk/llm01-prompt-injection/`.

| Host | Tier | Pairs |
|---|---|--:|
| khanacademy.org | same-host-other-section | 45 |
| learn.microsoft.com | same-host-same-section | 27 |
| platform.claude.com | same-host-same-section | 26 |
| huggingface.co | same-host-same-section | 21 |
| deeplearning.ai | same-host-other-section | 10 |
| modelcontextprotocol.io | same-host-same-section | 8 |
| ai.google.dev | same-host-same-section | 6 |
| developer.mozilla.org | same-host-other-section | 3 |
| git-scm.com | same-host-other-section | 3 |
| developer.mozilla.org | same-host-same-section | 3 |
| developers.openai.com | same-host-same-section | 3 |
| docs.langchain.com | same-host-other-section | 2 |
| docs.pytorch.org | same-host-other-section | 2 |
| modelcontextprotocol.io | same-host-other-section | 2 |
| postgresql.org | same-host-other-section | 2 |
| developers.google.com | same-host-same-section | 2 |
| docs.github.com | same-host-same-section | 2 |
| mlflow.org | same-host-same-section | 2 |
| ai.google.dev | same-host-other-section | 1 |
| airflow.apache.org | same-host-other-section | 1 |
| developers.openai.com | same-host-other-section | 1 |
| docs.docker.com | same-host-other-section | 1 |
| docs.prefect.io | same-host-other-section | 1 |
| dvc.org | same-host-other-section | 1 |
| genai.owasp.org | same-host-other-section | 1 |
| mlflow.org | same-host-other-section | 1 |
| scikit-learn.org | same-host-other-section | 1 |
| airflow.apache.org | same-host-same-section | 1 |
| cloud.google.com | same-host-same-section | 1 |
| docs.ragas.io | same-host-same-section | 1 |
| madewithml.com | same-host-same-section | 1 |

Two caveats on that table:

- **youtube.com is excluded from pairing entirely.** 335 of the 1382 candidates are YouTube videos and a video
  id gives no section signal — pairing on `youtube.com/watch` would have produced ~1,150 meaningless pairs.
- **khanacademy.org (45) and deeplearning.ai (10) are almost certainly false positives.** Khan is one
  candidate (a networking course) paired against our 45 Khan math links; the deeplearning.ai pairs are
  five *different* short courses matching our two existing ones on `/short-courses/`. Read those two hosts
  as "same publisher", not "same page".
- The genuinely load-bearing rows are `platform.claude.com` (26), `learn.microsoft.com` (27),
  `huggingface.co` (21) and `modelcontextprotocol.io` (8+2): in each case our site links the docs
  *landing page* and roadmap.sh links deep pages underneath it. Whether a deep page is "already covered"
  by the landing page is exactly the call a human should make.

## What remains — 1382 unique candidates

**1266 mapped** to one of our topics, **116 unmapped** (`suggestedTopic: null`).

Mapping method: each roadmap *node* (not each link) is resolved once against an ordered rule table keyed on
the node's H1 title, so a node never splits across two of our topics. Rules are in `map-rules.mjs` and are
easy to correct and re-run.


### The 116 unmapped, and why

They cluster into four honest gaps rather than mapping failures:

1. **Warehouse / big-data stack (58)** — Snowflake, BigQuery, Redshift, Databricks Delta Lake, dbt, Spark,
   Flink, Hadoop/YARN, HDFS, MapReduce, data lake / lakehouse / mesh / fabric, OLTP-vs-OLAP, ETL-vs-reverse-ETL.
   Our roadmap goes SQL → pandas → ML → backend and never opens a warehouse chapter. Adding these means
   adding a topic first.
2. **Non-Python DSA and other off-track languages (38)** — the datastructures-and-algorithms roadmap's C#, C++, Java, JavaScript, Ruby,
   Rust and Go nodes, plus data-engineer's Java/Scala. Off-track for a Python learner by construction.
3. **Data-governance / reverse-ETL vendors (13)** — Atlan, DataHub, Census, Hightouch, Segment, Onehouse.
   Vendor tooling with no topic to attach to.
4. **Misc (7)** — IoT, "Best Practices", "Data Generation", "Data Storage".

### New candidates per topic

| Stage | Topic id | Topic (RU) | On site now | New candidates |
|---|---|---|--:|--:|
| Ориентация и диагностика | `s0-landscape` | AI, ML, Data Science и AI Engineering — в чём разница | 1 | 23 |
| Ориентация и диагностика | `s0-env` | Рабочая среда: Python, VS Code, Git, GitHub | 2 | 5 |
| Трек A. Математика с полного нуля | `track-math-a3` | A3.1 Описательная статистика | 4 | 8 |
| Трек D. Data Science в глубину | `track-ds-d1` | D1. Дизайн экспериментов и A/B по-взрослому | 2 | 2 |
| Трек E. ML Engineering в глубину | `track-ml-e1` | E1. Пайплайны обучения и оркестрация | 2 | 45 |
| Трек E. ML Engineering в глубину | `track-ml-e2` | E2. Эксперименты, реестр моделей, версии данных | 2 | 12 |
| Трек E. ML Engineering в глубину | `track-ml-e3` | E3. Feature store и признаки в проде | 1 | 2 |
| Трек E. ML Engineering в глубину | `track-ml-e4` | E4. Инференс под нагрузкой: батчинг, квантизация, GPU | 4 | 19 |
| Трек E. ML Engineering в глубину | `track-ml-e5` | E5. Дрейф, переобучение и мониторинг качества | 1 | 3 |
| Python и основы Computer Science | `stage-1-basics` | Синтаксис, типы, коллекции, функции | 3 | 7 |
| Python и основы Computer Science | `stage-1-git` | Git и GitHub в рабочем режиме | 3 | 20 |
| Python и основы Computer Science | `stage-1-cs` | Алгоритмическое мышление и структуры данных | 1 | 85 |
| Данные, SQL и аналитика | `stage-2-sql-basics` | SQL: выборка, фильтрация, агрегация, JOIN | 3 | 4 |
| Данные, SQL и аналитика | `stage-2-sql-design` | Схема, ключи, индексы, транзакции, безопасность | 1 | 32 |
| Данные, SQL и аналитика | `stage-2-quality` | Качество данных: пропуски, дубликаты, выбросы, leakage, PII | 2 | 4 |
| Данные, SQL и аналитика | `stage-2-viz-eda` | Визуализация и разведочный анализ (EDA) | 1 | 13 |
| Data Science и классический Machine Learning | `stage-3-supervised` | Регрессия, классификация, деревья, kNN | 3 | 16 |
| Data Science и классический Machine Learning | `stage-3-interpret` | Интерпретация модели, feature importance, SHAP, этика | 1 | 16 |
| Backend, API и программная инженерия | `stage-4-http` | HTTP, REST, статусы, аутентификация, надёжность | 1 | 32 |
| Backend, API и программная инженерия | `stage-4-db` | База данных из приложения | 1 | 44 |
| Backend, API и программная инженерия | `stage-4-testing` | Тестирование API и OpenAPI | 1 | 10 |
| Backend, API и программная инженерия | `stage-4-docker` | Docker: упаковать и запустить где угодно | 1 | 20 |
| Основы Deep Learning и LLM | `stage-5-nn` | Нейросеть изнутри: веса, loss, backpropagation | 3 | 9 |
| Основы Deep Learning и LLM | `stage-5-pytorch` | PyTorch: тензоры и цикл обучения | 1 | 6 |
| Основы Deep Learning и LLM | `stage-5-transformers` | Embeddings, attention, transformers, токены | 1 | 20 |
| Основы Deep Learning и LLM | `stage-5-lifecycle` | Pretraining, fine-tuning, inference, галлюцинации | 1 | 30 |
| Глубокая специализация: AI Engineering | `stage-6-apis` | Model API напрямую: промпты, system instructions, structured outputs, streaming | 3 | 191 |
| Глубокая специализация: AI Engineering | `stage-6-tools` | Tool calling и function calling | 1 | 41 |
| Глубокая специализация: AI Engineering | `stage-6-embeddings` | Embeddings, семантический поиск, векторные базы, chunking | 2 | 56 |
| Глубокая специализация: AI Engineering | `stage-6-rag` | RAG: retrieval, reranking, гибридный поиск, цитаты | 2 | 32 |
| Глубокая специализация: AI Engineering | `stage-6-agents` | Агенты, workflows, состояние, память, human-in-the-loop | 1 | 99 |
| Глубокая специализация: AI Engineering | `stage-6-mcp` | MCP: клиент и сервер | 2 | 40 |
| Глубокая специализация: AI Engineering | `stage-6-evals` | Оценка качества: датасеты, автоматические evals, LLM-as-judge | 1 | 45 |
| Глубокая специализация: AI Engineering | `stage-6-security` | Безопасность LLM: prompt injection, утечки, права, PII | 2 | 33 |
| Глубокая специализация: AI Engineering | `stage-6-ops` | Observability, стоимость, latency, кеш, fallback | 1 | 34 |
| Глубокая специализация: AI Engineering | `stage-6-frameworks` | Фреймворки — только после примитивов | 1 | 42 |
| Глубокая специализация: AI Engineering | `stage-6-multimodal` | Мультимодальность и когда нужен fine-tuning | 1 | 27 |
| Production AI, MLOps, Cloud и безопасность | `stage-7-cicd` | Docker Compose, CI/CD, окружения | 2 | 57 |
| Production AI, MLOps, Cloud и безопасность | `stage-7-cloud` | Основы облака: compute, storage, сеть | 4 | 53 |
| Production AI, MLOps, Cloud и безопасность | `stage-7-iam` | Доступы, секреты, шифрование, модель угроз | 2 | 11 |
| Production AI, MLOps, Cloud и безопасность | `stage-7-monitor` | Логи, метрики, трассировка, дрейф данных | 2 | 18 |
| — | `null` | (no matching topic — see below) | — | 116 |

## Three structural findings

1. **Prompting has no home in our roadmap.** 191 candidates land on `stage-6-apis`, which currently holds
   3 resources and is titled "Model API напрямую: промпты, system instructions, structured outputs,
   streaming". Everything roadmap.sh knows about zero-shot / few-shot / CoT / ReAct / ToT / self-consistency
   / step-back / role prompting / sampling parameters / prompt injection defence piles into that one topic.
   The honest fix is to split a dedicated prompting topic before importing, otherwise you get a 194-item
   resource list on one card.
2. **Twenty of our topics have exactly one resource and now have candidates**, several of them core:
   `stage-6-agents` (1 → 99 candidates), `stage-6-evals` (1 → 45), `stage-6-tools` (1 → 41),
   `stage-6-ops` (1 → 34), `stage-5-lifecycle` (1 → 30), `stage-4-db` (1 → 44), `stage-1-cs` (1 → 85).
   That is where the harvest pays for itself.
3. **66 of our 107 topics got nothing** — the whole math track (A), the English track (B), the automation
   track (C), most of Data Science deep (D), the Python fundamentals topics, all of stage 8 (Solutions
   Engineer skills) and stage 9 (portfolio and interviews). roadmap.sh simply doesn't cover school maths,
   ESL, n8n/Make, discovery calls or RFP handover. Those gaps have to be filled from somewhere else.

Also worth knowing: **102 candidates are bare product landing pages** (`https://claude.ai`,
`https://mistral.ai/`, `https://crewai.com/`, `https://www.pinecone.io`, …). They are tagged
`"landingPage": true` in `new-links.json` and were kept rather than filtered, because for a few of them
(Ollama, Hugging Face, LM Studio) the homepage *is* the entry point. For most of the rest it is a product
page with nothing to learn from — filter by that flag if you want a quick clean-up pass.

## The 15 strongest additions

Chosen for: our topic is thin, the resource is free, and it is the primary/canonical source rather than a
third-party rewrite. None of these is an exact duplicate of anything we already have.

| # | Topic | Resource | Why it earns a slot |
|---|---|---|---|
| 1 | `stage-6-apis` | **Prompt Engineering Guide** — https://www.promptingguide.ai/ (18 pages harvested, one per technique) | The de-facto free reference for prompting technique. Our site has zero technique material — only three vendor doc landing pages. |
| 2 | `stage-6-apis` | **Learn Prompting** — https://learnprompting.org/docs/... (23 pages) | Structured free course covering the same ground pedagogically, plus a defensive-prompting chapter that doubles into `stage-6-security`. |
| 3 | `stage-6-apis` | **OpenAI Cookbook** — https://github.com/openai/openai-cookbook | Runnable notebooks for every API pattern. We link OpenAI's docs but nothing executable. |
| 4 | `stage-6-agents` | **A practical guide to building agents (OpenAI, PDF)** — https://cdn.openai.com/business-guides-and-resources/a-practical-guide-to-building-agents.pdf | The canonical free agent-design document. Our agents topic has one resource (the HF course). |
| 5 | `stage-6-apis` | **Anthropic — Prompt engineering overview** — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview | Model-maker's own prompting rules; we link only `platform.claude.com/docs/en/home`, a landing page. |
| 6 | `stage-6-security` | **Anthropic — Mitigate jailbreaks and prompt injections** — https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks | Concrete defences with code. We currently have the OWASP taxonomy only, which names risks but doesn't fix them. |
| 7 | `stage-6-evals` | **Evidently AI — LLM-as-a-judge guide** (+ 3 sibling pages on eval metrics and regression testing) — https://www.evidentlyai.com/llm-guide/llm-as-a-judge | "LLM-as-judge" is literally in our topic title and has no resource behind it. |
| 8 | `stage-6-evals` | **DeepEval docs** — https://deepeval.com/docs/introduction | Unit-test-style evals for any LLM app; our only eval resource is Ragas, which is RAG-specific. |
| 9 | `stage-6-ops` | **Langfuse docs** — https://langfuse.com/docs | LLM-specific tracing, cost and latency. Our only ops resource is generic OpenTelemetry. |
| 10 | `stage-6-apis` | **Instructor** — https://github.com/jxnl/instructor | Structured outputs via Pydantic — connects directly to our FastAPI/Pydantic topic in stage 4. |
| 11 | `stage-6-agents` | **Anthropic — Effective context engineering for AI agents** — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | Context engineering appears nowhere in our roadmap; this is the best short primer. |
| 12 | `stage-5-nn` | **Practical Deep Learning for Coders (fast.ai)** — https://course.fast.ai/ | Free top-tier DL course, code-first, matches our "practice over theory" split. |
| 13 | `stage-7-monitor` | **Prometheus getting-started tutorial + Grafana docs** — https://prometheus.io/docs/tutorials/getting_started/ , https://grafana.com/docs/ | Our monitoring topic has no tool documentation at all — only a course and a YouTube channel. |
| 14 | `stage-7-cicd` | **Terraform tutorials + docs (HashiCorp)** — https://learn.hashicorp.com/terraform , https://developer.hashicorp.com/terraform | Infrastructure-as-Code is named in stage 7 but has no resource. |
| 15 | `stage-6-mcp` | **awesome-mcp-servers** — https://github.com/punkpeye/awesome-mcp-servers | We have the spec and a course; this is the catalogue of real servers to read and copy. |

Runners-up worth a look: `bigocheatsheet.com` + the Programiz/HackerEarth DSA visualisations for
`stage-1-cs` (85 candidates against one existing CS50 link), `pinecone.io/learn/chunking-strategies` for
`stage-6-embeddings`, and `redis.io/docs/latest/` for `stage-4-db`.

## Limitations

- **No link was opened.** Some of these URLs are certainly dead or moved — roadmap.sh content drifts. Two
  titles in the source are visibly broken (`"LagLangSmith docsnS"`, `"PostHob Docs"`, `"Evaluation
  MetricsEvaluation Metrics"`), which hints at how carefully the upstream list is maintained. Verify in a
  browser before importing.
- **Topic mapping is heuristic.** It is rule-based on node titles, resolved once per node. Spot-check the
  big groups (`stage-6-apis`, `stage-6-agents`, `stage-1-cs`) before trusting them wholesale.
- **Language.** Everything harvested is in English. Our site marks resources `lang: "en" | "ru"`; all of
  these would be `en`, which shifts the site's balance.
- **Near-duplicate detection is host-based only.** It cannot see that two different domains teach the same
  thing (e.g. our StatQuest videos vs. their IBM explainer pages). Topical overlap was deliberately kept.
