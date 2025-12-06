#!/usr/bin/env node
import { askMunicipalityQuestion, getRAGConfig } from '../municipal_qa';

async function testAlellaQA() {
  console.log('=== Testing Phase 1 Optimized RAG System ===\n');
  
  const config = getRAGConfig();
  console.log('Configuration:');
  console.log(`  Phase: ${config.phase}`);
  console.log(`  Model: ${config.model}`);
  console.log(`  Temperature: ${config.temperature}`);
  console.log(`  Similarity Threshold: ${config.similarityThreshold}`);
  console.log(`  Top-K: ${config.topK}`);
  console.log('\nOptimizations Applied:');
  config.optimizations.forEach(opt => console.log(`  ✓ ${opt}`));
  console.log('\n' + '='.repeat(70));

  const ALELLA_ID = 401;

  const testQuestions = [
    // Specific codes (English)
    'What information can you find on code 13d1?',
    'What information can you find on code 13c1?',
    // Catalan questions (better similarity)
    'Quina informació pots trobar sobre la qualificació 13c1?',
    'Quines són les alçades màximes permeses?',
    'Quin és el règim d\'usos del sòl urbà?',
    // English questions
    'What are the main zoning classifications in Alella?',
    'What are the building height restrictions in residential areas?'
  ];

  let totalCost = 0;
  let totalTime = 0;

  for (let i = 0; i < testQuestions.length; i++) {
    const question = testQuestions[i];
    const startTime = Date.now();
    
    console.log(`\n[${ i + 1}/${testQuestions.length}] Question: ${question}`);
    console.log('='.repeat(70));

    try {
      const response = await askMunicipalityQuestion(
        ALELLA_ID,
        question,
        { topK: 5, verbose: true }
      );

      const elapsedTime = Date.now() - startTime;
      totalTime += elapsedTime;

      console.log('\n💡 Answer:');
      console.log(response.answer);

      console.log('\n📚 Sources:');
      response.sources.forEach((source, idx) => {
        console.log(`\n[${idx + 1}] ${source.document_title}`);
        console.log(`    Chunk ${source.chunk_index} | Similarity: ${(source.similarity * 100).toFixed(1)}%`);
        console.log(`    Preview: ${source.chunk_text.slice(0, 150)}...`);
      });

      console.log('\n📊 Metadata:');
      console.log(`    Average Similarity: ${(response.metadata.avgSimilarity * 100).toFixed(1)}%`);
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
  console.log('\n✅ Phase 1 optimization test complete!');
}

testAlellaQA().catch(console.error);
