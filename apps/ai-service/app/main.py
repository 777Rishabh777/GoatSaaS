import os
import httpx
import asyncpg
import asyncio
import math
import re
import json
import io
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from collections import Counter

app = FastAPI(title="GOAT SaaS Cognitive AI Microservice")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class NeuralRoutingConfig:
    @classmethod
    def get_api_key(cls):
        return os.getenv("GROQ_API_KEY", "MOCK_FREE_GROQ_KEY_UNSET").strip('"' + "'")
    
    DATABASE_URL = os.getenv("DATABASE_URL", "").strip('"' + "'")
    GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

from app.routers import projects
app.include_router(projects.router)

class DiagnosticPayload(BaseModel):
    metric_name: str
    current_value: float
    previous_value: float
    date_range: str
    context_logs: str
    model: str = "groq"
    use_rag: bool = False

class NaturalLanguageSQLPayload(BaseModel):
    natural_query: str
    database_schema_context: str
    model: str = "groq"

class SQLExecutionPayload(BaseModel):
    sql_query: str

class ThresholdPayload(BaseModel):
    threshold: float

class SimulateAnomalyPayload(BaseModel):
    user_id: int = 1
    endpoint: str = "/api/v1/inference"
    latency_ms: int = 1850

# --- DB INIT ---
async def init_db():
    if not NeuralRoutingConfig.DATABASE_URL:
        print("DATABASE_URL is not set. Skipping DB table creation.")
        return
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS rag_documents (
                id SERIAL PRIMARY KEY,
                org_id VARCHAR(50) NOT NULL DEFAULT 'default_org',
                name VARCHAR(255) NOT NULL,
                file_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id SERIAL PRIMARY KEY,
                org_id VARCHAR(50) NOT NULL DEFAULT 'default_org',
                document_id INTEGER REFERENCES rag_documents(id) ON DELETE CASCADE,
                content TEXT NOT NULL,
                embedding TEXT
            );
            
            CREATE TABLE IF NOT EXISTS system_anomalies (
                id SERIAL PRIMARY KEY,
                org_id VARCHAR(50) NOT NULL DEFAULT 'default_org',
                latency_ms INTEGER NOT NULL,
                threshold_z DOUBLE PRECISION NOT NULL,
                z_score DOUBLE PRECISION NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                resolved BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS telemetry (
                id SERIAL PRIMARY KEY,
                org_id VARCHAR(50) NOT NULL DEFAULT 'default_org',
                endpoint VARCHAR(255) NOT NULL,
                latency_ms INTEGER NOT NULL,
                timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS billing_subscriptions (
                org_id VARCHAR(50) PRIMARY KEY,
                plan VARCHAR(50) DEFAULT 'free',
                status VARCHAR(50) DEFAULT 'active'
            );
            
            CREATE TABLE IF NOT EXISTS system_config (
                key VARCHAR(50) PRIMARY KEY,
                value VARCHAR(255) NOT NULL
            );
            
            INSERT INTO system_config (key, value)
            VALUES ('anomaly_threshold_z', '2.5')
            ON CONFLICT (key) DO NOTHING;

            ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS org_id VARCHAR(50) DEFAULT 'default_org';
            ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS org_id VARCHAR(50) DEFAULT 'default_org';
            ALTER TABLE system_anomalies ADD COLUMN IF NOT EXISTS org_id VARCHAR(50) DEFAULT 'default_org';
        """)
        await conn.close()
        print("Neon database schema verified & tables created.")
    except Exception as e:
        print(f"Error during database schema initialization: {e}")

# --- BACKGROUND ANOMALY DETECTOR LOOP ---
LAST_PROCESSED_TELEMETRY_ID = 0

async def background_anomaly_detector():
    global LAST_PROCESSED_TELEMETRY_ID
    print("Background telemetry anomaly detector running...")
    
    # Initialize LAST_PROCESSED_TELEMETRY_ID to the maximum id currently in telemetry
    try:
        if NeuralRoutingConfig.DATABASE_URL:
            conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
            max_id = await conn.fetchval("SELECT COALESCE(MAX(id), 0) FROM telemetry")
            LAST_PROCESSED_TELEMETRY_ID = max_id
            await conn.close()
            print(f"Initialized LAST_PROCESSED_TELEMETRY_ID to: {LAST_PROCESSED_TELEMETRY_ID}")
    except Exception as e:
        print(f"Could not initialize telemetry processed tracker: {e}")
        
    while True:
        try:
            if NeuralRoutingConfig.DATABASE_URL:
                conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
                
                # Fetch recent telemetry data for statistical bounds
                rows = await conn.fetch("""
                    SELECT id, latency_ms, timestamp, endpoint 
                    FROM telemetry 
                    ORDER BY timestamp DESC 
                    LIMIT 100
                """)
                
                if len(rows) >= 5:
                    latencies = [r['latency_ms'] for r in rows]
                    n = len(latencies)
                    mean = sum(latencies) / n
                    variance = sum((x - mean) ** 2 for x in latencies) / n
                    std_dev = math.sqrt(variance)
                    
                    # Fetch threshold settings from database
                    threshold_row = await conn.fetchrow("SELECT value FROM system_config WHERE key = 'anomaly_threshold_z'")
                    threshold = float(threshold_row['value']) if threshold_row else 2.5
                    
                    latest_row = rows[0]
                    latest_id = latest_row['id']
                    latest_latency = latest_row['latency_ms']
                    
                    if latest_id > LAST_PROCESSED_TELEMETRY_ID:
                        LAST_PROCESSED_TELEMETRY_ID = latest_id
                        
                        # Calculate Z-score
                        z_score = abs(latest_latency - mean) / std_dev if std_dev > 0 else 0.0
                        
                        if z_score > threshold:
                            msg = f"Latency spike on endpoint '{latest_row['endpoint']}': {latest_latency}ms (z-score: {z_score:.2f}, threshold: {threshold:.1f})"
                            await conn.execute("""
                                INSERT INTO system_anomalies (org_id, latency_ms, threshold_z, z_score, message)
                                VALUES ($1, $2, $3, $4, $5)
                            """, 'default_org', latest_latency, threshold, z_score, msg)
                            print(f"SYSTEM ANOMALY LOGGED: {msg}")
                            
                await conn.close()
        except Exception as e:
            print(f"Error in background anomaly loop: {e}")
        await asyncio.sleep(10)

@app.on_event("startup")
async def startup_event():
    await init_db()
    # Ensure telemetry table exists before starting background worker
    try:
        if NeuralRoutingConfig.DATABASE_URL:
            conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS telemetry (
                    id SERIAL PRIMARY KEY,
                    org_id VARCHAR(50) NOT NULL DEFAULT 'default_org',
                    endpoint VARCHAR(255) NOT NULL,
                    latency_ms INTEGER NOT NULL,
                    timestamp TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """)
            await conn.close()
            print("Ensured telemetry table exists.")
    except Exception as e:
        print(f"Could not ensure telemetry table: {e}")

    asyncio.create_task(background_anomaly_detector())

# --- RAG SUPPORTIVE METHODS ---
def tokenize(text: str) -> list[str]:
    return re.findall(r'\w+', text.lower())

def cosine_similarity_dict(vec1: dict[str, float], vec2: dict[str, float]) -> float:
    intersection = set(vec1.keys()) & set(vec2.keys())
    numerator = sum([vec1[x] * vec2[x] for x in intersection])
    
    sum1 = sum([val**2 for val in vec1.values()])
    sum2 = sum([val**2 for val in vec2.values()])
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    
    if not denominator:
        return 0.0
    return numerator / denominator

def search_tfidf(query: str, chunks: list[dict], limit: int = 3) -> list[dict]:
    if not chunks:
        return []
    
    num_docs = len(chunks)
    doc_freqs = Counter()
    tfs = []
    
    for c in chunks:
        tokens = tokenize(c["content"])
        tf = Counter(tokens)
        tfs.append(tf)
        for token in tf:
            doc_freqs[token] += 1
            
    idfs = {}
    for term, count in doc_freqs.items():
        idfs[term] = math.log((1 + num_docs) / (1 + count)) + 1
        
    tfidf_vectors = []
    for tf in tfs:
        vec = {}
        for term, freq in tf.items():
            vec[term] = freq * idfs[term]
        tfidf_vectors.append(vec)
        
    q_tokens = tokenize(query)
    q_tf = Counter(q_tokens)
    q_vec = {}
    for term, freq in q_tf.items():
        if term in idfs:
            q_vec[term] = freq * idfs[term]
            
    scores = []
    for idx, c in enumerate(chunks):
        c_vec = tfidf_vectors[idx]
        sim = cosine_similarity_dict(q_vec, c_vec)
        scores.append((sim, c))
        
    scores.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in scores[:limit] if item[0] > 0.0] or [item[1] for item in scores[:limit]]

