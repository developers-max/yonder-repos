#!/usr/bin/env node
import * as readline from 'readline';
import { askMunicipalityQuestionAdvanced as askMunicipalityQuestion, getAdvancedRAGConfig as getRAGConfig } from '../municipal_qa_advanced';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function interactiveQA() {
  console.log('=== Interactive Municipal Planning Assistant (Advanced RAG) ===\n');
  
  const config = getRAGConfig();
  console.log('🚀 Phase 2 & 3 Optimizations Active:');
  config.optimizations.forEach(opt => console.log(`   ✓ ${opt}`));
  console.log('\n📍 Municipality: Alella (ID: 401)');
  console.log('💬 Ask questions about planning documents');
  console.log('📝 Type "help" for examples, "config" for settings, or "exit" to quit\n');

  const ALELLA_ID = 401;
  let questionCount = 0;
  let totalCost = 0;

  const askQuestion = () => {
    rl.question('❓ Your question: ', async (input) => {
      const question = input.trim();

      if (question.toLowerCase() === 'exit') {
        console.log('\n📊 Session Summary:');
        console.log(`   Questions Asked: ${questionCount}`);
        console.log(`   Total Cost: $${totalCost.toFixed(5)}`);
        if (questionCount > 0) {
          console.log(`   Avg Cost/Question: $${(totalCost / questionCount).toFixed(5)}`);
        }
        console.log('\n👋 Goodbye!');
        rl.close();
        return;
      }

      if (question.toLowerCase() === 'help') {
        console.log('\n📖 Example Questions:');
        console.log('   • What are the building height limits?');
        console.log('   • What zoning classifications exist?');
        console.log('   • What are parking requirements?');
        console.log('   • Are there protected natural areas?');
        console.log('   • What is the POUM document?\n');
        askQuestion();
        return;
      }

      if (question.toLowerCase() === 'config') {
        console.log('\n⚙️ Current Configuration:');
        console.log(`   Model: ${config.model}`);
        console.log(`   Temperature: ${config.temperature}`);
        console.log(`   Max Tokens: ${config.maxTokens}`);
        console.log(`   Base Top-K: ${config.baseTopK} (dynamic)`);
        console.log(`   Similarity Threshold: ${config.similarityThreshold}`);
        console.log(`   Hybrid Search: ${config.useHybridSearch ? 'Enabled' : 'Disabled'}`);
        console.log(`   Query Classification: ${config.useQueryClassification ? 'Enabled' : 'Disabled'}`);
        console.log(`   Embedding Model: ${config.embeddingModel}\n`);
        askQuestion();
        return;
      }

      if (!question) {
        askQuestion();
        return;
      }

      try {
        const startTime = Date.now();
        
        console.log('\n🔍 Processing...');
        const response = await askMunicipalityQuestion(
          ALELLA_ID,
          question,
          { topK: 5 }
        );

        const elapsedTime = Date.now() - startTime;
        questionCount++;

        console.log('\n💡 Answer:');
        console.log(response.answer);

        console.log('\n📚 Sources:');
        response.sources.forEach((source, idx) => {
          console.log(`   [${idx + 1}] ${source.document_title} (Chunk ${source.chunk_index})`);
          console.log(`       Similarity: ${(source.similarity * 100).toFixed(1)}%`);
        });

        if (response.metadata.tokensUsed) {
          const cost = (response.metadata.tokensUsed * 0.00015 / 1000);
          totalCost += cost;
          console.log(`\n⏱️  Response time: ${elapsedTime}ms | 💰 Cost: $${cost.toFixed(5)}`);
        }

        askQuestion();
      } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        askQuestion();
      }
    });
  };

  askQuestion();
}

interactiveQA();
