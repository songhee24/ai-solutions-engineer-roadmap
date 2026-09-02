// Ordered rules: first match wins. Tested against the roadmap NODE title (case-insensitive).
// Nodes deliberately left unmapped: vendor tooling / infra our roadmap does not cover.
export const NULL_RULES = [
  /^(atlan|datahub|data hub|onehouse|census|hightouch|segment)$/i,
  /^(apache spark|spark|flink|apache hadoop yarn|hdfs|mapreduce|distributed file systems|big data tools|what is cluster computing)$/i,
  /^(data lake|data lakes & warehouses|data warehouse|what is data warehouse\?|data mart|data mesh|data fabric|data storage|data generation|snowflake|amazon redshift|databricks delta lake|dbt|oltp vs olap|etl vs reverse etl|reverse etl|data ingestion architectures|best practices|iot|^undefined$)$/i,
  /^(java|scala|go|c#|c\+\+|ruby|rust|javascript)$/i,
];

export const NODE_RULES = [
  // ---- explicit fixes (must beat the broader rules below) ----
  [/^(local desktop|remote \/ cloud)$/i, "stage-6-mcp"],
  [/^(stopping criteria)$/i, "stage-6-apis"],
  [/^(data analysis|code generation)$/i, "stage-6-agents"],
  [/^(vertex ai|cloud-native ml services|networking fundamentals)$/i, "stage-7-cloud"],
  [/containers & orchestration|aws eks|google cloud gke/i, "stage-4-docker"],
  [/^a\/b testing$/i, "track-ds-d1"],
  [/^(version control systems|version control)$/i, "stage-1-git"],
  [/data ingestion/i, "track-ml-e1"],
  // ---- MCP (before agents/tools, since node names overlap) ----
  [/\bmcp\b|model context protocol/i, "stage-6-mcp"],

  // ---- Evaluation ----
  [/\beval(uation)?s?\b|ragas|deepeval|llm self evaluation|calibrating llms|metrics to track|regression testing|unit testing for individual tools|integration testing for flows|human in the loop evaluation/i, "stage-6-evals"],

  // ---- Security / safety / privacy ----
  [/prompt injection|jailbreak|red team|adversarial testing|content moderation|data privacy|pii|security and privacy|context security|sandboxing|permissioning|end-user ids|data classification|toxicity guardrail|data masking/i, "stage-6-security"],
  [/ai safety and ethics|bias and fairness|explainable ai|\bshap\b|\blime\b/i, "stage-3-interpret"],

  // ---- Observability / cost for LLM apps ----
  [/llm observability|cost & latency|tracing & logging|structured logging & tracing|langfuse|langsmith|helicone|arize|posthog|openllmetry|token based pricing|pricing of common models|production monitoring/i, "stage-6-ops"],

  // ---- Multimodal ----
  [/multimodal|multi-modal|image generation|image understanding|video understanding|audio processing|speech-to-text|text-to-speech|whisper|dall-e|nanobanana|vision api/i, "stage-6-multimodal"],

  // ---- Embeddings / vector search ----
  [/embedding|vector database|vector search|semantic search|similarity search|chunking|faiss|pinecone|chroma|qdrant|weaviate|lancedb|mongodb atlas|sentence transformers|jina ai|supabase/i, "stage-6-embeddings"],

  // ---- RAG ----
  [/\brag\b|retrieval process|^generation$|ragflow|haystack|llama ?index/i, "stage-6-rag"],

  // ---- Tools / function calling ----
  [/function calling|tool use|tool definition|what are tools|tool invocation|code execution|repl|file system access|web search|web scraping|crawling|database queries|email \/ slack|git and terminal usage/i, "stage-6-tools"],

  // ---- Agents / memory ----
  [/agent|memory|planner|reason and plan|observation & reflection|self-critique|crewai|autogen|langgraph|agno|smol depot|assistant api|human in the loop|perception \/ user input|episodic|forgetting|user profile storage|summarization \/ compression|state & historical context|personal assistant|npc \/ game ai|dag agents/i, "stage-6-agents"],

  // ---- Frameworks / local runtimes / coding assistants ----
  [/langchain|hugging ?face|transformers\.js|ollama|lm studio|self-hosted ai models|inference sdk|^modus$|replit|cursor|windsurf|claude code|codex|pre-trained models|models on hugging face/i, "stage-6-frameworks"],

  // ---- Prompting + model API surface ----
  [/prompt|temperature|top-k|top-p|max (length|tokens)|frequency penalty|presence penalty|repetition penalt|stop sequence|sampling parameter|output control|input format|structured output|streaming|streamed vs|system prompting|role & behavior|role prompting|chain of thought|chain-of-thought|few-shot|zero.?shot|one-shot|react|tree.of.thought|self-consistency|step-back|contextual|ensembling|constraining|be specific|use examples|specify length|provide additional context|use relevant technical terms|iterate and test|what is a prompt|automatic prompt|calibrating|response api|messages api|gemini api|openai-compatible|using sdks directly|context engineering|context compaction|context sources|context failure|context isolation|context layer|long-context|^context$|multi-agent context/i, "stage-6-apis"],
  [/^(anthropic|openai|google|meta|xai|deepseek|mistral ai|qwen|gemma|cohere|openrouter|anthropic's claude|google's gemini|gemini|meta llama|openai models \(gpt, o-series\))$/i, "stage-6-apis"],

  // ---- LLM internals / lifecycle ----
  [/context window|tokens?\b|tokenization|transformer|how llms work|llms and how they work|^llms?$|attention/i, "stage-5-transformers"],
  [/fine.?tun|hallucination|model weights|types of ai models|open (vs closed|weight)|closed weight|reasoning vs standard|choosing the right model|^training$|^inference$|ai vs agi/i, "stage-5-lifecycle"],
  [/^pytorch$/i, "stage-5-pytorch"],
  [/deep learning|tensorflow|^neural/i, "stage-5-nn"],

  // ---- Classical ML ----
  [/scikit-learn|machine learning fundamentals|^machine learning$|machine learning - a key concept|model evaluation|anomaly detection|recommendation systems/i, "stage-3-supervised"],

  // ---- MLOps pipelines / orchestration (track E) ----
  [/airflow|prefect|luigi|kubeflow|orchestration|job scheduling|data pipelines|dataflow|data factory|glue \(etl\)|mlops|continuous machine learning/i, "track-ml-e1"],
  [/experiment tracking|model registry|mlflow|^dvc$/i, "track-ml-e2"],
  [/feature store/i, "track-ml-e3"],
  [/model training and serving|edge ai|jetson|tflite|pytorch mobile/i, "track-ml-e4"],
  [/monitoring and observability/i, "track-ml-e5"],

  // ---- Cloud / infra ----
  [/kubernetes|eks|gke|docker|containeriz|containers & orchestration/i, "stage-4-docker"],
  [/ci\/cd|github actions|gitlab ci|jenkins|circleci|argocd|environmental management|infrastructure as code|terraform|ansible|opentofu|aws cdk|deployment  ?mgr/i, "stage-7-cicd"],
  [/cloud computing|aws \/ azure \/ gcp|amazon ec2|^s3$|azure (blob|virtual)|google cloud (storage|gke)|compute engine|serverless|cloud architectures|cloud-native ml services|horizontal vs vertical|distributed systems|cap theorem|cluster computing|^hybrid$|^batch$/i, "stage-7-cloud"],
  [/prometheus|grafana|datadog|new relic|sentry|^monitoring$|monitoring & observability|data lineage/i, "stage-7-monitor"],
  [/encryption|gdpr|eu ai act|ecpa/i, "stage-7-iam"],

  // ---- Backend ----
  [/^apis$|rest api|api requests|authentication vs authorization|async vs sync|idempotency|basic backend development|messaging systems|kafka|rabbitmq|sns|sqs/i, "stage-4-http"],
  [/unit testing|integration testing|end-to-end testing|functional testing|smoke testing|load testing|^testing$/i, "stage-4-testing"],
  [/redis|memcached|nosql|mongodb|cassandra|couchdb|dynamodb|cosmosdb|hbase|bigtable|neo4j|neptune|elasticsearch|key-value|^document$|^column$|^graph$/i, "stage-4-db"],

  // ---- Data / SQL ----
  [/learn sql concepts|^sql$/i, "stage-2-sql-basics"],
  [/relational database|database fundamentals|^transactions$|data normalization|data modelling|postgresql|mysql|ms sql|mariadb|^oracle$|aurora|cloud sql|amazon rds|azure sql/i, "stage-2-sql-design"],
  [/data quality|data collection considerations|data interoperability|slowly changing dimension/i, "stage-2-quality"],
  [/business intelligence|tableau|power bi|looker|streamlit|data analytics/i, "stage-2-viz-eda"],

  // ---- Python / CS / env ----
  [/^python$/i, "stage-1-basics"],
  [/^git( and github)?$|^github$|^gitlab$|^version control$/i, "stage-1-git"],
  [/data structures and algorithms|importance of data structures|what are data structures/i, "stage-1-cs"],
  [/^bash$|linux basics/i, "s0-env"],
  [/maths & statistics/i, "track-math-a3"],

  // ---- Orientation ----
  [/ai engineer vs ml engineer|what is an ai engineer|roles and responsibilities|skills and responsibilities|impact on product development|know your customers|data engineering vs data science|what is data engineering|data engineering lifecycle|data engineering fundamentals|^introduction$|agents use cases|rag usecases|multimodal ai usecases/i, "s0-landscape"],
];

// datastructures-and-algorithms roadmap: everything algorithmic goes to stage-1-cs
export const DSA_TOPIC = "stage-1-cs";
export const DSA_LANG_NODES = /^(c#|c\+\+|java|javascript|ruby|rust|go|python)$/i;