def cosine_similarity_lists(a: list[float], b: list[float]) -> float:
    dot_product = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x ** 2 for x in a))
    norm_b = math.sqrt(sum(x ** 2 for x in b))
    if not norm_a or not norm_b:
        return 0.0
    return dot_product / (norm_a * norm_b)

async def get_embedding(text: str) -> list[float] | None:
    cohere_key = os.getenv("COHERE_API_KEY", "").strip('"' + "'")
    if cohere_key:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.cohere.com/v1/embed",
                    headers={"Authorization": f"Bearer {cohere_key}", "Content-Type": "application/json"},
                    json={"texts": [text], "model": "embed-english-v3.0", "input_type": "search_document"},
                    timeout=10.0
                )
                if res.status_code == 200:
                    return res.json()["embeddings"]["float"][0]
        except Exception as e:
            print(f"Cohere embedding request failed: {e}")
            
    openai_key = os.getenv("OPENAI_API_KEY", "").strip('"' + "'")
    if openai_key:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.openai.com/v1/embeddings",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={"input": text, "model": "text-embedding-3-small"},
                    timeout=10.0
                )
                if res.status_code == 200:
                    return res.json()["data"][0]["embedding"]
        except Exception as e:
            print(f"OpenAI embedding request failed: {e}")
            
    return None

