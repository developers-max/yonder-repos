# RAG Support Scripts

Testing, validation, and utility scripts for the RAG system.

## 📁 Files Overview

### Testing Scripts

- **`test_alella_qa_advanced.ts`** - Main test script for Phase 2 & 3 RAG
  ```bash
  npm run rag-test
  ```

- **`test_alella_qa.ts`** - Test script for Phase 1 basic RAG
  ```bash
  npm run rag-test-basic
  ```

- **`test_query_translation.ts`** - Demonstrates query translation feature
  ```bash
  npm run rag-test-translation
  ```

### Interactive Tools

- **`interactive_qa.ts`** - Interactive CLI for asking questions
  ```bash
  npm run rag-interactive
  ```
  
  Commands:
  - `help` - Show example questions
  - `config` - Display current configuration
  - `exit` - Quit with session summary

### Debugging Utilities

- **`debug_similarity.ts`** - Debug similarity scores and thresholds
  ```bash
  ts-node src/rag/support_scripts/debug_similarity.ts
  ```

- **`check_embeddings.ts`** - Check embedding statistics
  ```bash
  ts-node src/rag/support_scripts/check_embeddings.ts
  ```

### Embedding Management

- **`clear_and_reembed.ts`** - Clear and prepare for re-embedding
  ```bash
  ts-node src/rag/support_scripts/clear_and_reembed.ts
  ```

- **`re_embed_alella.ts`** - Re-embed Alella documents
  ```bash
  ts-node src/rag/support_scripts/re_embed_alella.ts
  ```

## 🚀 Quick Start

### Run Tests

```bash
# Advanced RAG test (recommended)
npm run rag-test

# Translation demo
npm run rag-test-translation

# Basic RAG test (comparison)
npm run rag-test-basic
```

### Interactive Mode

```bash
npm run rag-interactive
```

### Debug Issues

```bash
# Check embeddings
ts-node src/rag/support_scripts/check_embeddings.ts

# Debug similarity scores
ts-node src/rag/support_scripts/debug_similarity.ts
```

## 📊 Test Output

### Advanced RAG Test

Shows:
- Configuration details
- Query classification
- Translation (if applicable)
- Search method used
- Retrieved chunks with scores
- LLM answer with citations
- Performance metrics (cost, time)

### Translation Test

Demonstrates:
- Language detection
- Automatic translation
- Similarity improvement
- Cross-language performance

### Interactive CLI

Provides:
- Real-time Q&A
- Cost tracking per question
- Session summary
- Configuration display

## 🔧 Utilities Purpose

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `test_alella_qa_advanced.ts` | Test Phase 2 & 3 optimizations | After changes, before deployment |
| `test_query_translation.ts` | Validate translation feature | Testing cross-language support |
| `interactive_qa.ts` | Manual testing and demos | Showing capabilities, ad-hoc testing |
| `debug_similarity.ts` | Troubleshoot low scores | When queries return poor results |
| `check_embeddings.ts` | Verify embedding quality | After re-embedding, data validation |
| `clear_and_reembed.ts` | Reset embeddings | Changing chunk size or model |

## 📚 Related Documentation

- **Core RAG modules**: `../municipal_qa_advanced.ts`, `../query_translator.ts`
- **Full guide**: `../README.md`
- **Implementation docs**: `/PHASE2_3_IMPLEMENTATION.md`
- **Optimization guide**: `/RAG_OPTIMIZATION.md`

## ⚠️ Important Notes

### These are NOT Production Code

Support scripts are for:
- ✅ Development and testing
- ✅ Debugging and validation
- ✅ Demonstrations
- ✅ One-off utilities

They are NOT for:
- ❌ Production APIs
- ❌ User-facing applications
- ❌ Automated pipelines (unless specifically designed for it)

### Production Code Location

For production use, import from parent directory:

```typescript
// ✅ Production
import { askMunicipalityQuestionAdvanced } from '../municipal_qa_advanced';

// ❌ Not for production
import { testAlellaQA } from './test_alella_qa';
```

## 🎯 Typical Workflow

### 1. Development

```bash
# Make changes to core RAG modules
vim ../municipal_qa_advanced.ts

# Test changes
npm run rag-test

# Validate specific features
npm run rag-test-translation
```

### 2. Debugging

```bash
# Check similarity scores
ts-node src/rag/support_scripts/debug_similarity.ts

# Verify embeddings
ts-node src/rag/support_scripts/check_embeddings.ts

# Interactive testing
npm run rag-interactive
```

### 3. Re-embedding

```bash
# Clear existing embeddings
ts-node src/rag/support_scripts/clear_and_reembed.ts

# Re-create with new settings
npm run test-alella-embeddings

# Validate
npm run rag-test
```

---

**Location**: `/src/rag/support_scripts/`  
**Core modules**: `/src/rag/`  
**Purpose**: Testing, validation, and development support
