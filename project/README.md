🔎 Perplexity Clone

A Perplexity-inspired AI search and chat application built using LangChain, SearXNG, and LLMs. The project implements multiple specialized agents for web search, Reddit search, YouTube search, video discovery, writing assistance, and follow-up suggestions.

🚀 Features

- 🔍 Web Search — Search the web and generate AI-powered answers.
- 🟠 Reddit Search — Search Reddit discussions and summarize relevant information.
- ▶️ YouTube Search — Find YouTube-related information and generate answers.
- 🎥 Video Search — Retrieve and display relevant video results.
- ✍️ Writing Assistant — Generate, rewrite, and improve content using conversation context.
- 💡 Suggestion Generator — Generate relevant follow-up questions from the conversation.
- 📚 Academic Search — Search academic sources.
- 🖼️ Image Search — Retrieve relevant images.
- ⚡ Streaming Responses — Stream AI-generated responses in real time.
- 💬 Conversation History — Use previous messages to understand follow-up queries.

---

🧠 Architecture

The project uses LangChain Runnable composition instead of LangGraph.

Search & Answer

User Query
    ↓
Query Rephrasing
    ↓
SearXNG Search
    ↓
Document Reranking
    ↓
Context Formatting
    ↓
LLM
    ↓
Streaming Response

Search & List

User Query
    ↓
Query Rephrasing
    ↓
SearXNG Search
    ↓
Result Filtering
    ↓
Structured Results

Writing Assistant

Chat History + Query
        ↓
ChatPromptTemplate
        ↓
       LLM
        ↓
StringOutputParser
        ↓
Streaming Response

Suggestion Generator

Chat History
     ↓
    Prompt
     ↓
     LLM
     ↓
ListLineOutputParser
     ↓
Suggestions

---

🤖 Agents

Agent| Purpose| Streaming
"academicSearchAgent"| Academic search and answers| ✅
"imageSearchAgent"| Image search| ❌
"redditSearchAgent"| Reddit search and answers| ✅
"webSearchAgent"| General web search and answers| ✅
"youtubeSearchAgent"| YouTube search and answers| ✅
"videoSearchAgent"| Video result discovery| ❌
"writingAssistantAgent"| Writing assistance| ✅
"suggestionGeneratorAgent"| Follow-up question generation| ❌

---

🛠️ Tech Stack

- Node.js
- TypeScript / JavaScript
- LangChain
- SearXNG
- LLMs
- Embeddings
- EventEmitter
- RunnableSequence
- RunnableMap
- RunnableLambda
- PromptTemplate
- ChatPromptTemplate
- StringOutputParser
- ListLineOutputParser

---

🔗 LangChain Components

The project makes extensive use of LangChain Runnable primitives:

RunnableSequence
RunnableMap
RunnableLambda
PromptTemplate
ChatPromptTemplate
MessagesPlaceholder
StringOutputParser
ListLineOutputParser

These components are composed together to create reusable processing pipelines for each agent.

---

⚡ Streaming

Search-and-answer agents use LangChain's "streamEvents()" to provide real-time responses.

The shared streaming utility handles:

{
  "type": "sources",
  "data": []
}

and:

{
  "type": "response",
  "data": "response chunk"
}

When generation finishes, an "end" event is emitted.

This allows the frontend to display sources and AI responses progressively.

---

🔍 Search & Retrieval

SearXNG is used as the search layer.

Different agents use different search sources:

Reddit      → reddit
YouTube     → youtube
Web         → default SearXNG engines
Academic    → academic-focused engines
Images      → image search engines

Search-and-answer agents also perform document reranking before generating the final response.

Retrieved Documents
        ↓
   Embeddings
        ↓
Similarity Calculation
        ↓
Filtering
        ↓
Sorting
        ↓
Top Documents
        ↓
Context
        ↓
LLM

---

💬 Conversation Context

Agents that support conversation use the previous chat history to improve understanding of follow-up questions.

Example:

User:
What is RAG?

Assistant:
RAG stands for Retrieval-Augmented Generation...

User:
What are its advantages?

The second question can be interpreted using the previous conversation instead of treating it as an isolated query.

---

🧩 Project Structure

project/
│
├── agents/
│   ├── academicSearchAgent
│   ├── imageSearchAgent
│   ├── redditSearchAgent
│   ├── webSearchAgent
│   ├── youtubeSearchAgent
│   ├── videoSearchAgent
│   ├── writingAssistantAgent
│   └── suggestionGeneratorAgent
│
├── utils/
│   └── handleStream
│
├── routes/
│
├── lib/
│
├── package.json
├── tsconfig.json
└── README.md

«The exact directory structure may vary depending on the project implementation.»

---

⚙️ Installation

Clone the repository

git clone <YOUR_REPOSITORY_URL>
cd <PROJECT_DIRECTORY>

Install dependencies

npm install

Configure environment variables

Create a ".env" file and add the API keys and configuration required by your project.

Example:

LLM_API_KEY=your_api_key
SEARXNG_URL=your_searxng_url

Use the actual variable names defined by the project configuration.

Run the project

npm run dev

---

🧪 Testing

The agents can be tested individually before integrating them into the complete application.

Example test categories:

Normal query

What are the advantages of React?

Greeting

Hi

Search-and-answer agents should gracefully handle queries that don't require searching.

Follow-up query

User: What is LangChain?

Assistant: ...

User: What are its main components?

This verifies that conversation history is correctly used during query processing.

---

📌 Design Principles

No LangGraph

The project intentionally uses plain LangChain Runnable composition.

Reusable Streaming

Common streaming behavior is extracted into a shared "handleStream" utility.

Specialized Agents

Each agent has a focused responsibility instead of relying on one large general-purpose chain.

Structured Results

Search results are transformed into predictable structures before being consumed by the frontend.

Graceful Error Handling

Agents follow a consistent success/error response structure and expose errors through the streaming contract where applicable.

---

📊 Response Format

Successful responses follow:

{
  "success": true,
  "data": {}
}

Errors follow:

{
  "success": false,
  "error": "Error message"
}

---

👨‍💻 Author

Anisha Sudhir Vikhar

B.Tech — Computer Science & Engineering

---

📄 Assignment

This project was developed as part of an internship assignment focused on building multiple search and chat agents using LangChain RunnableSequence and related Runnable primitives.