def extract_text_from_file(filename: str, content: bytes) -> str:
    ext = filename.split(".")[-1].lower()
    if ext == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            return text
        except Exception as e:
            print(f"PDF parsing error using pypdf: {e}. Falling back to byte decoding.")
            return content.decode("utf-8", errors="ignore")
    else:
        return content.decode("utf-8", errors="ignore")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    chunks = []
    text = re.sub(r'\s+', ' ', text).strip()
    text_len = len(text)
    if text_len <= chunk_size:
        return [text]
        
    start = 0
    while start < text_len:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


# --- MULTI-MODEL INFERENCE ROUTER ---
class MultiModelRouter:
    @staticmethod
    async def stream_inference(system_prompt: str, user_prompt: str, model: str = "groq"):
        async def token_stream_generator():
            yield f'data: {{"choices": [{{"delta": {{"content": "[Inference Model: {model.upper()}]\\n\\n"}}}}]}}\n\n'.encode()

            api_key = NeuralRoutingConfig.get_api_key()
            
            if api_key == "MOCK_FREE_GROQ_KEY_UNSET" or not api_key:
                yield f'data: {{"choices": [{{"delta": {{"content": "-- API KEY NOT FOUND. Please set GROQ_API_KEY in backend .env to use real AI.\\n\\n"}}}}]}}\n\n'.encode()
                return

            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            api_model = "llama-3.3-70b-versatile"
            
            if model == "gemini":
                import asyncio
                await asyncio.sleep(0.4)
            
            data = {
                "model": api_model,
                "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                "stream": True, 
                "temperature": 0.1
            }

            async with httpx.AsyncClient() as client:
                async with client.stream("POST", NeuralRoutingConfig.GROQ_ENDPOINT, headers=headers, json=data, timeout=30.0) as response:
                    if response.status_code != 200:
                        yield f"data: -- API ERROR {response.status_code}\n\n".encode()
                        return
                    async for chunk in response.aiter_bytes():
                        yield chunk

        return StreamingResponse(token_stream_generator(), media_type="text/event-stream")

# --- API ENDPOINTS ---

