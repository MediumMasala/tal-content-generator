import { executeContentGeneration } from './mastra/workflows/content-generation';
import { generateLinkedInFriendly } from './mastra/tools/linkedin-friendly';

async function runFullPipeline(linkedinUrl: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running full pipeline for: ${linkedinUrl}`);
  console.log('='.repeat(60));

  // Step 1-3: Extract, Build Personality, Generate
  console.log('\n[Pipeline] Running extraction + personality + generation...');
  const result = await executeContentGeneration({
    linkedinUrl,
    forceRefresh: false,
  });

  if (!result.success) {
    console.error('\n[Pipeline] FAILED:', result.error);
    console.error('Step:', (result as any).step);
    return;
  }

  console.log('\n--- PERSON ---');
  console.log(`Name: ${result.personName}`);
  console.log(`Username: ${result.username}`);
  console.log(`Writing Style Available: ${result.writingStyleAvailable}`);

  console.log('\n--- MAIN POST ---');
  console.log(result.content);
  console.log('\n--- ALT VERSION ---');
  console.log(result.altVersion);

  // Step 4: LinkedIn Friendly optimization
  console.log('\n[Pipeline] Running viral optimization...');
  const friendlyResult = await generateLinkedInFriendly({
    username: result.username,
    generatedPost: result.content,
    altVersion: result.altVersion,
    viralPostsCsvPath: './data/viral-posts.csv'
  });

  console.log('\n' + '='.repeat(60));
  console.log('OPTIMIZED RESULTS');
  console.log('='.repeat(60));

  console.log('\n--- OPTIMIZED POST ---');
  console.log(friendlyResult.optimizedPost);
  console.log('\n--- ALT OPTIMIZED ---');
  console.log(friendlyResult.altOptimizedPost);
  console.log('\n--- STRUCTURE USED ---');
  console.log(friendlyResult.structureUsed);
  console.log('\n--- PERSONALITY NOTES ---');
  console.log(friendlyResult.personalityNotes);

  console.log('\n--- TIMING ---');
  console.log(`Extraction: ${result.timing.extractionMs}ms`);
  console.log(`Personality: ${result.timing.personalityMs}ms`);
  console.log(`Generation: ${result.timing.generationMs}ms`);
  console.log(`Total: ${result.timing.totalMs}ms`);

  return { result, friendlyResult };
}

const linkedinUrl = process.argv[2] || 'https://www.linkedin.com/in/abhishek-jayaram/';
runFullPipeline(linkedinUrl).catch(console.error);
