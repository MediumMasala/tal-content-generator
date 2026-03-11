import { generateLinkedInPost } from './mastra/tools/linkedin-post-generator';
import { generateLinkedInFriendly } from './mastra/tools/linkedin-friendly';
import { loadPersonality, loadRawPosts, loadTalContext } from './mastra/storage/local-storage';
import * as fs from 'fs';

async function generateForUser(username: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Generating content for: ${username}`);
  console.log('='.repeat(60));

  // Load personality
  const personalityData = loadPersonality(username);
  if (!personalityData) {
    throw new Error(`Personality not found for ${username}`);
  }

  // Load raw posts for word count analysis (consistent with workflow)
  const rawPostsData = loadRawPosts(username);
  const rawPosts = rawPostsData?.data || [];
  console.log(`[test-generate] Loaded ${rawPosts.length} raw posts`);

  // Load Tal context and map to expected format
  const talContext = loadTalContext();

  // Build input matching workflow structure
  const generatorInput = {
    personality: {
      username,
      profileSnapshot: personalityData.analysis?.profileSnapshot,
      personalityGraph: personalityData.analysis?.personalityGraph,
      knowledgeGraph: personalityData.analysis?.knowledgeGraph,
      autoWritingGraph: personalityData.analysis?.autoWritingGraph,
      personaPrompt: personalityData.analysis?.personaPrompt,
      talCompatibilityLayer: personalityData.analysis?.talCompatibilityLayer,
    },
    tal: {
      systemPrompt: talContext.systemPrompt || undefined,
      lore: talContext.lore || undefined,
      sampleChats: talContext.chats.map((c: any) => c.content),
    },
    rawPosts,
    options: {}
  };

  console.log('\n[Step 1] Generating LinkedIn post...');
  const postResult = await generateLinkedInPost(generatorInput);

  console.log('\n--- MAIN POST ---');
  console.log(postResult.post);
  console.log('\n--- ALT VERSION ---');
  console.log(postResult.altVersion);
  console.log('\n--- FIT RATIONALE ---');
  console.log(postResult.fitRationale);
  console.log(`\n--- WORD COUNT: ${postResult.wordCount} / ${postResult.targetWordCount} ---`);

  // Now run linkedin-friendly optimization
  console.log('\n[Step 2] Running viral optimization...');
  const friendlyResult = await generateLinkedInFriendly({
    username,
    generatedPost: postResult.post,
    altVersion: postResult.altVersion,
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

  return { postResult, friendlyResult };
}

// Run for the specified user
const username = process.argv[2] || 'j-talsania';
generateForUser(username).catch(console.error);
