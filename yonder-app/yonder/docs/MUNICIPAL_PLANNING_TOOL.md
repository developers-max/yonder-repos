# Municipal Planning QA Tool

## Overview

The `askMunicipalPlanning` tool enables users to ask questions about municipal planning regulations directly in chat, with answers sourced from official PDM/POUM documents using RAG.

## Features

- 🏛️ **Official Document Queries** - Answers from municipal planning documents
- 🎯 **Context-Aware** - Auto-detects municipality from plot context
- 📝 **Source Citations** - References specific planning documents
- 🌍 **Municipality Lookup** - Accepts municipality name or plot ID

## Usage Examples

### In Chat

Users can ask questions like:

```
"What are the zoning regulations in Alella?"
"What building height restrictions apply to this plot?"
"Tell me about construction permits for residential development"
"Are there protected areas in this municipality?"
"What are the land use classifications?"
```

### How It Works

1. **Automatic Context Detection**
   - If user is viewing a plot, uses that plot's municipality
   - Or accepts explicit municipality name

2. **RAG Query**
   - Queries official municipal planning documents
   - Returns answers with source citations
   - Currently supports: **Alella (Spain)**

3. **Response Format**
   ```typescript
   {
     municipalityId: number;
     municipalityName: string;
     question: string;
     answer: string; // Detailed answer from official docs
     sources: Array<{
       documentTitle: string;
       documentType: string;
       similarity: number;
       preview: string;
     }>;
   }
   ```

## Tool Parameters

```typescript
{
  question: string;           // Required: The planning question
  municipalityName?: string;  // Optional: Explicit municipality
  plotId?: string;           // Optional: Get municipality from plot
}
```

## Examples

### Example 1: Using Plot Context

```typescript
// User is viewing plot in Alella
User: "What are the building height restrictions here?"

// Tool automatically uses Alella from plot context
askMunicipalPlanning({
  question: "What are the building height restrictions?",
  plotId: "current-plot-id"
})
```

### Example 2: Explicit Municipality

```typescript
User: "What are zoning regulations in Alella?"

askMunicipalPlanning({
  question: "What are the main zoning classifications and regulations?",
  municipalityName: "Alella"
})
```

### Example 3: No Municipality Context

```typescript
User: "What are construction requirements?"

// Tool will return error asking for municipality
Error: "No municipality context available. Please specify a municipality name."

Suggestions:
- List available municipalities
- Specify municipality name explicitly
- Ask about a specific plot
```

## Response Handling

### Success Response

The assistant receives:
- Detailed answer from official planning documents
- Source document citations
- Similarity scores for each source
- Suggestions for follow-up actions

### Error Handling

**Municipality Not Found:**
```
"Municipality not found or does not have planning documents available."
```

**No Documents Available:**
```
Only Alella is currently supported. Other municipalities will show:
"No documents found for municipality ID X."
```

**No Context:**
```
"No municipality context. Please specify municipality or plot ID."
```

## Currently Supported Municipalities

- ✅ **Alella** (Spain) - Full PDM/POUM documentation

## Integration with Other Tools

Works seamlessly with:

1. **getPlotDetails** - Get municipality from plot
2. **generateReport** - Include RAG answers in reports
3. **searchPlots** - Filter by municipalities with planning docs

## Example Chat Flow

```
User: "Show me plots in Alella"
Assistant: [Uses searchPlots tool]

User: "What are the zoning regulations there?"
Assistant: [Uses askMunicipalPlanning with municipalityName: "Alella"]
  "According to the POUM 2014 for Alella municipality:
   
   The main zoning classifications are:
   - Residential zones (R1, R2, R3)
   - Mixed-use zones
   - Protected natural areas
   
   Source: POUM 2014 - Normativa Urbanística"

User: "What about building heights?"
Assistant: [Uses askMunicipalPlanning again]
  "Building height restrictions in Alella vary by zone:
   - R1 zones: Maximum 9 meters (PB+2)
   - R2 zones: Maximum 12 meters (PB+3)
   
   Source: POUM 2014 - Building Regulations"
```

## Adding More Municipalities

To enable this tool for new municipalities:

1. Generate embeddings for municipality's planning documents
2. Insert into `pdm_document_embeddings` table
3. Tool will automatically work for that municipality
4. No code changes needed!

## Technical Details

### Municipality Resolution Priority

1. **plotId provided** → Get municipality from plot
2. **municipalityName provided** → Lookup by name
3. **Neither provided** → Return error

### RAG Configuration

- Uses `topK: 5` for comprehensive context
- Queries GPT-5-mini for answer generation
- Returns source document citations
- Similarity threshold for relevance

### Performance

- Query time: ~2-3 seconds
- Cost per query: ~$0.0004
- Caches available municipalities list

## Benefits

✅ **Authoritative Information** - Direct from official documents
✅ **Source Citations** - Transparent and verifiable
✅ **Context-Aware** - Uses plot context automatically
✅ **Flexible** - Works with or without plot context
✅ **Extensible** - Easy to add new municipalities

---

**Status**: ✅ Ready for production
**Supported**: Alella (Spain)
**Next**: Add more municipalities as embeddings become available
