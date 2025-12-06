#!/usr/bin/env node
import { askMunicipalityQuestionAdvanced, getAdvancedRAGConfig } from '../municipal_qa_advanced';

async function testAlellaAdvancedQA() {
  console.log('=== Testing Phase 2 & 3 Advanced RAG System ===\n');
  
  const config = getAdvancedRAGConfig();
  console.log('Configuration:');
  console.log(`  Phase: ${config.phase}`);
  console.log(`  Model: ${config.model}`);
  console.log(`  Temperature: ${config.temperature}`);
  console.log(`  Base Top-K: ${config.baseTopK}`);
  console.log(`  Similarity Threshold: ${config.similarityThreshold}`);
  console.log('\nOptimizations Applied:');
  config.optimizations.forEach(opt => console.log(`  ✓ ${opt}`));
  console.log('\n' + '='.repeat(70));

  const ALELLA_ID = 401;

  const testQuestions = [
    // Code lookups (should get topK=3, use BM25)
    { q: 'What information can you find on code 13c1?', note: 'Code lookup (English)' },
    { q: 'Quina informació tens sobre el codi 13c1?', note: 'Code lookup (Catalan)' },
    
    // Simple questions
    { q: 'Quines són les alçades màximes permeses?', note: 'Simple (Catalan)' },
    { q: 'What is the POUM document?', note: 'Simple (English)' },
    
    // Complex questions (should get topK=7)
    { q: 'Quin és el règim d\'usos del sòl urbà, les restriccions d\'altura, i els requisits d\'aparcament?', note: 'Complex (Catalan)' },
    
    // Comparative (should get topK=10)
    { q: 'What are the differences between zones 13c1 and 13c2?', note: 'Comparative (English)' },
  ];

  let totalCost = 0;
  let totalTime = 0;

  for (let i = 0; i < testQuestions.length; i++) {
    const { q: question, note } = testQuestions[i];
    const startTime = Date.now();
    
    console.log(`\n[${i + 1}/${testQuestions.length}] ${note}`);
    console.log(`Question: ${question}`);
    console.log('='.repeat(70));

    try {
      const response = await askMunicipalityQuestionAdvanced(
        ALELLA_ID,
        question,
        { verbose: true }
      );

      const elapsedTime = Date.now() - startTime;
      totalTime += elapsedTime;

      console.log('\n💡 Answer:');
      console.log(response.answer);

      console.log('\n📚 Sources:');
      response.sources.forEach((source, idx) => {
        const score = source.combined_score || source.similarity;
        console.log(`\n[${idx + 1}] ${source.document_title}`);
        console.log(`    Chunk ${source.chunk_index} | Score: ${(score * 100).toFixed(1)}%`);
        if (source.keyword_rank) {
          console.log(`    Keyword rank: ${source.keyword_rank.toFixed(3)}`);
        }
        console.log(`    Preview: ${source.chunk_text.slice(0, 150)}...`);
      });

      console.log('\n📊 Metadata:');
      console.log(`    Query Type: ${response.metadata.queryClass || 'N/A'}`);
      console.log(`    Search Method: ${response.metadata.searchMethod}`);
      console.log(`    Top-K Used: ${response.metadata.topK}`);
      console.log(`    Average Score: ${(response.metadata.avgSimilarity * 100).toFixed(1)}%`);
      console.log(`    Tokens Used: ${response.metadata.tokensUsed}`);
      console.log(`    Response Time: ${elapsedTime}ms`);
      
      if (response.metadata.tokensUsed) {
        const cost = (response.metadata.tokensUsed * 0.00015 / 1000);
        totalCost += cost;
        console.log(`    Cost: $${cost.toFixed(5)}`);
      }

      // Small delay between questions
      if (i < testQuestions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      console.error('\n❌ Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('=== Summary ===');
  console.log(`Total Questions: ${testQuestions.length}`);
  console.log(`Total Cost: $${totalCost.toFixed(5)}`);
  console.log(`Average Cost per Question: $${(totalCost / testQuestions.length).toFixed(5)}`);
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Average Time per Question: ${(totalTime / testQuestions.length / 1000).toFixed(2)}s`);
  console.log('\n✅ Phase 2 & 3 advanced optimization test complete!');
  console.log('\nKey Improvements:');
  console.log('  • Hybrid search combines semantic + keyword matching');
  console.log('  • Dynamic Top-K adjusts based on question complexity');
  console.log('  • Better handling of code lookups (13c1, etc.)');
  console.log('  • Improved cross-language performance');
}

testAlellaAdvancedQA().catch(console.error);
