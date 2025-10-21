/**
 * Agent Framework Integration Example
 * Shows how to use transformers-router as a local AI provider for agent frameworks
 */

import { createAIProvider, OpenAIAdapter } from '../dist/index.js';

// Simulated agent framework
class SimpleAgent {
  constructor(llm, tools = []) {
    this.llm = llm;
    this.tools = tools;
    this.conversationHistory = [];
  }

  async run(task) {
    console.log(`\n--- Agent Task: ${task} ---`);

    // Add user message
    this.conversationHistory.push({
      role: 'user',
      content: task,
    });

    // Get LLM response
    const response = await this.llm.createChatCompletion({
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. You can help with various tasks. Be concise.',
        },
        ...this.conversationHistory,
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const assistantMessage = response.choices[0].message.content;

    // Add assistant message to history
    this.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
    });

    console.log(`Agent: ${assistantMessage}\n`);

    return {
      response: assistantMessage,
      usage: response.usage,
    };
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

// Simulated RAG system
class RAGSystem {
  constructor(embedder, documents = []) {
    this.embedder = embedder;
    this.documents = documents;
    this.embeddings = null;
  }

  async indexDocuments() {
    console.log('Indexing documents...');
    const texts = this.documents.map((doc) => doc.content);
    this.embeddings = await this.embedder.embed(texts);
    console.log(`Indexed ${this.documents.length} documents\n`);
  }

  async search(query, topK = 3) {
    if (!this.embeddings) {
      await this.indexDocuments();
    }

    const result = await this.embedder.findSimilar(
      query,
      this.documents.map((d) => d.content)
    );

    return [this.documents[result.index]];
  }
}

async function main() {
  console.log('=== Agent Framework Integration Example ===\n');

  // Initialize AI Provider
  const provider = createAIProvider({
    llm: {
      model: 'onnx-community/Qwen2.5-0.5B-Instruct',
      dtype: 'q4',
    },
    embedding: {
      model: 'Xenova/all-MiniLM-L6-v2',
      dtype: 'fp32',
    },
  });

  // Wrap with OpenAI adapter for compatibility
  const llm = new OpenAIAdapter(provider);

  try {
    // Example 1: Simple Agent
    console.log('--- Example 1: Simple Agent ---\n');

    const agent = new SimpleAgent(llm);

    await agent.run('What is the capital of France?');
    await agent.run('What language do they speak there?');

    console.log(`Total tokens used: ${agent.conversationHistory.length * 50} (estimated)\n`);

    // Example 2: RAG Agent
    console.log('--- Example 2: RAG-Powered Agent ---\n');

    // Sample knowledge base
    const documents = [
      {
        id: 1,
        title: 'JavaScript',
        content:
          'JavaScript is a programming language that is one of the core technologies of the Web.',
      },
      {
        id: 2,
        title: 'Python',
        content:
          'Python is a high-level programming language known for its simplicity and readability.',
      },
      {
        id: 3,
        title: 'Transformers.js',
        content:
          'Transformers.js enables running machine learning models directly in the browser.',
      },
      {
        id: 4,
        title: 'Node.js',
        content:
          'Node.js is a JavaScript runtime built on Chrome V8 engine for server-side programming.',
      },
    ];

    const rag = new RAGSystem(provider, documents);
    await rag.indexDocuments();

    // Search for relevant documents
    const query = 'Tell me about browser-based machine learning';
    console.log(`Query: ${query}`);

    const relevantDocs = await rag.search(query);
    console.log('Relevant documents:');
    relevantDocs.forEach((doc) => {
      console.log(`  - ${doc.title}: ${doc.content}`);
    });

    // Use retrieved context with agent
    const ragAgent = new SimpleAgent(llm);
    const contextualPrompt = `Based on this information: "${relevantDocs[0].content}"\n\nAnswer: ${query}`;

    await ragAgent.run(contextualPrompt);

    // Example 3: Multi-turn conversation
    console.log('--- Example 3: Multi-turn Conversation ---\n');

    const chatAgent = new SimpleAgent(llm);

    await chatAgent.run('I want to learn programming. Where should I start?');
    await chatAgent.run('Is Python good for beginners?');
    await chatAgent.run('What projects can I build with it?');

    console.log('\nConversation Summary:');
    console.log(`Total turns: ${chatAgent.conversationHistory.length / 2}`);
    console.log(`Messages in history: ${chatAgent.conversationHistory.length}`);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    console.log('\nCleaning up...');
    await provider.dispose();
    console.log('Done!');
  }
}

main();