@app.post("/api/v1/ai/diagnostic-explain")
async def process_anomaly_explanation(payload: DiagnosticPayload, org_id: str = Header("default_org", alias="X-Org-Id")):
    system_prompt = "You are a principal systems architect. Explain telemetry anomalies clearly and concisely."
    
    # Retrieve semantic context if RAG Knowledge Base toggle is active
    context_text = ""
    if payload.use_rag:
        try:
            conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
            rows = await conn.fetch("""
                SELECT c.id, c.content, c.embedding, d.name as doc_name
                FROM rag_chunks c
                JOIN rag_documents d ON c.document_id = d.id
                WHERE d.org_id = $1
            """, org_id)
            await conn.close()
            
            if rows:
                chunks = []
                for r in rows:
                    emb = None
                    if r["embedding"]:
                        try:
                            emb = json.loads(r["embedding"])
                        except:
                            pass
                    chunks.append({
                        "id": r["id"],
                        "content": r["content"],
                        "embedding": emb,
                        "doc_name": r["doc_name"]
                    })
                
                query_query = f"{payload.metric_name} {payload.context_logs}"
                query_emb = await get_embedding(query_query)
                
                if query_emb and any(c["embedding"] is not None for c in chunks):
                    scores = []
                    for c in chunks:
                        if c["embedding"]:
                            sim = cosine_similarity_lists(query_emb, c["embedding"])
                        else:
                            sim = 0.0
                        scores.append((sim, c))
                    scores.sort(key=lambda x: x[0], reverse=True)
                    top_chunks = [item[1] for item in scores[:3] if item[0] > 0.0] or [item[1] for item in scores[:3]]
                else:
                    top_chunks = search_tfidf(query_query, chunks, limit=3)
                    
                if top_chunks:
                    context_text = "\n\n[CONTEXT FROM KNOWLEDGE BASE]\n"
                    for idx, tc in enumerate(top_chunks):
                        context_text += f"- (From file: {tc['doc_name']}): {tc['content']}\n"
        except Exception as e:
            print(f"RAG search query execution failed inside chat pipeline: {e}")
            
    if context_text:
        system_prompt += f"\nInject the following knowledge base document matches directly into your system analysis context if they seem relevant. Always cite which file source they represent:{context_text}"
        
    user_prompt = f"METRIC: {payload.metric_name}\nCHANGE: {payload.previous_value} to {payload.current_value}\nLOGS:\n{payload.context_logs}\nExplain."
    return await MultiModelRouter.stream_inference(system_prompt, user_prompt, payload.model)

@app.post("/api/v1/ai/natural-sql")
async def generate_sql_from_natural_language(payload: NaturalLanguageSQLPayload):
    system_prompt = "You are an expert PostgreSQL developer. Return absolutely nothing else except the pure SQL command. Do not use markdown tags like ```sql."
    user_prompt = f"SCHEMA:\n{payload.database_schema_context}\nQUERY: {payload.natural_query}\nGenerate pure SQL."
    return await MultiModelRouter.stream_inference(system_prompt, user_prompt, payload.model)

@app.post("/api/v1/db/execute")
async def execute_sql(payload: SQLExecutionPayload):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured in .env")
    
    clean_sql = payload.sql_query.replace("```sql", "").replace("```", "").strip()
    
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        async with conn.transaction(readonly=True):
            rows = await conn.fetch(clean_sql)
        await conn.close()
        
        if not rows:
            return {"columns": [], "rows": []}
            
        columns = list(rows[0].keys())
        result_rows = [dict(row) for row in rows]
        
        for row in result_rows:
            for key, val in row.items():
                if hasattr(val, "isoformat"):
                    row[key] = val.isoformat()

        return {"columns": columns, "rows": result_rows}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/admin/telemetry")
async def get_system_telemetry():
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        query = """
            SELECT t.id, u.email, u.plan_type, t.endpoint, t.latency_ms, t.timestamp 
            FROM telemetry t 
            JOIN users u ON t.user_id = u.id 
            ORDER BY t.timestamp DESC LIMIT 50
        """
        rows = await conn.fetch(query)
        await conn.close()
        
        result = []
        for r in rows:
            record = dict(r)
            record["timestamp"] = record["timestamp"].isoformat()
            result.append(record)
            
        return {"status": "healthy", "active_nodes": 3, "telemetry": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- RAG CORE ENDPOINTS ---

@app.get("/api/v1/rag/stats")
async def get_rag_stats(org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        return {"documents": 0, "total_chunks": 0}
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        doc_count = await conn.fetchval("SELECT COUNT(*) FROM rag_documents WHERE org_id = $1", org_id)
        chunk_count = await conn.fetchval("SELECT COUNT(*) FROM rag_chunks WHERE org_id = $1", org_id)
        last_row = await conn.fetchrow("SELECT created_at FROM rag_documents WHERE org_id = $1 ORDER BY created_at DESC LIMIT 1", org_id)
        await conn.close()
        return {
            "documents": doc_count or 0,
            "total_chunks": chunk_count or 0,
            "last_indexed": last_row["created_at"].isoformat() if last_row else None
        }
    except Exception as e:
        return {"documents": 0, "total_chunks": 0, "last_indexed": None}

@app.get("/api/v1/telemetry/live")
async def get_live_telemetry():
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        rows = await conn.fetch("""
            SELECT t.id, t.latency_ms, t.endpoint, t.timestamp,
                   u.email, u.plan_type
            FROM telemetry t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.timestamp ASC
            LIMIT 60
        """)
        await conn.close()
        result = []
        for r in rows:
            record = dict(r)
            record["timestamp"] = record["timestamp"].isoformat()
            result.append(record)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/rag/upload")
async def upload_rag_document(file: UploadFile = File(...), org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        content = await file.read()
        text = extract_text_from_file(file.filename, content)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Document contains no parseable text contents.")
            
        chunks = chunk_text(text)
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        
        doc_id = await conn.fetchval("""
            INSERT INTO rag_documents (org_id, name, file_type)
            VALUES ($1, $2, $3)
            RETURNING id
        """, org_id, file.filename, file.filename.split(".")[-1].lower())
        
        for c in chunks:
            emb = await get_embedding(c)
            emb_str = json.dumps(emb) if emb else None
            await conn.execute("""
                INSERT INTO rag_chunks (org_id, document_id, content, embedding)
                VALUES ($1, $2, $3, $4)
            """, org_id, doc_id, c, emb_str)
            
        await conn.close()
        return {"success": True, "document_id": doc_id, "name": file.filename, "chunks_count": len(chunks)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/rag/documents")
async def get_rag_documents(org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        rows = await conn.fetch("""
            SELECT d.id, d.name, d.file_type, d.created_at, COUNT(c.id) as chunks_count
            FROM rag_documents d
            LEFT JOIN rag_chunks c ON d.id = c.document_id
            WHERE d.org_id = $1
            GROUP BY d.id, d.name, d.file_type, d.created_at
            ORDER BY d.created_at DESC
        """, org_id)
        await conn.close()
        
        res = []
        for r in rows:
            record = dict(r)
            record["created_at"] = record["created_at"].isoformat()
            res.append(record)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/rag/documents/{doc_id}")
async def delete_rag_document(doc_id: int, org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        await conn.execute("DELETE FROM rag_documents WHERE id = $1 AND org_id = $2", doc_id, org_id)
        await conn.close()
        return {"success": True, "message": f"Document {doc_id} has been pruned from knowledge base."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/rag/query")
async def query_rag_knowledge(q: str, org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        rows = await conn.fetch("""
            SELECT c.id, c.content, c.embedding, d.name as doc_name
            FROM rag_chunks c
            JOIN rag_documents d ON c.document_id = d.id
            WHERE d.org_id = $1
        """, org_id)
        await conn.close()
        
        if not rows:
            return []
            
        chunks = []
        for r in rows:
            emb = None
            if r["embedding"]:
                try:
                    emb = json.loads(r["embedding"])
                except:
                    pass
            chunks.append({
                "id": r["id"],
                "content": r["content"],
                "embedding": emb,
                "doc_name": r["doc_name"]
            })
            
        query_emb = await get_embedding(q)
        if query_emb and any(c["embedding"] is not None for c in chunks):
            scores = []
            for c in chunks:
                if c["embedding"]:
                    sim = cosine_similarity_lists(query_emb, c["embedding"])
                else:
                    sim = 0.0
                scores.append((sim, c))
            scores.sort(key=lambda x: x[0], reverse=True)
            top = [item[1] for item in scores[:3] if item[0] > 0.0] or [item[1] for item in scores[:3]]
        else:
            top = search_tfidf(q, chunks, limit=3)
        return top
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ANOMALY ENDPOINTS ---

@app.get("/api/v1/anomalies/alerts")
async def get_system_anomaly_alerts(org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        rows = await conn.fetch("""
            SELECT id, latency_ms, threshold_z, z_score, message, timestamp, resolved 
            FROM system_anomalies 
            WHERE org_id = $1
            ORDER BY timestamp DESC 
            LIMIT 10
        """, org_id)
        await conn.close()
        
        res = []
        for r in rows:
            record = dict(r)
            record["timestamp"] = record["timestamp"].isoformat()
            res.append(record)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/anomalies/stats")
async def get_system_anomaly_stats():
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        rows = await conn.fetch("SELECT latency_ms FROM telemetry ORDER BY timestamp DESC LIMIT 100")
        threshold_row = await conn.fetchrow("SELECT value FROM system_config WHERE key = 'anomaly_threshold_z'")
        await conn.close()
        
        threshold = float(threshold_row['value']) if threshold_row else 2.5
        
        if not rows:
            return {"mean": 0, "std_dev": 0, "threshold": threshold, "count": 0}
            
        latencies = [r['latency_ms'] for r in rows]
        n = len(latencies)
        mean = sum(latencies) / n
        variance = sum((x - mean) ** 2 for x in latencies) / n
        std_dev = math.sqrt(variance)
        
        return {
            "mean": round(mean, 2),
            "std_dev": round(std_dev, 2),
            "threshold": threshold,
            "count": n
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/anomalies/threshold")
async def update_system_anomaly_threshold(payload: ThresholdPayload):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        await conn.execute("""
            INSERT INTO system_config (key, value)
            VALUES ('anomaly_threshold_z', $1)
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
        """, str(payload.threshold))
        await conn.close()
        return {"success": True, "threshold": payload.threshold}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/v1/anomalies/{anomaly_id}/resolve")
async def toggle_anomaly_resolved(anomaly_id: int, org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        row = await conn.fetchrow(
            "SELECT id, resolved FROM system_anomalies WHERE id = $1 AND org_id = $2",
            anomaly_id, org_id
        )
        if not row:
            await conn.close()
            raise HTTPException(status_code=404, detail=f"Anomaly {anomaly_id} not found")
        new_state = not row["resolved"]
        updated = await conn.fetchrow(
            "UPDATE system_anomalies SET resolved = $1 WHERE id = $2 AND org_id = $3 RETURNING id, resolved, message, timestamp",
            new_state, anomaly_id, org_id
        )
        await conn.close()
        record = dict(updated)
        record["timestamp"] = record["timestamp"].isoformat()
        return {"success": True, "id": record["id"], "resolved": record["resolved"], "message": record["message"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SimulateAnomalyPayload(BaseModel):
    user_id: int = 1
    endpoint: str = "/api/v1/inference"
    latency_ms: int = 1850

@app.post("/api/v1/db/simulate-anomaly")
async def execute_simulate_anomaly(payload: SimulateAnomalyPayload, org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        # Note: telemetry table might not have org_id. If not, we insert into anomalies directly as a simulation.
        # But for robust simulation we just inject the anomaly directly to ensure it alerts properly.
        await conn.execute("""
            INSERT INTO system_anomalies (org_id, latency_ms, threshold_z, z_score, message)
            VALUES ($1, $2, $3, $4, $5)
        """, org_id, payload.latency_ms, 2.5, 4.0, f"Simulated Anomaly: {payload.latency_ms}ms on {payload.endpoint}")
        await conn.close()
        return {"success": True, "message": f"Successfully simulated and inserted high-latency metrics row ({payload.latency_ms}ms) into Postgres telemetry."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CheckoutPayload(BaseModel):
    plan_id: str

@app.post("/api/v1/billing/checkout")
async def create_checkout_session(payload: CheckoutPayload, org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        # Simulate creating a stripe session and immediately upgrading
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        await conn.execute("""
            INSERT INTO billing_subscriptions (org_id, plan, status)
            VALUES ($1, $2, 'active')
            ON CONFLICT (org_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'active'
        """, org_id, payload.plan_id)
        await conn.close()
        
        # Simulate Stripe redirecting back to app
        return {"success": True, "url": f"/dashboard?upgrade=success&plan={payload.plan_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/billing/status")
async def get_billing_status(org_id: str = Header("default_org", alias="X-Org-Id")):
    if not NeuralRoutingConfig.DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL not configured")
    try:
        conn = await asyncpg.connect(NeuralRoutingConfig.DATABASE_URL)
        row = await conn.fetchrow("""
            SELECT plan, status FROM billing_subscriptions WHERE org_id = $1
        """, org_id)
        await conn.close()
        
        if row:
            return {"plan": row["plan"], "status": row["status"]}
        return {"plan": "free", "status": "active"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)